/* ══════════════════════════════════════════════════════════════════
   MASTER TIMELINE

   Pure functions of one scroll value. No DOM and no three.js, so the
   ordering rules of the journey can be asserted in a plain Node test
   (timeline.test.mjs) rather than trusted to eyeballing.

   Two clocks are derived from the scroll fraction T (0…1):

     b  story clock for the opening sequence, 0 at the architect and
        1 standing at the threshold of the finished interior.
     c  chapter coordinate 0…6, used by the copy column and by the
        later chapters, whose timing is unchanged.

   ProjectOrigin
   The paper, the drawing, the slab, the walls and the interior are all
   children of one transform. At rest it sits on the architect's desk at
   scale S0, which is exactly the scale the plan is drawn at on the sheet.
   It never jumps and never leaves the desk: it grows continuously to 1
   in place, and the camera is expressed in the project's own local
   space, so the drawing stays pinned on screen while the world changes
   size around it.
   ══════════════════════════════════════════════════════════════════ */

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---- scroll allocation ------------------------------------------- *
 * The opening four chapters get 52% of the page: the paper-to-space
 * transformation is the reason the page exists. Chapters 04–07 keep
 * even spacing after that.                                          */
export const T04 = .52;
export const ANCHORS = [0, .30 * T04, .60 * T04, T04, T04 + (1 - T04) / 3, T04 + 2 * (1 - T04) / 3, 1];

export const story = T => clamp(T / T04, 0, 1);

export function chapterCoord(T) {
  T = clamp(T, 0, 1);
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (T <= ANCHORS[i + 1]) return i + (T - ANCHORS[i]) / (ANCHORS[i + 1] - ANCHORS[i]);
  }
  return ANCHORS.length - 1;
}

/* ---- the project on the desk ------------------------------------- */
export const S0 = .05;                     // 24 local m of paper -> 1.2 m sheet (about A0)
export const SLAB = .22;                   // local thickness the floor emerges to
export const PAPER_SIZE = [24, 16.5];      // local metres; the sheet texture maps 1:1 onto this
// World centre of the sheet, resting on the desk. Its south-west corner is
// fixed at (-.71, 9.537), so her drawing hand stays on the paper.
export const PAPER_DESK = [-.11, .754, 9.125];

/* ---- phase windows, in story time b ------------------------------ */
export const W = {
  hold: [0, .12],          // architect establishment
  approach: [.12, .34],    // dolly to the sheet, then settle
  lineIn: [.34, .38],      // printed ink gains a 3D twin, exactly coincident
  lineDepth: [.36, .44],   // lines acquire height and start to read as geometry
  slab: [.40, .50],        // the floor separates from the paper, 0 -> 22 local cm
  walls: { start: .46, step: .011, length: .10 },   // every wall standing by .648
  furniture: [.58, .70],
  studioDark: [.555, .645],// lamp off; the studio falls into shadow as the camera closes in
  studioFade: [.60, .655], // shell and desk props dissolve while peripheral and dark
  studioAway: .66,         // switched off only once dark, dissolved and off screen
  scale: [.68, .84],       // only once the architecture fills the frame
  realMaterial: [.70, .86],// card model -> built materials
  paperFade: [.74, .88],   // the sheet's print steps back once the building exists
  lineSettle: [.74, .88],  // raised lines settle to junction lines
  // studio key -> project daylight. Finished before W.studioAway, so the
  // studio no longer casts onto the sheet when it is switched off
  light: [.555, .645],
  quiet: [.88, .98],
  outside: [.92, 1],
  ceiling: [.93, .99]
};

/* Perimeter clockwise from the north wall, then the partitions. */
export const WALL_ORDER = [0, 5, 1, 2, 4, 3, 7, 8, 6];

export function wallRise(index, b) {
  const start = W.walls.start + W.walls.step * WALL_ORDER[index];
  return smooth(start, start + W.walls.length, b);
}

/* Exponential in time, so the perceived rate of growth is constant. */
export function scaleAt(b) {
  return S0 * Math.exp(Math.log(1 / S0) * smooth(W.scale[0], W.scale[1], b));
}

/* The sheet never leaves the desk. It grows in place about its own centre.
 * The studio is not cleared by moving the paper: by the time the sheet
 * starts to grow, the camera has closed in on the model, the studio has
 * fallen into shadow, and everything standing above the sheet has been
 * switched off while off screen. The desk itself lies just beneath the
 * paper, so the growing sheet simply covers it.                        */
export function originAt(b) {
  const s = scaleAt(b);
  const paperY = PAPER_DESK[1];
  return { s, paperY, position: [PAPER_DESK[0], paperY + (SLAB + .004) * s, PAPER_DESK[2]] };
}

export const studioAway = b => b >= W.studioAway;

export const toWorld = (local, o) => [
  o.position[0] + local[0] * o.s, o.position[1] + local[1] * o.s, o.position[2] + local[2] * o.s
];

const REST = originAt(0);
const atRest = world => [0, 1, 2].map(i => (world[i] - REST.position[i]) / S0);

