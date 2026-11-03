import * as THREE from '../vendor/three.module.js';
import {
  roundedBox, planarUV, drawnTexture, ribbonGeometry, rectSegments, mergeGeometries
} from './core.js';
import { illustrated, contour, INK, studioPlate } from './illustration.js';
import { PAPER_DESK, PAPER_SIZE, S0 } from './timeline.js';

/* ------------------------------------------------------------------ *
 *  THE ATELIER — world space
 *
 *  The desk, its tools and the atelier shell. The sheet itself is NOT
 *  here: it belongs to ProjectOrigin, and simply rests on this desk at
 *  the start. Nothing architectural lives in the studio either — the
 *  only building in the scene is the one on that sheet.
 *
 *  Placement rule: every object that stands above the desk top sits
 *  outside the sheet, far enough out that the sheet is already above
 *  it by the time the growing sheet reaches it (timeline.test.mjs
 *  checks this against the positions used below).
 * ------------------------------------------------------------------ */

// 2.5 m: the west end, under her hands and the bowl, stays where it was; the
// east end stops just past the sheet, with the tools on a strip beside it.
const DESK = { x: -.25, z: 9.0, w: 2.5, d: 1.42, top: .75 };
// Wall centre lines. The camera path stays inside: x < 2.7, z < 11.7, y < 4.1.
const ROOM = { west: -3.6, east: 3.6, north: 6.4, south: 12.5, height: 4.2, wall: .26 };
const WINDOW = { z0: 7.7, z1: 9.7, sill: .62, head: 2.9, transom: 2.3 };

function standard(colour, roughness, metalness = 0, extra = {}) {
  return illustrated(colour, 'studio', extra);
}

function place(parent, geometry, material, p, r, s) {
  const m = new THREE.Mesh(geometry, material);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A cylinder between two points, for articulated lamp parts. */
function rod(parent, material, a, b, radius) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const dir = to.clone().sub(from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 12), material);
  m.position.copy(from).addScaledVector(dir, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Static pieces drawn once per material instead of once each: meshes under
 * `root` that share a material, shadow flags and outline width are baked into
 * one geometry, and their outline is rebuilt on the result. The image is the
 * same; the draw calls, paid twice when the shadow map redraws, are not.
 * Subtrees listed in `keep` stay as they are. */
function batchStatic(root, keep = []) {
  root.updateWorldMatrix(true, true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse(o => {
    if (o.isMesh && o.name !== 'SilhouetteInk' && !keep.some(k => k !== root && k.getObjectById(o.id))) meshes.push(o);
  });
  const batches = new Map();
  for (const mesh of meshes) {
    const ink = mesh.children.find(c => c.name === 'SilhouetteInk');
    const width = ink ? ink.material.uniforms.uWidth.value : 0;
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, width].join('|');
    if (!batches.has(key)) batches.set(key, { mesh, width, parts: [] });
    batches.get(key).parts.push(mesh.geometry.clone().applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld)));
  }
  meshes.forEach(m => m.removeFromParent());
  for (const { mesh, width, parts } of batches.values()) {
    const merged = new THREE.Mesh(parts.length > 1 ? mergeGeometries(parts) : parts[0], mesh.material);
    merged.castShadow = mesh.castShadow;
    merged.receiveShadow = mesh.receiveShadow;
    root.add(merged);
    if (width) contour(merged, 'studio', width);
  }
}

