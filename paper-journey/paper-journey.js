import { advanceProgress } from './motion.js';
import { endingAt, technicalAt, topDownCamera } from './lib/ending.js';
import { assemblyAt, assemblyOrigin, presentationCamera, planOverhead, ARCHITECTURAL_Y, ASSEMBLY } from './lib/assembly.js';
import { LEVELS } from './lib/arche-levels.js';
import { interiorVisibility } from './lib/arche-presentation.js';
import { contentAt, PANEL_WINDOWS } from './content-motion.js';
import * as THREE from './vendor/three.module.js';
import { clamp, mix, smooth, ease, setAnisotropy, buildEnvironment, reduction } from './lib/core.js';
import { buildStudio } from './lib/studio.js';
import { buildIntactArchitect as buildArchitect } from './lib/painted-architect.js';
import { buildProject } from './lib/project.js';
import { Pipeline } from './lib/post.js';
import { CHAPTERS, PROJECTS, CONTACT } from './lib/content.js';
import { ANCHORS, W, SLAB, story, chapterCoord, wallRise, cameraLocal, focusY } from './lib/timeline.js';
import { zoneFraction, zoneContains, scrollToZone, scrollBeyond } from '../shared/scroll-zones.js';
import { text, onLanguageChange } from '../shared/i18n.js';

/* ══════════════════════════════════════════════════════════════════
   PART 1 of 3 — PAPERJOURNEY  ·  OPENING PRESERVED

   The approved architect / desk / drawing opening is preserved. After
   the readable ARCHÉ plan, a fixed presentation camera frames the
   accumulating basement / ground / first-floor assembly. It is followed by LetterHandoff (Part 2) and
   EditorialSite (Part 3), which never reach into this module; it knows
   of them only that its own scroll zone ends and the page continues.

   Preserve the scroll zone and ProjectOrigin contract. Verify changes with
   timeline.test.mjs and tests/paper-journey/assembly.test.mjs.
   ══════════════════════════════════════════════════════════════════

   EYLÜL YILDIZ — one world, one camera, one scalar.

   `progress` runs 0…6 in scroll units; T = progress / 6 drives
   everything through lib/timeline.js. The paper on the desk, the walls
   that rise from it and the interior are one ProjectOrigin. The scene
   only ever moves and scales that origin, and the camera is authored in
   the project's own local space — so the drawing stays pinned while the
   world around it changes size, and every frame reverses exactly.
   ══════════════════════════════════════════════════════════════════ */

const staticState = new URLSearchParams(location.search).get('state');
const embedded = staticState !== null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = s => document.querySelector(s);
const viewport = el('#viewport');
const stack = el('#chapter-stack');
const ticks = el('#ticks');
const editorial = el('.paper-journey .rail');
const masthead = el('.paper-journey .rail-top');
const wayfinding = el('.paper-journey .rail-foot');
const portraitPanel = matchMedia('(max-width: 900px) and (orientation: portrait)');
let shownCopy = -1;
let copyFocus = false;

/* ───────────────  temporary editorial content  ─────────────── */
const blocks = CHAPTERS.map(c => {
  const d = document.createElement('article');
  d.className = 'chapter';
  d.innerHTML =
    '<p class="label">' + c.label + '</p>' +
    '<h1>' + c.title.replaceAll('<br>', '<br><span class="pj-break-space"> </span>') + '</h1>' +
    '<p class="text">' + c.body + '</p>' +
    (c.meta.length ? '<ul>' + c.meta.map(m => '<li>' + m + '</li>').join('') + '</ul>' : '');
  stack.append(d);
  return d;
});

CHAPTERS.forEach((c, i) => {
  const b = document.createElement('button');
  b.title = c.name;
  b.setAttribute('aria-label', text('{current} of 7: {name}', { current: i + 1, name: c.name }));
  b.onclick = () => go(i);
  ticks.append(b);
});

