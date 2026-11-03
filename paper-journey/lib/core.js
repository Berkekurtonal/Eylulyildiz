import * as THREE from '../vendor/three.module.js';

/* ------------------------------------------------------------------ *
 *  Shared maths
 * ------------------------------------------------------------------ */
export const clamp = THREE.MathUtils.clamp;
export const mix = THREE.MathUtils.lerp;

/** Cubic smoothstep - used for state visibility windows. */
export const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

/** Quintic smootherstep - C2 continuous, so chained camera moves never kink. */
export const ease = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

/* ------------------------------------------------------------------ *
 *  Texture synthesis
 *
 *  Everything is generated at authoring resolution with real mipmaps and
 *  anisotropic filtering. Surface variation lives in colour + roughness
 *  maps only: no normal or bump maps, because their high-frequency
 *  derivatives are the main source of shimmer under a moving camera.
 * ------------------------------------------------------------------ */
let anisotropy = 8;
export function setAnisotropy(value) { anisotropy = clamp(value, 1, 16); }

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, repeatX = 1, repeatY = repeatX, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Seamless value noise. The cell grid is tiled 3x3 into an oversized
 * buffer before a single blur pass, so the wrap edges carry their
 * neighbours values and the tile has no visible seam when repeated.
 */
function tileableNoise(size, cells, blur, contrast) {
  const src = canvas2d(size, size);
  const s = src.getContext('2d');
  const step = size / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const v = Math.round(clamp(128 + (Math.random() - .5) * 255 * contrast, 0, 255));
      s.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      s.fillRect(i * step, j * step, Math.ceil(step), Math.ceil(step));
    }
  }
  const big = canvas2d(size * 3, size * 3);
  const b = big.getContext('2d');
  for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) b.drawImage(src, dx * size, dy * size);
  const out = canvas2d(size, size);
  const o = out.getContext('2d');
  o.filter = 'blur(' + blur + 'px)';
  o.drawImage(big, -size, -size);
  o.filter = 'none';
  return out;
}

/** Layer several noise octaves into one grey canvas. */
function fbm(size, octaves) {
  const out = canvas2d(size, size);
  const o = out.getContext('2d');
  o.fillStyle = '#808080';
  o.fillRect(0, 0, size, size);
  for (const [cells, blur, contrast, alpha] of octaves) {
    o.globalAlpha = alpha;
    o.drawImage(tileableNoise(size, cells, blur, contrast), 0, 0);
  }
  o.globalAlpha = 1;
  return out;
}

/** Tint a grey noise canvas toward two colours and return colour + roughness. */
function surfaceFrom(grey, size, low, high, roughLow, roughHigh) {
  const colour = canvas2d(size, size);
  const c = colour.getContext('2d');
  c.drawImage(grey, 0, 0);
  const img = c.getImageData(0, 0, size, size);
  const rough = canvas2d(size, size);
  const r = rough.getContext('2d');
  const rimg = r.createImageData(size, size);
  const a = new THREE.Color(low), b = new THREE.Color(high), t = new THREE.Color();
  for (let i = 0; i < img.data.length; i += 4) {
    const k = img.data[i] / 255;
    // Canvas pixels are sRGB bytes; colour interpolation above is linear.
    // Encode once here before CanvasTexture decodes them for lighting.
    t.copy(a).lerp(b, k).convertLinearToSRGB();
    img.data[i] = Math.round(t.r * 255);
    img.data[i + 1] = Math.round(t.g * 255);
    img.data[i + 2] = Math.round(t.b * 255);
    const rv = Math.round(mix(roughLow, roughHigh, k) * 255);
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv;
    rimg.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  r.putImageData(rimg, 0, 0);
  return { colour, rough };
}

export function stoneTexture() {
  const size = 1024;
  const grey = fbm(size, [[6, 26, .55, 1], [22, 8, .3, .55], [90, 2, .16, .35]]);
  return surfaceFrom(grey, size, '#bdb4a1', '#d8d1c0', .62, .82);
}

export function plasterTexture() {
  const size = 1024;
  const grey = fbm(size, [[4, 40, .5, 1], [14, 14, .26, .5], [60, 3, .1, .3]]);
  return surfaceFrom(grey, size, '#a99e8a', '#c6bca7', .74, .95);
}

export function concreteTexture() {
  const size = 1024;
  const grey = fbm(size, [[5, 34, .62, 1], [18, 10, .3, .5], [80, 2, .12, .3]]);
  return surfaceFrom(grey, size, '#3a3934', '#4d4b43', .7, .92);
}

/** Long directional grain, drawn along U so it can be oriented per surface. */
export function oakTexture() {
  const size = 1024;
  const base = canvas2d(size, size);
  const c = base.getContext('2d');
  c.fillStyle = '#6b5642';
  c.fillRect(0, 0, size, size);
  c.filter = 'blur(1.2px)';
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * size;
    const dark = Math.random() < .5;
    c.strokeStyle = dark
      ? 'rgba(52,40,29,' + (.10 + Math.random() * .22) + ')'
      : 'rgba(150,124,94,' + (.06 + Math.random() * .14) + ')';
    c.lineWidth = .6 + Math.random() * 3.2;
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= size; x += 64) c.lineTo(x, y + Math.sin((x / size) * 6.2 + i) * (2 + Math.random() * 5));
    c.stroke();
  }
  c.filter = 'none';
  c.globalAlpha = .5;
  c.drawImage(tileableNoise(size, 10, 22, .45), 0, 0);
  c.globalAlpha = 1;
  const rough = canvas2d(size, size);
  const r = rough.getContext('2d');
  r.fillStyle = '#b4b4b4';
  r.fillRect(0, 0, size, size);
  r.globalAlpha = .55;
  r.drawImage(base, 0, 0);
  r.globalAlpha = 1;
  return { colour: base, rough };
}

