import * as THREE from '../vendor/three.module.js';
import { reduction } from './core.js';

/* ------------------------------------------------------------------ *
 *  RENDER PIPELINE
 *
 *  The scene is drawn into a 4x multisampled buffer and then composited
 *  through one fullscreen pass. That combination is what removes the
 *  crawling edges:
 *
 *    - MSAA on a render target resolves geometry edges properly at every
 *      device pixel ratio, rather than relying on the default backbuffer.
 *    - The composite adds a small amount of neighbour-weighted softening
 *      that is applied only where local contrast is high, so specular
 *      sparkle and sub-pixel wall arrises stop flickering while flat
 *      texture detail stays completely sharp.
 *    - Vignette, a gentle highlight roll-off and a very low static grain
 *      finish the image without introducing visible noise.
 *
 *  Three r160 writes linear light to offscreen targets, without tone
 *  mapping. Preserve that light in an HDR target and apply ACES + sRGB
 *  exactly once in the composite. Displaying the target unconverted
 *  crushes midtones and clips the highlights on skin, paper and fabric.
 * ------------------------------------------------------------------ */

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

const FRAG = `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform vec2 uPrintSize;
uniform float uVignette;
uniform float uGrain;
uniform float uSoften;
uniform float uTime;
uniform float uPrint;
uniform float uStudioPrint;
varying vec2 vUv;

float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
float printNoise(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec3 c = texture2D( tScene, vUv ).rgb;

  // Contrast-gated softening: a 5-tap cross is blended in proportion to
  // how much the neighbourhood disagrees. Flat areas keep every texel.
  vec3 n = texture2D( tScene, vUv + vec2( 0.0, uTexel.y ) ).rgb;
  vec3 s = texture2D( tScene, vUv - vec2( 0.0, uTexel.y ) ).rgb;
  vec3 e = texture2D( tScene, vUv + vec2( uTexel.x, 0.0 ) ).rgb;
  vec3 w = texture2D( tScene, vUv - vec2( uTexel.x, 0.0 ) ).rgb;
  vec3 blur = ( n + s + e + w + c * 2.0 ) / 6.0;
  float lc = luma( c );
  float contrast = max( max( abs( luma( n ) - lc ), abs( luma( s ) - lc ) ),
                        max( abs( luma( e ) - lc ), abs( luma( w ) - lc ) ) );
  c = mix( c, blur, smoothstep( 0.06, 0.34, contrast ) * uSoften );

  // The opening's authored ink swatches are display colours, not radiance.
  // Bypass the filmic curve there so cobalt does not shift to electric blue.
  vec3 inkDisplay = sRGBTransferOETF(vec4(c, 1.0)).rgb;
  gl_FragColor = vec4( c, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  c = mix(gl_FragColor.rgb, inkDisplay, uPrint);

  // Integrate the warm drawing sheet into the opening's two printing inks.
  // Existing linework and lighting return verbatim when the studio fades.
  float paperMask = smoothstep(0.015, 0.055, c.g - c.b) * uPrint;
  vec3 paperPrint = mix(vec3(0.004, 0.20, 0.533), mix(vec3(0.80, 0.773, 0.737), vec3(0.902, 0.867, 0.792), uStudioPrint),
    smoothstep(0.12, 0.80, luma(c)));
  c = mix(c, paperPrint, paperMask);

  // vignette, generous and soft
  vec2 v = ( vUv - 0.5 ) * vec2( 1.0, 0.92 );
  c *= 1.0 - uVignette * (1.0 - uPrint) * dot( v, v ) * 1.35;

  // very fine grain, low enough to read as film rather than noise
  float g = fract( sin( dot( vUv * 1024.0 + uTime, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( g - 0.5 ) * uGrain;

  // A still, fine ink tooth belongs to the opening plate. It disappears
  // with the existing studio reduction, so the closing paper is untouched.
  vec2 printPixel = floor(vUv * uPrintSize);
  float tooth = printNoise(printPixel);
  // Two stationary scales give the paper a softly mottled fibre structure.
  vec2 fibreUV = vUv * uPrintSize / 3.0;
  vec2 cell = floor(fibreUV), f = fract(fibreUV);
  f = f * f * (3.0 - 2.0 * f);
  float fibre = mix(mix(printNoise(cell), printNoise(cell + vec2(1,0)), f.x),
    mix(printNoise(cell + vec2(0,1)), printNoise(cell + vec2(1,1)), f.x), f.y);
  c += (tooth - 0.5) * 0.026 * uPrint;
  c += (fibre - 0.5) * 0.026 * uStudioPrint;

  gl_FragColor = vec4( c, 1.0 );
}`;

export class Pipeline {
  constructor(renderer, { samples = 4 } = {}) {
    this.renderer = renderer;
    this.enabled = renderer.capabilities.isWebGL2;
    this.target = null;
    if (this.enabled) {
      this.target = new THREE.WebGLRenderTarget(2, 2, {
        samples: Math.min(samples, renderer.capabilities.maxSamples),
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false
      });
      this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      this.target.texture.generateMipmaps = false;

      this.material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tScene: { value: this.target.texture },
          uTexel: { value: new THREE.Vector2() },
          uPrintSize: { value: new THREE.Vector2() },
          uVignette: { value: .3 },
          uGrain: { value: .012 },
          uSoften: { value: .4 },
          uTime: { value: 0 },
          uPrint: { value: 1 },
          uStudioPrint: { value: 1 }
        }
      });
      const quad = new THREE.BufferGeometry();
      quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
      quad.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.Mesh(quad, this.material));
      this.camera = new THREE.Camera();
    }
  }

  setSize(width, height, pixelRatio) {
    if (!this.enabled) return;
    const w = Math.max(2, Math.round(width * pixelRatio));
    const h = Math.max(2, Math.round(height * pixelRatio));
    this.target.setSize(w, h);
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.material.uniforms.uPrintSize.value.set(width, height);
  }

  /** Number of MSAA samples actually in use, for the quality readout. */
  get samples() { return this.enabled ? this.target.samples : 0; }

  set vignette(v) { if (this.enabled) this.material.uniforms.uVignette.value = v; }
  set grain(v) { if (this.enabled) this.material.uniforms.uGrain.value = v * .25; }

  render(scene, camera, time) {
    if (!this.enabled) { this.renderer.render(scene, camera); return; }
    // Static grain: no temporal noise competing with fine drawing lines.
    this.material.uniforms.uTime.value = 0;
    this.material.uniforms.uStudioPrint.value = 1 - reduction.studio.amount.value;
    // The ink treatment belongs to the approved atelier. ARCHÉ uses its
    // source material palette after the existing studio dissolve.
    this.material.uniforms.uPrint.value = 1 - reduction.studio.amount.value;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (!this.enabled) return;
    this.target.dispose();
    this.material.dispose();
  }
}