el('#contact').href = 'mailto:' + CONTACT;
el('#contact-address').textContent = CONTACT;

let project = 0, projectMix = 0;
function paintProject() {
  const p = PROJECTS[project];
  el('#project-code').textContent = p.code;
  el('#project-name').textContent = p.name;
  el('#project-type').textContent = p.type;
  el('#project-place').textContent = p.place;
}
paintProject();
el('#project-next').onclick = () => { project = (project + 1) % PROJECTS.length; paintProject(); };

/* ───────────────  scroll: the single source of truth  ─────────────── *
 *  The journey owns one scroll zone (shared/immersive.css). Progress is
 *  the fraction of that zone, so its timing is fixed by its own span and
 *  never by the length of the page that follows it. The span equals the
 *  scroll length the sequence was approved at.                         */
const zone = el('[data-zone="paper-journey"]');
const endingZone = el('[data-zone="arche-ending"]');
let endingProgress = !embedded && endingZone ? zoneFraction(endingZone) : 0;
let target = embedded ? ANCHORS[clamp(Number(staticState) || 0, 0, 6)] * 6 : zoneFraction(zone) * 6;
let progress = target;
let current = -1;

function go(i) {
  if (embedded) return;
  // Text navigation lands in the readable hold of its introduction; it
  // still travels through the original scene timeline on the same zone.
  scrollToZone(zone, PANEL_WINDOWS[clamp(i, 0, 6)].at[1], reduced);
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); go(+b.dataset.go); });
// at the last chapter the cue leads on, out of the journey
el('#cue').onclick = () => current >= 6 ? scrollBeyond(zone, reduced) : go(current + 1);
addEventListener('scroll', () => { if (!embedded) target = zoneFraction(zone) * 6; }, { passive: true });
addEventListener('keydown', e => {
  if (embedded || e.target.closest('button,a,input,textarea,select')) return;
  // chapter keys belong to the journey only while it holds the screen;
  // past either end they fall through to ordinary page scrolling
  if (!zoneContains(zone)) return;
  const forward = e.key === 'ArrowRight' || e.key === 'PageDown';
  const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
  if (forward && current < 6) { e.preventDefault(); go(current + 1); }
  if (back && current > 0) { e.preventDefault(); go(current - 1); }
});

if (embedded) {
  document.documentElement.classList.add('is-embedded');
  el('.rail-foot').style.visibility = 'hidden';
}

