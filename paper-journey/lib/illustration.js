import * as THREE from '../vendor/three.module.js';
import { reducible, reduction } from './core.js';

export const INK = Object.freeze({
  deep: '#013388', cobalt: '#0449ac', blue: '#6e91bc',
  mist: '#d0dfe9', paper: '#ccc5bc', warm: '#e6ddca'
});

/** The existing project photographs read as blue prints inside the 3D
 * exhibition. This changes their display material, never the source assets. */
export function printedImage() {
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uPrintDeep = { value: new THREE.Color(INK.deep) };
    shader.uniforms.uPrintPaper = { value: new THREE.Color(INK.paper) };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uPrintDeep;\nuniform vec3 uPrintPaper;\nvoid main() {')
      .replace('#include <opaque_fragment>', `
        float printValue = pow(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.7);
        float printTone = 0.33 * smoothstep(0.08, 0.14, printValue)
          + 0.34 * smoothstep(0.24, 0.35, printValue)
          + 0.33 * smoothstep(0.52, 0.67, printValue);
        outgoingLight = mix(uPrintDeep, uPrintPaper, printTone);
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => 'blue-exhibition-print-v1';
  return material;
}

/** Shared by every studio plate: a top-down contact-shadow map for the floor
 * and the room's inner wall faces, both in world x / z. studio.js fills them. */
export const studioPlate = {
  occlusion: { value: null },
  occlusionRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  room: { value: new THREE.Vector4(-1e4, -1e4, 1e4, 1e4) }
};

/** Broad ink values, lit in world space so the camera can move around the
 * illustration. Real shadow maps retain contact and architectural depth.
 * Studio plates use the reference drawing's five inks and separate the faces
 * of an object (`form`); other channels keep three inks.
 * The existing reduction channel still owns the return to clay / paper. */
export function illustrated(color, channel = 'studio', options = {}) {
  const { paperCoverage = 1, form = 1, ...surfaceOptions } = options;
  // Lambert, not Standard: the plate's inks replace the lit colour, so the
  // physical lighting and environment lookups were computed and discarded on
  // every fragment. Lambert keeps the normals and shadow maps the inks need
  // (and the clay return) at a fraction of the cost on integrated GPUs.
  const material = reducible(new THREE.MeshLambertMaterial({
    ...surfaceOptions, color, map: null
  }), channel);
  const reduce = material.onBeforeCompile;
  const studio = channel === 'studio';
  // Dark swatches sit lower on the ink scale; deep ones never reach paper.
  const inkBias = color === INK.deep ? (studio ? .36 : .24) : color === INK.cobalt ? .10 : 0;
  material.onBeforeCompile = shader => {
    reduce(shader);
    // Broad, flat values expose shadow-map self-acne that a textured PBR
    // surface conceals. Offset only these illustrated receivers, leaving the
    // actual drawing and the approved shadow camera untouched.
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vPlateWorld;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPlateWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <shadowmap_vertex>',
      THREE.ShaderChunk.shadowmap_vertex.replaceAll('.shadowNormalBias', '.shadowNormalBias * 4.0'));
    shader.uniforms.uPlateKey = { value: new THREE.Vector3(
      ...[-11, 9, 8]
    ).normalize() };
    shader.uniforms.uInkBias = { value: inkBias };
    shader.uniforms.uPaperCoverage = { value: paperCoverage };
    shader.uniforms.uStudioPlate = { value: channel === 'studio' ? 1 : 0 };
    shader.uniforms.uInkDeep = { value: new THREE.Color(INK.deep) };
    shader.uniforms.uInkBlue = { value: new THREE.Color(INK.cobalt) };
    shader.uniforms.uInkPaper = { value: new THREE.Color(channel === 'studio' ? INK.warm : INK.paper) };
    shader.uniforms.uInkLight = { value: new THREE.Color(INK.blue) };
    shader.uniforms.uInkMist = { value: new THREE.Color(INK.mist) };
    shader.uniforms.uForm = { value: form };
    shader.uniforms.uOcclusion = studioPlate.occlusion;
    shader.uniforms.uOcclusionRect = studioPlate.occlusionRect;
    shader.uniforms.uRoom = studioPlate.room;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `#include <shadowmask_pars_fragment>
        varying vec3 vPlateWorld;
        uniform vec3 uPlateKey, uInkDeep, uInkBlue, uInkPaper, uInkLight, uInkMist;
        uniform float uInkBias, uStudioPlate, uPaperCoverage, uForm;
        uniform sampler2D uOcclusion;
        uniform vec4 uOcclusionRect, uRoom;
        void main() {`)
      .replace('#include <opaque_fragment>', `
        vec3 plateNormal = inverseTransformDirection(normal, viewMatrix);
        float facingLight = dot(plateNormal, uPlateKey);
        float shadowMask = getShadowMask();
        float visibleLight = mix(1.0, shadowMask, smoothstep(0.02, 0.20, facingLight));
        // Once inside, the ceiling must not flatten every furnishing into
        // the same blue. A single graphic fill preserves the paper planes.
        visibleLight = mix(0.80 + 0.20 * visibleLight, visibleLight, uStudioPlate);
        // A broad, world-anchored aperture mask describes one diagonal light
        // mass. It moves with neither the camera nor time; the same light
        // shape crosses the wall, desk and figure, like an illustrated plate.
        float aperture = 1.0 - smoothstep(-3.92, -3.88,
          dot(vPlateWorld, vec3(0.5, 0.7, -0.6)));
        aperture *= smoothstep(-7.20, -7.16, vPlateWorld.x);
        aperture *= 1.0 - smoothstep(2.73, 2.77,
          dot(vPlateWorld, vec3(0.9, 0.0, 0.25)));
        visibleLight *= mix(1.0, aperture, uStudioPlate);
        float lightValue = facingLight * visibleLight - uInkBias;
        // Three inks, not three brightnesses of each object's own colour.
        // Narrow smooth transitions anti-alias the band boundary only.
        float bandAA = max(0.035, fwidth(lightValue) * 1.25);
        float paperBand = smoothstep(0.335 - bandAA, 0.335 + bandAA, lightValue);
        float deepBand = 1.0 - smoothstep(-0.40, -0.36, lightValue);
        vec3 plateInk = mix(uInkBlue, uInkDeep, deepBand);
        plateInk = mix(plateInk, uInkPaper, paperBand * uPaperCoverage);
        if (uStudioPlate > 0.5) {
          // Contact: the floor darkens beside walls and under furniture (a
          // baked top-down map); walls darken just above the floor.
          float floorish = step(0.7, plateNormal.y) * (1.0 - step(0.05, vPlateWorld.y));
          vec2 occUV = (vPlateWorld.xz - uOcclusionRect.xy) / (uOcclusionRect.zw - uOcclusionRect.xy);
          float wallDist = min(min(vPlateWorld.x - uRoom.x, uRoom.z - vPlateWorld.x),
                               min(vPlateWorld.z - uRoom.y, uRoom.w - vPlateWorld.z));
          float occlusion = floorish * max(texture2D(uOcclusion, occUV).r,
                                           (1.0 - smoothstep(0.0, 0.55, wallDist)) * 0.55);
          float wallish = (1.0 - step(0.3, abs(plateNormal.y))) * (1.0 - step(0.03, wallDist));
          occlusion = max(occlusion, wallish * (1.0 - smoothstep(0.0, 0.45, vPlateWorld.y)) * 0.5);
          // Form: on an object, the top takes the full light and its sunlit
          // sides one ink lower, as a painter separates the planes of a box.
          float up = plateNormal.y;
          float formLight = mix(-0.12, 0.03, max(up, 0.0)) - 0.08 * max(-up, 0.0);
          // The filtered shadow is blurred, then cut: a crisp edge that
          // follows a smooth contour instead of the map's texel steps.
          float studioLight = mix(1.0, smoothstep(0.22, 0.78, shadowMask), smoothstep(0.02, 0.20, facingLight))
            * aperture;
          visibleLight = studioLight;
          float value = facingLight * visibleLight - uInkBias
            + uForm * formLight * (0.2 + 0.8 * visibleLight) - occlusion * 0.45;
          // Five inks of the reference drawing, with soft but graphic steps:
          // deep, cobalt, light blue (terminators and penumbrae), mist, paper.
          float aa = max(0.025, fwidth(value) * 1.4);
          float toCobalt = smoothstep(-0.36 - aa, -0.36 + aa, value);
          float toLight = smoothstep(0.08 - aa, 0.08 + aa, value);
          float toMist = smoothstep(0.20 - aa, 0.20 + aa, value);
          float toPaper = smoothstep(0.42 - aa, 0.42 + aa, value);
          // Within the two broad inks a slight drift keeps large planes alive.
          vec3 cobalt = mix(mix(uInkBlue, uInkDeep, 0.35), uInkBlue, smoothstep(-0.36, 0.08, value));
          vec3 paper = mix(mix(uInkPaper, uInkMist, 0.18), uInkPaper, smoothstep(0.42, 0.62, value));
          plateInk = mix(uInkDeep, cobalt, toCobalt);
          plateInk = mix(plateInk, uInkLight, toLight);
          plateInk = mix(plateInk, uInkMist, toMist * uPaperCoverage);
          plateInk = mix(plateInk, paper, toPaper * uPaperCoverage);
        }
        outgoingLight = mix(plateInk, outgoingLight, uClay);
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => 'reference-ink-plate-v4';
  material.userData.illustrated = true;
  return material;
}

/** Subpixel silhouette ink. The backface shell reuses the original geometry;
 * it adds no model detail and never draws the individual surface triangles. */
export function contour(mesh, channel = 'studio', width = .65) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: {
      uInk: { value: new THREE.Color('#002452') },
      uSize: { value: new THREE.Vector2(1440,900) },
      uWidth: { value: width }, uOpacity: { value: 1 }
    },
    vertexShader: `uniform vec2 uSize; uniform float uWidth;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalMatrix * normal;
        vec2 d = (projectionMatrix * vec4(n, 0.0)).xy;
        d /= max(length(d), 0.0001);
        p.xy += d * (2.0 * uWidth / uSize) * p.w;
        gl_Position = p;
      }`,
    fragmentShader: `uniform vec3 uInk; uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uInk, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.name = 'SilhouetteInk';
  outline.renderOrder = -1;
  outline.onBeforeRender = renderer => {
    renderer.getDrawingBufferSize(material.uniforms.uSize.value);
    material.uniforms.uWidth.value = width * renderer.getPixelRatio();
    material.uniforms.uOpacity.value = mesh.material.opacity * (1 - reduction[channel].amount.value);
  };
  mesh.add(outline);
  return outline;
}