export function buildStudio() {
  const group = new THREE.Group();

  // Solid swatches behave like inks, with no simulated grain or gloss.
  const deskWood = standard(INK.cobalt, 1);
  const darkWood = standard(INK.deep, 1);
  const paper = standard(INK.paper, 1);
  const brass = standard(INK.mist, 1);
  const steel = standard(INK.deep, 1);
  // Walls, floor and rug are planes of light, not objects: no form step.
  const shellMat = standard(INK.paper, 1, 0, { form: 0 });

  /* ---- studio floor ------------------------------------------------ */
  const ground = place(group, planarUV(new THREE.PlaneGeometry(ROOM.east - ROOM.west, ROOM.south - ROOM.north), .1),
    standard(INK.mist, 1, 0, { transparent: true, form: 0 }),
    [(ROOM.west + ROOM.east) / 2, 0, (ROOM.north + ROOM.south) / 2], [-Math.PI / 2, 0, 0]);
  ground.castShadow = false;
  ground.name = 'StudioFloor';

  /* ---- the desk ---------------------------------------------------- */
  const desk = new THREE.Group();
  desk.name = 'Desk';
  desk.position.set(DESK.x, 0, DESK.z);
  group.add(desk);

  place(desk, planarUV(roundedBox(DESK.w, .052, DESK.d, .006), .42), deskWood, [0, DESK.top - .026, 0]);
  place(desk, planarUV(roundedBox(DESK.w - .5, .065, .045, .004), .42), darkWood, [0, .635, -DESK.d / 2 + .16]);
  place(desk, planarUV(roundedBox(DESK.w - .5, .065, .045, .004), .42), darkWood, [0, .635, DESK.d / 2 - .16]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) place(desk, planarUV(roundedBox(.052, .70, .052, .003), .42), deskWood,
      [sx * (DESK.w / 2 - .38), .35, sz * .48], [0, 0, sx * -.025]);
    place(desk, planarUV(roundedBox(.062, .045, 1.06, .004), .42), darkWood, [sx * (DESK.w / 2 - .38), .20, 0]);
  }

  // A fine drawn arris defines the desk as a graphic plane, not a glossy edge.
  const deskRule = place(desk, ribbonGeometry(rectSegments(-DESK.w/2+.008,
    -DESK.d/2+.008, DESK.w-.016, DESK.d-.016), .003, DESK.top+.0005),
    standard(INK.mist, 1));
  deskRule.castShadow = deskRule.receiveShadow = false;

  // an earlier sheet, half tucked under the drawing, so the desk has a history
  const [pw, ph] = [PAPER_SIZE[0] * S0 * .92, PAPER_SIZE[1] * S0 * .92];
  place(desk, new THREE.PlaneGeometry(pw, ph), paper,
    [PAPER_DESK[0] - DESK.x - .13, DESK.top + .0016, PAPER_DESK[2] - DESK.z - .05], [-Math.PI / 2, 0, .06])
    .castShadow = false;

  /* Everything standing on the desk above the sheet's plane. Switched off
   * as one group once it is off screen and dark, before the sheet grows. */
  const props = new THREE.Group();
  props.name = 'DeskProps';
  desk.add(props);

  /* ---- material samples -------------------------------------------- */
  [[INK.paper, .92, 0], [INK.cobalt, .86, 0], [INK.mist, .98, 0], [INK.blue, .95, 0], [INK.deep, .6, .6]]
    .forEach((s, i) => {
      place(props, roundedBox(.155, .008, .155, .002), standard(s[0], s[1], s[2]),
        [-1.14 + (i % 2) * .175, DESK.top + .004 + (i === 4 ? .008 : 0), -.36 + Math.floor(i / 2) * .175],
        [0, (i * .37) % .3 - .15, 0]);
    });

  /* ---- ceramic bowl ------------------------------------------------ */
  // A low curved cup on one small foot, outlined at its continuous lip.
  const bowlProfile = [[0,0],[.024,0],[.032,.004],[.032,.008],[.021,.016],
    [.023,.023],[.043,.030],[.066,.043],[.087,.062],[.104,.082],
    [.105,.085],[.101,.087],[.098,.083],[.083,.064],[.064,.047],
    [.040,.035],[.020,.030],[0,.030]].map(p=>new THREE.Vector2(...p));
  const bowl=place(props,new THREE.LatheGeometry(bowlProfile,64),standard(INK.paper,1),
    [-1.12,DESK.top+.002,.3]);
  contour(bowl,'studio',.55);
  place(bowl,new THREE.TorusGeometry(.102,.0012,6,64),standard(INK.mist,1),[0,.085,0],[Math.PI/2,0,0]);

  /* ---- book stack -------------------------------------------------- */
  [INK.blue, INK.deep, INK.paper].forEach((c, i) => {
    const book = new THREE.Group();
    book.position.set(-1.13 + i * .012, DESK.top + .015 + i * .030, -.60);
    book.rotation.y = .13 - i * .09; props.add(book);
    place(book, roundedBox(.252, .022, .178, .001), paper, [.002, 0, 0]);
    for (const sign of [-1, 1]) place(book, roundedBox(.264, .0025, .19, .001), standard(c, .98), [0, sign * .012, 0]);
    place(book, roundedBox(.004, .027, .19, .001), standard(c, .98), [-.13, 0, 0]);
  });

  /* ---- pencil cup, beyond the sheet's north-west corner ------------ */
  const cup = new THREE.Group();
  cup.position.set(-.72, DESK.top + .003, -.58);
  props.add(cup);
  place(cup, new THREE.CylinderGeometry(.042, .038, .105, 24, 1, true), standard(INK.paper, .82), [0, .052, 0])
    .material.side = THREE.DoubleSide;
  place(cup, new THREE.CylinderGeometry(.038, .038, .006, 24), standard(INK.deep, .9), [0, .004, 0]);
  place(cup,new THREE.TorusGeometry(.041,.0013,6,40),standard(INK.mist,1),[0,.105,0],[Math.PI/2,0,0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    place(cup, new THREE.CylinderGeometry(.0045, .0045, .19, 7), standard(i % 3 ? INK.deep : INK.paper, .55),
      [Math.cos(a) * .019, .13, Math.sin(a) * .019], [Math.sin(a) * .18, 0, -Math.cos(a) * .18]);
  }

  /* ---- scale ruler and set square, just off the sheet's south edge -- */
  const ruler = new THREE.Group(); ruler.position.set(-.32, DESK.top + .006, .56);
  ruler.rotation.y = .22; props.add(ruler);
  place(ruler, roundedBox(.35, .011, .025, .002), standard(INK.mist, .65, .45), [0, 0, 0]);
  const scaleInk = standard(INK.deep, .95);
  for (let i = 0; i <= 7; i++) place(ruler, new THREE.BoxGeometry(.0009, .0004, i % 2 ? .006 : .011),
    scaleInk, [-.165 + i * .047, .0058, -.005]);
  const tri = new THREE.Shape();
  tri.moveTo(0, 0); tri.lineTo(.26, 0); tri.lineTo(0, .19); tri.lineTo(0, 0);
  const cutout = new THREE.Path();
  cutout.moveTo(.027, .025); cutout.lineTo(.027, .140); cutout.lineTo(.185, .025); cutout.closePath();
  tri.holes.push(cutout);
  place(props, new THREE.ExtrudeGeometry(tri, { depth: .004, bevelEnabled: false }),
    standard(INK.mist, .62, 0, { transparent: true, opacity: .68, depthWrite: false }),
    [.87, DESK.top + .006, .63], [-Math.PI / 2, 0, .5]);

  /* ---- rolled drawings, lengthwise along the desk's east edge ------- */
  const rolledPaper = standard(INK.paper, .98, 0, { side: THREE.DoubleSide });
  for (let i = 0; i < 2; i++) {
    place(props, new THREE.CylinderGeometry(.025, .027, .67 - i * .06, 36, 1, true), rolledPaper,
      [1.15 + i * .015, DESK.top + .027 + i * .049, .27 + i * .03], [Math.PI / 2 + .03 * i, 0, .06 * i]);
  }

  /* ---- model-making: cutting mat, card offcuts, scalpel ------------ *
   *  Tools, not architecture. The only building is the one on the sheet. */
  place(props, roundedBox(.42, .003, .34, .001), standard(INK.deep, .8), [.99, DESK.top + .0015, -.25]).castShadow = false;
  [[.87, -.31, .09, .05, .2], [.97, -.17, .06, .11, -.4], [1.11, -.33, .12, .04, .9]].forEach(([x, z, w, d, r]) => {
    place(props, roundedBox(w, .004, d, .001), standard(INK.paper, .9), [x, DESK.top + .005, z], [0, r, 0]);
  });
  place(props, new THREE.CylinderGeometry(.004, .004, .15, 8), steel, [1.13, DESK.top + .008, -.15], [0, .5, Math.PI / 2]);

  /* ---- task lamp, low and outboard, reaching in toward the sheet ---- */
  // In the desk's north-east corner, just outside the opening frame's edge.
  const lampBase = new THREE.Vector3(.9, DESK.top, 8.38);
  const lampHead = new THREE.Vector3(.76, 1.15, 8.55);
  const toSheet = new THREE.Vector3(PAPER_DESK[0], PAPER_DESK[1], PAPER_DESK[2]).sub(lampHead).normalize();
  const lamp = new THREE.Group();
  lamp.name = 'Lamp';
  props.add(lamp);
  lamp.position.set(-DESK.x, 0, -DESK.z);          // author the lamp in world coordinates
  place(lamp, new THREE.CylinderGeometry(.085, .095, .022, 28), steel, [lampBase.x, lampBase.y + .011, lampBase.z]);
  const elbow = [lampBase.x, lampBase.y + .32, lampBase.z];
  rod(lamp, steel, [lampBase.x, lampBase.y, lampBase.z], elbow, .012);
  rod(lamp, steel, elbow, [lampHead.x, lampHead.y + .02, lampHead.z], .011);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.028, .088, .12, 26, 1, true), brass);
  shade.material.side = THREE.DoubleSide;
  shade.position.copy(lampHead);
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), toSheet);
  shade.castShadow = true;
  lamp.add(shade);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.082, 26), new THREE.MeshBasicMaterial({ color: new THREE.Color(INK.paper) }));
  glow.userData.base = glow.material.color.clone();
  glow.position.copy(lampHead).addScaledVector(toSheet, .058);
  glow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), toSheet);
  lamp.add(glow);

  const bulb = new THREE.PointLight(INK.paper, 0, 4.4, 2.1);
  bulb.position.copy(lampHead).addScaledVector(toSheet, .05);
  group.add(bulb);

  /* ---- atelier room ------------------------------------------------- *
   *  A plastered room closed on four sides, so the desk reads at room
   *  scale. The west wall carries one window on the opening camera's
   *  sightline, behind her shoulder: it gives chapter 01 its light source
   *  and silhouette, and explains the light mass from the west. Room
   *  surfaces cast no shadow, so the key reaches the desk and figure
   *  exactly as before; furnishings inside the room still cast.        */
  const shell = new THREE.Group();
  shell.name = 'AtelierShell';
  group.add(shell);
  const shellSteel = standard(INK.deep, 1);
  const { west, east, north, south, height: H, wall: T } = ROOM;
  const midX = (west + east) / 2, midZ = (north + south) / 2;
  const spanX = east - west + T, spanZ = south - north + T;
  const Wall = (w, h, d, x, y, z) => {
    const m = place(shell, planarUV(new THREE.BoxGeometry(w, h, d), .28), shellMat, [x, y, z]);
    m.castShadow = false;
    return m;
  };
  Wall(spanX, H, T, midX, H / 2, north);
  Wall(spanX, H, T, midX, H / 2, south);
  Wall(T, H, spanZ, east, H / 2, midZ);
  // the west wall, cut around the window
  const { z0, z1, sill, head, transom } = WINDOW;
  const ww = z1 - z0, wz = (z0 + z1) / 2, wh = head - sill;
  Wall(T, H, z0 - north + T / 2, west, H / 2, (north - T / 2 + z0) / 2);
  Wall(T, H, south + T / 2 - z1, west, H / 2, (z1 + south + T / 2) / 2);
  // Sill and head pieces overlap the jambs: coplanar faces take the same
  // ink, and the overlap closes the hairline crack along each joint.
  Wall(T, sill, ww + .1, west, sill / 2, wz);
  Wall(T, H - head, ww + .1, west, (H + head) / 2, wz);
  // The ceiling faces down only: the overhead cameras look through it.
  place(shell, new THREE.PlaneGeometry(spanX, spanZ), shellMat, [midX, H, midZ], [Math.PI / 2, 0, 0])
    .castShadow = false;

  /* ---- the window ---------------------------------------------------- */
  const view = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    map: drawnTexture(448, 512, (c, W, Hgt) => {
      const sky = c.createLinearGradient(0, 0, 0, Hgt);
      sky.addColorStop(0, INK.paper);
      sky.addColorStop(.45, INK.paper);
      sky.addColorStop(.62, INK.mist);
      sky.addColorStop(1, INK.mist);
      c.fillStyle = sky;
      c.fillRect(0, 0, W, Hgt);
      // A far tree line and a nearer canopy below eye level, kept pale so her
      // head and shoulder still read as a silhouette against the glass.
      const canopy = (y, r, colour, alpha) => {
        c.globalAlpha = alpha;
        c.fillStyle = colour;
        c.beginPath();
        for (let x = -r; x < W + r; x += r * 1.15) {
          const top = y + Math.sin(x * .061) * r * .4;
          c.moveTo(x + r, top);
          c.arc(x, top, r, 0, Math.PI * 2);
        }
        c.rect(0, y, W, Hgt - y);
        c.fill();
      };
      canopy(Hgt * .6, 16, INK.blue, .26);
      canopy(Hgt * .76, 34, INK.blue, .3);
      c.globalAlpha = 1;
    })
  });
  // Like the walls, the window casts nothing: without a wall shadow around
  // it, its bars would only stripe the desk and the plan chapter.
  const opening = new THREE.Group();
  shell.add(opening);
  place(opening, new THREE.PlaneGeometry(ww, wh), view, [west - .03, sill + wh / 2, wz], [0, Math.PI / 2, 0]);
  const bar = (w, h, d, x, y, z) => place(opening, new THREE.BoxGeometry(w, h, d), shellSteel, [x, y, z]);
  for (const z of [z0 + .03, z0 + ww / 3, z0 + 2 * ww / 3, z1 - .03]) bar(.08, wh, .05, west, sill + wh / 2, z);
  for (const y of [sill + .03, transom, head - .03]) bar(.08, .05, ww, west, y, wz);
  place(opening, planarUV(roundedBox(.2, .035, ww + .16, .004), .8), standard(INK.paper, 1),
    [west + T / 2 + .07, sill + .018, wz]);

  // A linen curtain gathered on the south side, outside the assembly
  // camera's frame; its folds band through the inks.
  const folds = new THREE.PlaneGeometry(.52, head + .1, 30, 1);
  const fp = folds.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(fp.getX(i) / .52 * Math.PI * 7) * .03);
  folds.computeVertexNormals();
  place(opening, folds, standard(INK.paper, 1, 0, { side: THREE.DoubleSide }),
    [west + T / 2 + .08, (head + .1) / 2 + .02, z1 + .2], [0, Math.PI / 2, 0]);
  rod(opening, shellSteel, [west + T / 2 + .08, head + .16, z0 - .2], [west + T / 2 + .08, head + .16, z1 + .55], .012);
  opening.traverse(o => { o.castShadow = false; });

  /* ---- furnishings ---------------------------------------------------- */
  // A flat-woven rug under the desk and chair. It lies below the painted
  // feet (y .008), and its paler ink sets it apart from the floor in light.
  const rugY = .004;
  place(shell, new THREE.PlaneGeometry(3.3, 3.0), standard(INK.paper, 1, 0, { paperCoverage: .45, form: 0 }),
    [-.5, rugY, 9.45], [-Math.PI / 2, 0, 0]).castShadow = false;
  place(shell, ribbonGeometry(rectSegments(-2.0, 8.1, 3.0, 2.7), .03, rugY + .002),
    standard(INK.deep, 1, 0, { paperCoverage: 0, form: 0 })).castShadow = false;

  /* ---- monstera, in the window's light beside the curtain ------------- */
  // Heart-shaped blade, petiole at the origin, tip along +y: slits run from
  // the edge toward the midrib. Two flat halves fold up along the midrib, so
  // each half takes one ink; a bent single blade would band into stripes.
  function monsteraLeaf(L, W, material) {
    const at = u => [W / 2 * Math.pow(Math.sin(Math.PI * (.12 + .88 * u)), .7), L * (1.1 * u - .1)];
    const slits = [.28, .42, .56, .7];
    const leaf = new THREE.Group();
    for (const side of [1, -1]) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, slit = slits.find(v => Math.abs(u - v) < 1 / 80);
        if (slit === undefined) { const [x, y] = at(u); s.lineTo(side * x, y); continue; }
        const [xa, ya] = at(slit - .022), [xb, yb] = at(slit + .022);
        s.lineTo(side * xa, ya); s.lineTo(side * W * .08, at(slit)[1] + L * .06); s.lineTo(side * xb, yb);
      }
      const half = place(leaf, new THREE.ShapeGeometry(s, 6), material, null, [0, -side * .28, 0]);
      half.receiveShadow = false; // two-sided blades would catch their own shadow-map acne
      contour(half, 'studio', .45);
    }
    return leaf;
  }
  const plant = new THREE.Group();
  plant.position.set(west + 1.0, 0, z1 + .8);
  shell.add(plant);
  const potProfile = [[0, 0], [.15, 0], [.17, .04], [.2, .4], [.215, .42], [.21, .44], [.19, .43], [0, .43]]
    .map(p => new THREE.Vector2(...p));
  contour(place(plant, new THREE.LatheGeometry(potProfile, 48), standard(INK.paper, 1)), 'studio', .55);
  place(plant, new THREE.CylinderGeometry(.23, .21, .025, 40), standard(INK.paper, 1), [0, .0125, 0]);
  place(plant, new THREE.CircleGeometry(.19, 40), standard(INK.deep, 1), [0, .432, 0], [-Math.PI / 2, 0, 0]);
  const leafMat = standard(INK.blue, 1, 0, { side: THREE.DoubleSide }), stemMat = standard(INK.deep, 1);
  // [direction about y, elevation, reach, stem height, blade length, width].
  // Blades lean toward the wall, away from her chair, so their faces turn to
  // the opening camera and the slit heart shape reads.
  [[1.55, 1.05, .12, 1.05, .5, .43], [2.3, .8, .16, .85, .45, .4], [1.0, .85, .15, .9, .43, .38],
    [1.8, 1.3, .05, 1.2, .4, .35], [2.8, .6, .18, .7, .38, .33], [.6, .55, .14, .72, .36, .31],
    [1.3, .45, .2, .62, .34, .29]].forEach(([az, elev, reach, h, L, W]) => {
    const top = [-Math.sin(az) * reach, h, -Math.cos(az) * reach];
    rod(plant, stemMat, [0, .4, 0], top, .009);
    const pivot = new THREE.Group();
    pivot.position.set(...top);
    pivot.rotation.y = az;
    plant.add(pivot);
    const leaf = monsteraLeaf(L, W, leafMat);
    leaf.rotation.x = -(Math.PI / 2 - elev);
    pivot.add(leaf);
  });

  /* ---- lilies and chrysanthemums on the sill, against the glass ------- */
  // One small vase at the sill's south end, clear of her head.
  const vase = new THREE.Group();
  vase.position.set(west + T / 2 + .07, sill + .035, z1 - .22);
  shell.add(vase);
  const flowerMat = standard(INK.paper, 1, 0, { side: THREE.DoubleSide });
  const vaseProfile = [[0, 0], [.045, 0], [.06, .05], [.058, .11], [.035, .17], [.032, .19], [.04, .205],
    [.036, .208], [.028, .19]].map(p => new THREE.Vector2(...p));
  contour(place(vase, new THREE.LatheGeometry(vaseProfile, 40), flowerMat), 'studio', .55);
  const toward = (bloom, dir) => bloom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  // Lily: a trumpet whose rim splits into six recurved petals.
  const trumpet = [[0, 0], [.006, 0], [.01, .03], [.018, .06], [.036, .09], [.06, .11], [.075, .115]]
    .map(p => new THREE.Vector2(...p));
  const lily = new THREE.LatheGeometry(trumpet, 36), lp = lily.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), z = lp.getZ(i), v = y / .115;
    const petal = Math.abs(Math.cos(3 * Math.atan2(z, x))), k = 1 - .55 * (1 - petal) * v * v;
    lp.setXYZ(i, x * k, y - .025 * petal * v ** 4, z * k);
  }
  lily.computeVertexNormals();
  [[.03, .5, .07], [-.03, .57, -.04], [.06, .44, -.07]].forEach(top => {
    rod(vase, stemMat, [0, .18, 0], top, .004);
    const bloom = place(vase, lily, flowerMat, top);
    toward(bloom, new THREE.Vector3(top[0] + .5, top[1] - .1, top[2] + .4));
    contour(bloom, 'studio', .45);
  });
  // Chrysanthemum: a frilled ball, every vertex pushed out by its own amount.
  const mum = new THREE.IcosahedronGeometry(.046, 2), mp = mum.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(mp, i);
    const n = Math.sin(v.x * 431 + v.y * 197 + v.z * 283) * .5 + .5;
    v.multiplyScalar(1 + .3 * n);
    mp.setXYZ(i, v.x, v.y * .8, v.z);
  }
  mum.computeVertexNormals();
  [[-.05, .38, .05], [.04, .35, -.02], [0, .42, .1]].forEach(top => {
    rod(vase, stemMat, [0, .18, 0], top, .004);
    contour(place(vase, mum, flowerMat, top), 'studio', .45);
  });

  /* ---- a low cabinet on the north wall --------------------------------- */
  // Box files, a few books and a card study of stacked blocks: an abstract
  // massing exercise, not a building. The only building is on the sheet.
  const cabinet = new THREE.Group();
  cabinet.position.set(-.8, 0, north + T / 2 + .21);
  shell.add(cabinet);
  const cabinetMat = standard(INK.paper, 1);
  contour(place(cabinet, planarUV(roundedBox(1.3, .66, .4, .01), .5), cabinetMat, [0, .39, 0]), 'studio', .55);
  place(cabinet, roundedBox(1.24, .06, .34, .004), stemMat, [0, .03, -.01]);
  place(cabinet, roundedBox(1.36, .035, .43, .004), cabinetMat, [0, .74, .005]);
  for (const x of [-.217, .217]) place(cabinet, new THREE.BoxGeometry(.006, .58, .004), stemMat, [x, .39, .2]);
  for (const x of [-.25, .19, .25]) place(cabinet, new THREE.CylinderGeometry(.008, .008, .02, 10), stemMat,
    [x, .5, .205], [Math.PI / 2, 0, 0]);
  const top = .7575;
  const label = new THREE.MeshBasicMaterial({ color: '#efe9dc' });
  // The card study sits at the west end, the end the opening camera sees.
  place(cabinet, roundedBox(.34, .012, .24, .002), cabinetMat, [-.42, top + .006, 0]);
  // [x, base above the board, z, width, height, depth]: two stacked, one beside
  [[-.46, 0, -.02, .2, .06, .14], [-.42, .06, .01, .12, .1, .1], [-.3, 0, -.04, .07, .16, .07]]
    .forEach(([x, base, z, w, h, d]) => contour(place(cabinet, new THREE.BoxGeometry(w, h, d), cabinetMat,
      [x, top + .012 + base + h / 2, z]), 'studio', .45));
  for (let i = 0; i < 4; i++) {
    const file = place(cabinet, roundedBox(.075, .3, .25, .004), standard(i % 2 ? INK.blue : INK.cobalt, 1),
      [-.12 + i * .08, top + .15, -.03], [0, 0, i === 3 ? -.12 : 0]);
    place(file, new THREE.PlaneGeometry(.045, .08), label, [0, .06, .126]).castShadow = false;
  }
  [INK.paper, INK.blue, INK.deep].forEach((c, i) => place(cabinet, roundedBox(.24, .03, .18, .002),
    standard(c, 1), [.36 + i * .006, top + .015 + i * .03, .02], [0, .1 - i * .12, 0]));

  // Material reference boards on the existing sample plinth, now in the corner.
  place(shell, planarUV(roundedBox(.42, 1.02, .42, .01), .8), standard(INK.mist, .9), [-2.75, .51, 6.95]);
  place(shell, planarUV(roundedBox(.28, .34, .024, .003), 1.5),
    standard(INK.paper, 1), [-2.78, 1.19, 6.95], [-.10, .15, -.08]);
  place(shell, planarUV(roundedBox(.20, .25, .018, .002), 1.5),
    standard(INK.blue, 1), [-2.67, 1.145, 6.99], [.08, -.12, .09]);

  // Her other projects, pinned to the north wall and framed thinly: EDENA,
  // Beyond the Self and LOS PLATOS DE FRIDA as faint cobalt prints, small
  // enough to read as plans without becoming legible.
  const prints = new THREE.TextureLoader();
  const print = file => {
    const material = new THREE.MeshBasicMaterial({ color: '#efe9dc' });
    prints.load(new URL('../assets/' + file, import.meta.url).href, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture; material.color.set('#ffffff'); material.needsUpdate = true;
    });
    return material;
  };
  [[-2.5, 1.78, .58, .78, 'wall-edena.jpg'], [-1.8, 1.96, .46, .34, 'wall-beyond-the-self.jpg'],
    [-1.8, 1.52, .46, .34, 'wall-los-platos.jpg']].forEach(([x, y, w, h, file]) => {
    const z = north + T / 2;
    const frame = place(shell, roundedBox(w, h, .028, .004), shellSteel, [x, y, z + .014]);
    contour(frame, 'studio', .5);
    place(shell, new THREE.PlaneGeometry(w - .06, h - .06), print(file), [x, y, z + .029]).castShadow = false;
  });

  /* ---- contact shadows ---------------------------------------------------- *
   *  A top-down occlusion map of the floor: soft pools under the desk and
   *  where each leg, the cabinet, the plinth and the pot meet the floor. The
   *  studio plates read it, along with the room's walls for corner shading. */
  const contact = drawnTexture(432, 366, (c, Wpx, Hpx) => {
    const px = x => (x - west) / (east - west) * Wpx, py = z => (1 - (z - north) / (south - north)) * Hpx;
    const metre = Wpx / (east - west);
    c.fillStyle = '#000';
    c.fillRect(0, 0, Wpx, Hpx);
    const rect = (x0, z0, x1, z1, alpha, blur) => {
      c.filter = `blur(${blur}px)`;
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      c.fillRect(px(x0), py(z1), px(x1) - px(x0), py(z0) - py(z1));
    };
    const disc = (x, z, r, alpha, blur) => {
      c.filter = `blur(${blur}px)`;
      c.fillStyle = `rgba(255,255,255,${alpha})`;
      c.beginPath(); c.arc(px(x), py(z), r * metre, 0, Math.PI * 2); c.fill();
    };
    // under the desk top, then each leg
    rect(DESK.x - DESK.w / 2 + .1, DESK.z - DESK.d / 2 + .1, DESK.x + DESK.w / 2 - .1, DESK.z + DESK.d / 2 - .1, .32, 16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) disc(DESK.x + sx * (DESK.w / 2 - .38), DESK.z + sz * .48, .04, .85, 3);
    // cabinet and plinth against the north wall
    const cx = cabinet.position.x;
    rect(cx - .7, north, cx + .7, north + T / 2 + .5, .3, 14);
    rect(cx - .65, north, cx + .65, north + T / 2 + .42, .85, 5);
    rect(-3.1, 6.6, -2.4, 7.3, .3, 12);
    rect(-2.96, 6.74, -2.54, 7.16, .85, 5);
    // the pot
    disc(plant.position.x, plant.position.z, .32, .3, 12);
    disc(plant.position.x, plant.position.z, .23, .8, 5);
  }, false);
  studioPlate.occlusion.value = contact;
  studioPlate.occlusionRect.value.set(west, north, east, south);
  studioPlate.room.value.set(west + T / 2, north + T / 2, east - T / 2, south - T / 2);

  // Selective contours on furniture and tools, not on every wall triangle.
  const outlined = [];
  desk.traverse(o => { if(o.isMesh && o.geometry.attributes.position.count > 100) outlined.push(o); });
  outlined.forEach(o => contour(o, 'studio', .55));
  batchStatic(shell);
  batchStatic(props);
  batchStatic(desk, [props]);
  group.userData = { shell, lamp: bulb, lampGlow: glow, ground, desk, props };
  return group;
}