/* ───────────────  copy, synchronised to the chapter coordinate  ─────────────── */
function paintCopy() {
  const T = clamp(progress / 6, 0, 1);
  const c = chapterCoord(T);
  const presentation = contentAt(T);
  const idx = presentation.index >= 0 ? presentation.index : clamp(Math.floor(c + .5), 0, 6);
  if (current !== idx) {
    current = idx;
    const ch = CHAPTERS[idx];
    el('#counter').textContent = String(idx + 1).padStart(2, '0');
    el('#scene-state').textContent = ch.name;
    el('#cue-label').textContent =
      text(idx === 6 ? 'Continue to the studio' : idx === 0 ? 'Scroll to the drawing' : 'Continue');
    [...ticks.children].forEach((b, i) => {
      b.classList.toggle('active', i === idx);
      b.setAttribute('aria-current', i === idx ? 'step' : 'false');
    });
  }
  const { index, amount, side, chrome } = presentation;
  if (index >= 0 && shownCopy !== index) {
    shownCopy = index;
    editorial.dataset.chapter = index;
    editorial.dataset.side = side;
    editorial.scrollTop = 0;
    el('#chapter-index').textContent = String(index + 1).padStart(2, '0');
    el('#chapter-name').textContent = CHAPTERS[index].name;
    blocks.forEach((block, i) => {
      block.classList.toggle('is-live', i === index);
      block.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    el('#project').hidden = index !== 4;
    el('#contact').hidden = index !== 6;
  }
  const visible = amount > .001;
  editorial.dataset.visible = String(visible);
  editorial.inert = amount < .85;
  if (editorial.inert && editorial.contains(document.activeElement)) document.activeElement.blur();
  editorial.setAttribute('aria-hidden', String(!visible));
  const distance = (1-amount)*110;
  const dock = index === 2 ? 'top' : 'center';
  editorial.dataset.dock = dock;
  editorial.style.transform = portraitPanel.matches
    ? `translate3d(0, ${reduced ? 0 : distance}%, 0)`
    : `translate3d(${reduced ? 0 : distance*(side === 'right' ? 1 : -1)}%, ${dock === 'top' ? 0 : '-50%'}, 0)`;
  editorial.style.opacity = reduced ? amount : smooth(0, .28, amount);
  // The mobile footer yields to the compact bottom sheet as it arrives.
  const footOpacity = chrome * (portraitPanel.matches ? 1-amount : 1);
  const mastOpacity = chrome * smooth(.006, .018, T) * (index === 2 ? 1-amount : 1);
  masthead.style.opacity = mastOpacity;
  wayfinding.style.opacity = footOpacity;
  masthead.inert = mastOpacity < .1;
  wayfinding.inert = footOpacity < .1;
  el('#bar-fill').style.width = (T * 100).toFixed(2) + '%';
  if (copyFocus && amount > .98) { el('#rail-copy').focus({ preventScroll: true }); copyFocus = false; }
}

// Update only copy in the existing panels. Never touch the clock, camera, scene,
// current/shown chapter indices, focus, or each panel's animation attributes.
onLanguageChange(() => {
  const panelScroll = editorial.scrollTop;
  blocks.forEach((block, i) => {
    const c = CHAPTERS[i];
    block.querySelector('.label').textContent = c.label;
    block.querySelector('h1').innerHTML = c.title.replaceAll('<br>', '<br><span class="pj-break-space"> </span>');
    block.querySelector('.text').textContent = c.body;
    block.querySelectorAll('li').forEach((item, j) => { item.textContent = c.meta[j]; });
    const tick = ticks.children[i];
    tick.title = c.name;
    tick.setAttribute('aria-label', text('{current} of 7: {name}', { current: i + 1, name: c.name }));
  });
  if (shownCopy >= 0) el('#chapter-name').textContent = CHAPTERS[shownCopy].name;
  if (current >= 0) {
    el('#scene-state').textContent = CHAPTERS[current].name;
    el('#cue-label').textContent = text(current === 6 ? 'Continue to the studio' : current === 0 ? 'Scroll to the drawing' : 'Continue');
  }
  paintProject();
  editorial.scrollTop = panelScroll;
});

// The existing skip link goes to the nearest readable editorial moment,
// using the same scroll zone. Hidden panels never contain keyboard focus.
document.querySelector('a[href="#rail-copy"]').onclick = event => {
  event.preventDefault();
  const t = progress / 6;
  const index = PANEL_WINDOWS.findIndex(({ at }) => at[2] >= t);
  copyFocus = true;
  scrollToZone(zone, PANEL_WINDOWS[index < 0 ? 6 : index].at[1], reduced);
};

/* ───────────────  renderer  ─────────────── */
// Integrated GPUs pay most for multisampling and for the shadow map's size.
// Measured on Intel UHD at 1920x1080: 4x MSAA cost ~12 ms a frame and the
// 4096 shadow redraw ~13 ms while scrolling. There both are halved (the frame
// falls from ~45 to ~28 ms); other GPUs keep the full settings.
let renderer, pipeline, integratedGPU = false;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  try {
    const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
    integratedGPU = !!info && /Intel|Mali|Adreno|PowerVR/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch {}
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  viewport.prepend(renderer.domElement);
  pipeline = new Pipeline(renderer, { samples: integratedGPU ? 2 : 4 });
  // MSAA lives on the offscreen target; without WebGL2 fall back to a
  // multisampled backbuffer.
  if (!pipeline.enabled) {
    renderer.dispose();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    viewport.prepend(renderer.domElement);
    pipeline = new Pipeline(renderer);
  }
} catch (e) {
  el('#fallback').hidden = false;
  paintCopy();
  addEventListener('scroll', () => { progress = target; paintCopy(); }, { passive: true });
}

if (renderer) start();

function start() {
  setAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const DARK = new THREE.Color('#013388'), PAPER = new THREE.Color('#e4e0d1');
  reduction.studio.colour.value.copy(DARK);
  scene.background = new THREE.Color().copy(DARK);
  scene.fog = new THREE.Fog(scene.background.clone(), 40, 160);
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(40, 1, .04, 260);
  scene.add(camera);

  /* ---- lighting ----------------------------------------------------- *
   *  One shadow-casting key that hands over from the atelier aperture to
   *  the project's daylight while the project grows, a cool counter-light,
   *  a hemisphere plus the prefiltered environment, and practicals.     */
  const hemi = new THREE.HemisphereLight('#f7ecd6', '#6b6252', 1.9);
  scene.add(hemi);

  const sky = new THREE.DirectionalLight('#c6d5e6', .35);
  sky.position.set(15, 7, -3);
  scene.add(sky);

  const sun = new THREE.DirectionalLight('#ffeccd', 3.4);
  sun.castShadow = true;
  const shadowSize = Math.min(innerWidth < 900 || integratedGPU ? 2048 : 4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -.00012;
  sun.shadow.normalBias = .004;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  let shadowHalf = -1;

  const roomFill = new THREE.PointLight('#f2dcb4', 0, 18, 2);
  scene.add(roomFill);
  const artLight = new THREE.PointLight('#ffe9c8', 0, 9, 2);
  scene.add(artLight);

  // atelier bounce: the key is behind the studio wall, so the camera-facing
  // side would otherwise crush to black
  const bounce = new THREE.DirectionalLight('#e8d8bb', 0);
  bounce.position.set(1.5, 2.4, 16);
  bounce.target.position.set(0, 1, 7);
  scene.add(bounce, bounce.target);

  /* ---- the world ---------------------------------------------------- */
  const world = new THREE.Group();
  scene.add(world);

  const studio = buildStudio();
  world.add(studio);
  const architect = buildArchitect();
  architect.position.set(-.86, 0, 10.08);
  world.add(architect);

  const proj = buildProject();
  world.add(proj.origin);

  const lamp = studio.userData.lamp;
  // shell and desk-prop materials, with each one's own opacity, so they can
  // dissolve before they are switched off
  const fading = [];
  [studio.userData.shell, studio.userData.props].forEach(g => g.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!fading.some(f => f.m === m)) fading.push({ m, opacity: m.opacity, transparent: m.transparent });
    });
  }));
  const groundMat = studio.userData.ground.material;

  const STUDIO_DIR = new THREE.Vector3(-11, 9, 8).normalize();
  const ROOM_DIR = new THREE.Vector3(11.5, 10.5, 4.2).normalize();
  const SUN_WARM = new THREE.Color('#f3f1ea').multiplyScalar(.48), SUN_NEUTRAL = new THREE.Color('#fbf8f2');
  const HEMI_WARM = new THREE.Color('#eef1f1').multiplyScalar(.65), HEMI_NEUTRAL = new THREE.Color('#eceee9');
  // a shade above the paper's own value, so the slab separates from the
  // sheet without outshining the linework on it
  const CARD = new THREE.Color('#c9c2b0'), CLAY = new THREE.Color('#cac7bb');

  const eyeL = new THREE.Vector3(), aimL = new THREE.Vector3(), aim = new THREE.Vector3();
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();

  /* ---- the master timeline ------------------------------------------ */
  function choreograph(T, time) {
    const b = story(T), c = chapterCoord(T);
    const o = assemblyOrigin(T), s = o.s;

    /* ProjectOrigin: the only transform the transformation uses */
    proj.origin.position.fromArray(o.position);
    proj.origin.scale.setScalar(s);
    proj.origin.updateMatrixWorld(true);
    proj.focus.position.set(0, focusY(b), 0);

    const u = proj.room.userData;
    const assembly = assemblyAt(T);
    const fall = 0; // Completed levels persist through the end of PaperJourney.
    // Keep the illustrated desk and its paper present through every level.
    const paperT = 0;

    /* A — the upper plan uses its own existing traced lines, never a filled
     *     image laid over the Basement drawing. Basement ink is in massing. */
    const { heavy, medium } = proj.drawing;
    const depth = smooth(W.lineDepth[0], W.lineDepth[1], b);
    const settle = smooth(W.lineSettle[0], W.lineSettle[1], b);
    heavy.material.opacity = assembly.ground.plan * mix(.78,.24,assembly.ground.walls);
    medium.material.opacity = assembly.ground.plan * mix(.42,.12,assembly.ground.details) * interiorVisibility(assembly,'ground');
    proj.drawing.group.visible = assembly.ground.plan > .001;
    heavy.visible = heavy.material.opacity > .003;
    medium.visible = medium.material.opacity > .003;
    heavy.scale.y = mix(mix(.004, .12, depth), .012, settle);
    medium.scale.y = mix(mix(.004, .06, depth), .008, settle);

    /* B — basement stays on the page; upper levels grow at fixed datums. */
    const thick = SLAB * ARCHITECTURAL_Y * assembly.ground.slab * (1 - fall);
    proj.floor.position.y = -(SLAB + .004) + .006;
    // Ground closes at the First Floor datum only after all ground walls
    // stand; thickness grows downward while the top stays registered.
    u.slab.position.y = proj.floor.position.y + u.stageY + LEVELS.first.y*ARCHITECTURAL_Y - thick;
    u.slab.scale.y = Math.max(.0005, thick);
    u.slab.visible = assembly.ground.slab > .001;
    u.groundPrint.material.opacity = 0;
    u.groundPrint.visible = false;
    u.levelLabels.ground.visible = assembly.ground.plan > .95;
    u.levelLabels.basement.visible = assembly.basement.walls > .95;
    u.levelLabels.first.visible = assembly.first.walls > .95;

    /* C — cumulative level construction, ground perimeter and partitions */
    u.walls.forEach((w, i) => {
      const r = wallRise(i, .46 + assembly.ground.walls * .19);
      w.scale.y = Math.max(.0006, r);
      w.visible = r > .004;
    });
    const north = assembly.ground.details;
    u.exhibition.scale.y = Math.max(.001, north);
    u.exhibition.visible = north > .02;
    const east = assembly.ground.walls;
    u.glazing.scale.y = Math.max(.001, east);
    u.glazing.visible = east > .02;

    const furn = assembly.ground.details;
    u.furniture.scale.y = Math.max(.0012, furn);
    u.furniture.visible = furn > .02;

    const ceil = 0; // Section model: no opaque ceiling over the floor drawings.
    u.ceiling.userData.materials.forEach(m => { m.opacity = ceil; });
    u.ceiling.visible = ceil > .02;
    u.massing.setAssembly(assembly);
    u.ceiling.traverse(m => { if (m.isMesh) m.castShadow = ceil > .9; });
    u.pendant.scale.y = Math.max(.0012, furn);
    u.pendant.visible = furn > .02;

    const outside = 0;
    u.outside.material.opacity = outside;
    u.outside.visible = outside > .03;

    const plate = assembly.ground.details;
    u.plates.forEach(m => { m.opacity = plate; });
    u.setPresentation(assembly);

    /* D — card model becomes built material; the print steps back */
    const clay = 0;
    const card = 1 - smooth(W.realMaterial[0], W.realMaterial[1], b);
    reduction.project.amount.value = Math.max(card, clay);
    reduction.project.colour.value.copy(CARD).lerp(CLAY, smooth(3, 4.2, c));
    reduction.paper.amount.value = 0; // The Basement source sheet remains the anchor.

    /* E — the studio remains the spatial frame, including the desk edge,
     *     paper and props, even when all three floors are built. The painted
     *     architect is a surface authored for the opening camera: seen from
     *     the raised plan and model cameras it reads as smeared ink, so it is
     *     withdrawn whole, never ghosted, as the camera lifts off the sheet. */
    reduction.studio.amount.value = 0;
    fading.forEach(f => { f.m.opacity = f.opacity; f.m.transparent = f.transparent; });
    studio.userData.props.visible = true;
    studio.userData.shell.visible = true;
    architect.visible = T < ASSEMBLY.anchor;
    studio.userData.desk.visible = true;
    groundMat.opacity = 1;
    studio.userData.ground.visible = true;
    const lampK = 1;
    lamp.intensity = 2.6 * lampK;
    const glow = studio.userData.lampGlow;
    glow.material.color.copy(glow.userData.base).multiplyScalar(lampK);
    bounce.intensity = .85 * (1 - smooth(.58, .70, b));

    /* light */
    // Direction turns early, so nothing in the studio still casts onto the
    // sheet when it is switched off. Brightness waits for the world to grow:
    // daylight arrives with the scale, not before it.
    const k = smooth(W.light[0], W.light[1], b);
    const day = smooth(W.scale[0], W.scale[1], b);
    proj.focus.getWorldPosition(sun.target.position);
    dir.copy(STUDIO_DIR).lerp(ROOM_DIR, k).normalize();
    sun.position.copy(sun.target.position).addScaledVector(dir, 30);
    const half = Math.max(mix(6, 3.2, smooth(.12, .34, b)), 12 * s); // the atelier fits in 12 m
    if (Math.abs(half - shadowHalf) > .01) {
      shadowHalf = half;
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -half;
      sc.right = sc.top = half;
      sc.updateProjectionMatrix();
    }
    const clayLevel = mix(1, .34, clay);
    sun.intensity = mix(3.0, 5.0, day) * mix(1, .7, paperT) * clayLevel;
    sun.color.copy(SUN_WARM).lerp(SUN_NEUTRAL, clay);
    hemi.color.copy(HEMI_WARM).lerp(HEMI_NEUTRAL, clay);
    sky.intensity = mix(.2, 1.15, day) * (1 - paperT * .55) * clayLevel;
    // the closing frame is the sheet itself again, lit as paper under daylight
    hemi.intensity = mix(1.9, 2.9, day) * clayLevel + paperT * 2.3;

    const bay = (projectMix - 1) * 3.55;
    roomFill.position.copy(proj.origin.localToWorld(tmp.set(2.4, 2.4, 1.2)));
    roomFill.intensity = 16 * s * s * smooth(.84, .96, b) * (1 - ease(4.9, 5.5, c));
    roomFill.distance = 18 * s;
    artLight.position.copy(proj.origin.localToWorld(tmp.set(bay * .82, 2.15, -3.1)));
    artLight.intensity = 22 * s * s * smooth(3.25, 4.0, c) * (1 - smooth(4.5, 5.1, c));
    artLight.distance = 9 * s;

    renderer.toneMappingExposure = mix((mix(1.06, 1.14, day) + paperT * .06) * mix(1, .93, clay), .90, smooth(.34, .445, T));
    pipeline.vignette = mix(.32, .1, paperT);
    pipeline.grain = mix(.012, .005, paperT);
    scene.background.copy(DARK).lerp(PAPER, paperT);
    scene.fog.color.copy(scene.background);

    /* camera — original opening, then fixed in ProjectOrigin space */
    const cam = presentationCamera(T);
    eyeL.fromArray(cam.eye);
    aimL.fromArray(cam.aim);
    const exhibition = 0; // Project selection never pans the assembly camera.
    aimL.x += bay * exhibition;
    eyeL.x += bay * .34 * exhibition;
    camera.position.copy(eyeL).applyMatrix4(proj.origin.matrixWorld);
    aim.copy(aimL).applyMatrix4(proj.origin.matrixWorld);

    // Pane fit, along the view axis only, so it is identical at desk scale
    // and at building scale. While the drawing is pinned, no pane may see
    // more than the reference desktop frame (40 deg, aspect .96): whatever
    // that frame keeps out - her hand, the desk props - stays out on every
    // screen shape. Outside the pin, narrow panes dolly back a little so the
    // framing survives. Once settled, the camera holds far enough back that
    // the desk and drawing sit inside the room instead of filling the pane.
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const REF_V = Math.tan(THREE.MathUtils.degToRad(40) / 2), REF_H = REF_V * .96;
    const fit = Math.min(1, REF_V / halfV, REF_H / (halfV * camera.aspect));
    let reach = mix(1, fit, cam.pin);
    if (camera.aspect < 1.05) reach *= 1 + (1.05 / Math.max(.5, camera.aspect) - 1) * .3025 * (1 - cam.pin);
    reach = mix(reach, fit * 1.70 * Math.max(1, .60 / camera.aspect), assembly.settle);
    camera.position.lerp(aim, 1 - reach);

    // hand-held weight, proportional to distance and quieter while pinned
    if (!reduced) {
      const amp = camera.position.distanceTo(aim) * .009 * (1 - .7 * cam.pin) * (1 - assembly.settle);
      camera.position.x += Math.sin(time * .19) * amp;
      camera.position.y += Math.sin(time * .27 + 1.3) * amp * .65;
      aim.x += Math.sin(time * .16 + .5) * amp * .3;
    }

    // Appended ending only: complete-building hold → true overhead → stable hold.
    // The original assembly camera above is unchanged when closing === 0.
    const closing = endingAt(endingProgress);
    const overheadWeight=Math.max(planOverhead(T),closing);
    camera.up.set(0, 1 - overheadWeight, -overheadWeight).normalize();
    if (closing > 0) {
      const overhead = topDownCamera(camera.aspect, camera.fov);
      camera.position.lerp(tmp.fromArray(overhead.eye).applyMatrix4(proj.origin.matrixWorld), closing);
      aim.lerp(tmp.fromArray(overhead.aim).applyMatrix4(proj.origin.matrixWorld), closing);
    }
    const technical=technicalAt(endingProgress);
    proj.technicalSheet.material.opacity=proj.technicalSheet.material.map?technical:0;
    proj.technicalSheet.visible=proj.technicalSheet.material.opacity>0;
    viewport.dataset.endingReady = String(closing === 1 && technical === 1 && !!proj.technicalSheet.material.map);
    camera.lookAt(aim);
    if (!reduced) camera.rotation.z += Math.sin(time * .11) * .0035 * (1 - assembly.settle);

    // Withdraw the intact figure during the approach. The quiet arm exits
    // the left frame before the rising camera can superimpose both sleeves.
    if (architect.userData.update) architect.userData.update(reduced ? 0 : time,
      smooth(.0624, .125, T),
      smooth(ASSEMBLY.planView[1], ASSEMBLY.spatialView[1], T));

  }

  /* ---- sizing: the pane, not the window ----------------------------- */
  const basePixelRatio = () => Math.min(devicePixelRatio || 1, innerWidth < 900 ? 1.8 : 2);
  let dprScale = 1;

  function resize() {
    const w = Math.max(2, viewport.clientWidth), h = Math.max(2, viewport.clientHeight);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = clamp(40 * (aspect < .88 ? .88 / aspect : 1), 34, 58);
    camera.updateProjectionMatrix();
    for(const label of Object.values(proj.room.userData.levelLabels))label.traverse(o=>{
      if(o.isSprite){o.center.x=aspect<.65?0:1;}
    });
    const dpr = basePixelRatio() * dprScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    pipeline.setSize(w, h, dpr);
  }
  new ResizeObserver(resize).observe(viewport);
  addEventListener('resize', resize);
  resize();

  /* ---- frame -------------------------------------------------------- */
  let last = performance.now(), time = 0, frameEMA = 16, tick = 0, warm = 0, scaleCap = 1;

  // The shadow map is redrawn only when a caster or the key can have moved:
  // scroll progress, the ending, or the painted figure's texture arriving
  // (her shadow is cut from it), plus every half second while the first
  // textures load. Holding still while reading costs no shadow pass, so an
  // integrated GPU does not hitch twice a second on a 4096 px depth pass.
  renderer.shadowMap.autoUpdate = false;
  let shadowKey = '', shadowAge = 0;

  // Once the page has scrolled on past the pinned stage, the world is off
  // screen: the clock keeps running, the draw is skipped.
  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(viewport);

  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    time += dt;
    progress=advanceProgress(progress,target,dt);
    const endingTarget = !embedded && endingZone ? zoneFraction(endingZone) : 0;
    endingProgress += (endingTarget - endingProgress) * (1 - Math.exp(-5.5 * dt));
    if (Math.abs(endingTarget - endingProgress) < 1e-5) endingProgress = endingTarget;
    projectMix = mix(projectMix, project, 1 - Math.exp(-dt * 4.2));
    paintCopy();
    if (onScreen) {
      const T = clamp(progress, 0, 6) / 6;
      choreograph(T, time);
      const key = T.toFixed(6) + ':' + endingProgress.toFixed(6) + ':' + architect.userData.painting.visible;
      if (key !== shadowKey || (time < 4 && ++shadowAge > 30)) {
        renderer.shadowMap.needsUpdate = true;
        shadowKey = key;
        shadowAge = 0;
      }
      pipeline.render(scene, camera, time);

      // adaptive resolution, phones only: trade device pixels, never
      // multisampling or shadows. Desktop panes keep full resolution, so the
      // image never softens after load; a slow desktop GPU loses frames, not
      // detail. Start-up is not measured, and a scale that proved too slow is
      // not retried, so sharpness never pumps.
      frameEMA = frameEMA * .94 + dt * 1000 * .06;
      if (innerWidth < 900 && time > 2 && ++tick > 90) {
        tick = 0;
        const before = dprScale;
        if (frameEMA > 26 && dprScale > .8) {
          scaleCap = dprScale - .05;
          dprScale = Math.max(.8, dprScale - .1);
        } else if (frameEMA < 18.5 && dprScale < scaleCap) dprScale = Math.min(scaleCap, dprScale + .05);
        if (before !== dprScale) resize();
      }
    }

    if (!embedded || ++warm < 240) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- shader warm-up ----------------------------------------------- *
   *  Each phase of the assembly used to compile its shaders the first time
   *  it appeared: up to a second of frozen scroll on integrated GPUs. Once
   *  the textures are in, the scene is posed at every step of the journey
   *  and its programs compiled in the background (parallel compile). Each
   *  pose is set and compiled within one task; the next frame restores the
   *  visitor's own position, so nothing posed is ever drawn. Programs are
   *  compiled against the pipeline's target, as they will be drawn: output
   *  colour space and tone mapping are part of each program.            */
  let warming = false;
  async function warmPrograms() {
    if (warming || embedded) return;
    warming = true;
    for (let i = 0; i <= 50; i++) {
      choreograph(i / 50, time);
      renderer.setRenderTarget(pipeline.enabled ? pipeline.target : null);
      const ready = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(null);
      await ready;
    }
  }
  THREE.DefaultLoadingManager.onLoad = () => { warmPrograms().catch(() => {}); };
  setTimeout(() => { warmPrograms().catch(() => {}); }, 5000);

  addEventListener('visibilitychange', () => { last = performance.now(); });
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    el('#fallback').hidden = false;
  });

}