/* Visual centre of the project: on the paper, then rising with the walls. */
export function focusY(b) {
  return -SLAB + (1.25 + SLAB) * smooth(.44, .72, b);
}

/* ---- camera, in ProjectOrigin local space ------------------------ */

/* Monotone cubic (Fritsch–Butland) per component. Continuous velocity
 * through every key, zero velocity at holds, and no overshoot — which is
 * what guarantees the dolly can never carry the camera past the sheet. */
function tangents(ts, ys) {
  const n = ys.length, m = new Array(n).fill(0), h = [], d = [];
  for (let k = 0; k < n - 1; k++) { h[k] = ts[k + 1] - ts[k]; d[k] = (ys[k + 1] - ys[k]) / h[k]; }
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] === 0 || d[k] === 0 || Math.sign(d[k - 1]) !== Math.sign(d[k])) continue;
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

export class Track {
  constructor(keys) {
    this.t = keys.map(k => k[0]);
    this.v = keys.map(k => k[1]);
    this.m = this.v[0].map((_, c) => tangents(this.t, this.v.map(v => v[c])));
  }
  sample(t, out = []) {
    const T = this.t, n = T.length, dim = this.v[0].length;
    if (t <= T[0] || t >= T[n - 1]) {
      const v = this.v[t <= T[0] ? 0 : n - 1];
      for (let c = 0; c < dim; c++) out[c] = v[c];
      return out;
    }
    let k = 0;
    while (t > T[k + 1]) k++;
    const h = T[k + 1] - T[k], u = (t - T[k]) / h, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = 3 * u2 - 2 * u3, h11 = u3 - u2;
    for (let c = 0; c < dim; c++) {
      out[c] = h00 * this.v[k][c] + h10 * h * this.m[c][k] + h01 * this.v[k + 1][c] + h11 * h * this.m[c][k + 1];
    }
    return out;
  }
}

const RAD = Math.PI / 180;
/* Orbit about the project focus: yaw 0 is south of the drawing looking north. */
function orbit(pitch, yaw, dist, b) {
  const p = pitch * RAD, y = yaw * RAD, fy = focusY(b);
  return [[Math.sin(y) * Math.cos(p) * dist, fy + Math.sin(p) * dist, Math.cos(y) * Math.cos(p) * dist], [0, fy, 0]];
}

const early = (b, [eye, aim]) => ({ t: b * T04, eye, aim });
const world = (b, eye, aim) => early(b, [atRest(eye), atRest(aim)]);

const KEYS = [
  // 01 — over her shoulder; the sheet already sits in the lit pool
  world(0,   [1.85, 1.66, 11.10], [-.60, 1.00, 9.50]),
  world(.12, [1.85, 1.66, 11.10], [-.60, 1.00, 9.50]),
  // 02 — dolly past her shoulder toward that sheet and nowhere else
  world(.20, [1.00, 1.80, 10.70], [-.10, .86, 9.25]),
  world(.27, [.45, 2.20, 10.40], [.06, .78, 9.04]),
  // settle: the sheet fills the pane, plan-like but still in perspective
  early(.34, orbit(60, 0, 34, .34)),
  early(.42, orbit(58, 2, 33, .42)),
  // 03 — walls rise from the lines; the camera turns about the focus and
  // closes in, so the architecture fills the frame before anything grows
  early(.52, orbit(54, 6, 30, .52)),
  // swinging east, away from her side, takes her hand out of frame before
  // anything above the sheet is switched off at W.studioAway
  early(.62, orbit(49, 19, 23.5, .62)),
  early(.68, orbit(47, 20, 23.5, .68)),// scale begins: the model already dominates
  early(.76, orbit(44, 19, 25, .76)),  // the project is growing around the camera
  early(.84, orbit(41, 18, 27, .84)),  // human scale reached
  // 04 — only now does the camera travel toward the architecture
  { t: .92 * T04, eye: [5.4, 6.2, 14.0], aim: [.3, 1.1, .8] },
  { t: T04, eye: [3.5, 1.9, 6.6], aim: [-.4, 1.3, -1.8] },
  { t: ANCHORS[4], eye: [1.15, 1.86, -.20], aim: [0, 1.86, -4.40] },
  { t: ANCHORS[5], eye: [6.20, 8.60, 8.20], aim: [0, .40, -.30] },
  { t: 1, eye: [.02, 20.20, .60], aim: [0, 0, 0] }
];

const eyeTrack = new Track(KEYS.map(k => [k.t, k.eye]));
const aimTrack = new Track(KEYS.map(k => [k.t, k.aim]));

export function cameraLocal(T) {
  const b = story(T);
  const eye = eyeTrack.sample(clamp(T, 0, 1));
  const aim = aimTrack.sample(clamp(T, 0, 1));
  // Screen lock: across the whole transformation the look-at is the
  // ProjectFocus itself, so the drawing's centre cannot slide.
  const pin = smooth(.30, .34, b) * (1 - smooth(.84, .90, b));
  aim[0] = lerp(aim[0], 0, pin);
  aim[1] = lerp(aim[1], focusY(b), pin);
  aim[2] = lerp(aim[2], 0, pin);
  return { eye, aim, pin };
}