/** Linen: deliberately low frequency so it never aliases at distance. */
export function linenTexture() {
  const size = 512;
  const grey = fbm(size, [[7, 20, .34, 1], [26, 6, .2, .5]]);
  return surfaceFrom(grey, size, '#c8bda8', '#ddd3c0', .9, .99);
}

export function rugTexture() {
  const size = 512;
  const grey = fbm(size, [[9, 16, .4, 1], [40, 4, .26, .6]]);
  return surfaceFrom(grey, size, '#b6a688', '#d2c4a6', .93, 1);
}

export function makeSurface(gen, repeatX, repeatY = repeatX) {
  const { colour, rough } = gen();
  return {
    map: toTexture(colour, repeatX, repeatY, true),
    roughnessMap: toTexture(rough, repeatX, repeatY, false)
  };
}

export function drawnTexture(width, height, draw, srgb = true) {
  const c = canvas2d(width, height);
  draw(c.getContext('2d'), width, height);
  const t = toTexture(c, 1, 1, srgb);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ------------------------------------------------------------------ *
 *  Geometry helpers
 * ------------------------------------------------------------------ */

/**
 * A box with rounded corners and a bevelled edge. Real geometry gets a
 * highlight along every edge instead of an infinitely sharp corner, which
 * is both more convincing and far kinder to multisampling.
 */
export function roundedBox(w, h, d, radius = .012) {
  const r = Math.min(radius, w / 2.2, h / 2.2, d / 2.2);
  const iw = w - 2 * r, ih = h - 2 * r;
  const cr = Math.min(r * 2.2, iw / 2.05, ih / 2.05);
  const shape = new THREE.Shape();
  const x = -iw / 2, y = -ih / 2;
  shape.moveTo(x + cr, y);
  shape.lineTo(x + iw - cr, y);
  shape.quadraticCurveTo(x + iw, y, x + iw, y + cr);
  shape.lineTo(x + iw, y + ih - cr);
  shape.quadraticCurveTo(x + iw, y + ih, x + iw - cr, y + ih);
  shape.lineTo(x + cr, y + ih);
  shape.quadraticCurveTo(x, y + ih, x, y + ih - cr);
  shape.lineTo(x, y + cr);
  shape.quadraticCurveTo(x, y, x + cr, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(.001, d - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r,
    bevelSegments: 3, curveSegments: 6, steps: 1
  });
  geo.translate(0, 0, -Math.max(.001, d - 2 * r) / 2);
  // ExtrudeGeometry is non-indexed: computeVertexNormals alone leaves
  // every bevel triangle flat. Weld coincident positions for area-weighted
  // normals before the caller projects UVs onto the finished surface.
  const p = geo.attributes.position, oldUV = geo.attributes.uv;
  const unique = new Map(), positions = [], uvs = [], indices = [];
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
    let index = unique.get(key);
    if (index === undefined) {
      index = positions.length / 3; unique.set(key, index);
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      uvs.push(oldUV.getX(i), oldUV.getY(i));
    }
    indices.push(index);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.deleteAttribute('normal'); geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

/**
 * World-space planar UVs. Each vertex is projected on the plane
 * perpendicular to its dominant normal axis, so one tiling scale reads
 * correctly on every face of every object, including extruded shapes.
 */
export function planarUV(geometry, scale = 1, offset = [0, 0]) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale + offset[0];
    uv[i * 2 + 1] = v * scale + offset[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Merge simple position/normal/uv geometries into one draw call. */
export function mergeGeometries(list) {
  const parts = list.map(g => g.index ? g.toNonIndexed() : g);
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/**
 * Drawn linework as flat world-space ribbons rather than GL lines.
 * A one-pixel LineBasicMaterial crawls and flickers as soon as the camera
 * moves; a quad of real width resolves through MSAA, holds perfectly
 * still, and thickens correctly as the plan is scaled up to full size.
 */
export function ribbonGeometry(segments, width, y = 0) {
  const half = width / 2;
  const verts = [], norms = [], uvs = [];
  // wound so the face normal is +Y: these are read from above
  const uvSet = [[0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]];
  for (const [x1, z1, x2, z2] of segments) {
    let dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    // extend by half a width at each end so corner joints close cleanly
    const ax = x1 - dx * half, az = z1 - dz * half, bx = x2 + dx * half, bz = z2 + dz * half;
    const px = -dz * half, pz = dx * half;
    const quad = [
      [ax - px, az - pz], [bx + px, bz + pz], [bx - px, bz - pz],
      [ax - px, az - pz], [ax + px, az + pz], [bx + px, bz + pz]
    ];
    quad.forEach((p, i) => {
      verts.push(p[0], y, p[1]);
      norms.push(0, 1, 0);
      uvs.push(uvSet[i][0], uvSet[i][1]);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(norms), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geo;
}

/** Rectangle outline expressed as four ribbon segments. */
export function rectSegments(x, z, w, d) {
  const x2 = x + w, z2 = z + d;
  return [[x, z, x2, z], [x2, z, x2, z2], [x2, z2, x, z2], [x, z2, x, z]];
}

/** A smooth swept limb. Tubes read as sculpted volume, not stacked cylinders. */
export function limb(points, radii, radialSegments = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal', .5);
  const steps = 28;
  const geo = new THREE.TubeGeometry(curve, steps, 1, radialSegments, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3(), centre = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPointAt(t, centre);
    // radii are sampled along the curve so limbs taper like real anatomy
    const idx = t * (radii.length - 1);
    const lo = Math.floor(idx), hi = Math.min(radii.length - 1, lo + 1);
    const r = mix(radii[lo], radii[hi], idx - lo);
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * (radialSegments + 1) + j;
      v.fromBufferAttribute(pos, k).sub(centre).normalize().multiplyScalar(r).add(centre);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 *  Image-based lighting
 *
 *  A tiny emissive room is prefiltered into an environment map. It gives
 *  every material a believable specular horizon and soft directional
 *  bounce without a single extra dynamic light.
 * ------------------------------------------------------------------ */
export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  // Radiance values, not swatches: PMREM prefilters into a half-float
  // target, so anything above 1 survives and the aperture actually reads
  // as daylight instead of a pale grey card.
  const lit = (r, g, b, side) => new THREE.MeshBasicMaterial({
    color: new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace),
    side: side || THREE.BackSide
  });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), [
    lit(.45, .47, .45),     // +X, reflected studio light
    lit(.95, .97, .94),     // -X, toward the actual studio aperture
    lit(.94, .95, .90),     // +Y ceiling
    lit(.09, .09, .08),      // -Y floor
    lit(.74, .76, .72),      // +Z, room bounce behind the seated figure
    lit(.21, .20, .18)       // -Z
  ]);
  env.add(shell);
  const panel = (w, h, rgb, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit(rgb[0], rgb[1], rgb[2], THREE.DoubleSide));
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    env.add(m);
  };
  panel(5.5, 6, [3.2, 3.15, 3.0], [-5.9, 1.4, 0], [0, Math.PI / 2, 0]);   // neutral architectural daylight
  panel(4, 4, [2.6, 3.0, 3.4], [-5.9, 3.4, -3], [0, Math.PI / 2, 0]);     // sky above the same aperture
  panel(9, 9, [1.05, 1.0, .86], [0, 3.9, 0], [Math.PI / 2, 0, 0]);        // soft ceiling bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, .035);
  pmrem.dispose();
  shell.geometry.dispose();
  return target.texture;
}

/* ------------------------------------------------------------------ *
 *  Material reduction
 *
 *  Chapter 06 has to strip texture, colour and metal response away from
 *  every surface at once. Swapping materials pops; lerping `color` alone
 *  leaves the albedo maps visible. Instead each registered material gets
 *  a short shader injection that blends the shaded result toward clay,
 *  driven by one shared uniform.
 * ------------------------------------------------------------------ */
// `flat` channels converge on a constant final colour rather than a darker
// albedo: at full amount no light or shadow can change their pixels.
const channel = (colour, flat = 0) => ({
  amount: { value: 0 }, colour: { value: new THREE.Color(colour) }, flat: { value: flat }
});

/* Three independent channels share one shader program:
 *   project  card model on the desk -> built materials -> clay (chapter 06)
 *   paper    the sheet's print -> a flat terrace tone -> print again at the end
 *   studio   the atelier, which converges on one flat near-void tone as it
 *            falls out of the light, so shadows can no longer move its pixels                              */
export const reduction = {
  project: channel('#c9c2b0'),
  paper: channel('#9d9585'),
  studio: channel('#1c1d19', 1)
};

export function reducible(material, name = 'project') {
  const ch = reduction[name];
  material.onBeforeCompile = shader => {
    shader.uniforms.uClay = ch.amount;
    shader.uniforms.uClayColour = ch.colour;
    shader.uniforms.uFlat = ch.flat;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uClay;\nuniform vec3 uClayColour;\nuniform float uFlat;\nvoid main() {')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, uClayColour, uClay );')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, 0.94, uClay );')
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\n\tmetalnessFactor = mix( metalnessFactor, 0.0, uClay );')
      .replace('#include <opaque_fragment>',
        '#include <opaque_fragment>\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, uClayColour, uClay * uFlat );');
  };
  material.customProgramCacheKey = () => 'reducible';
  return material;
}
