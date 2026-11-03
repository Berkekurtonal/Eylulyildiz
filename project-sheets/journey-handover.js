/* ══════════════════════════════════════════════════════════════════
   PART 2 of 3 — PROJECTSHEETS · the handover from the journey

   Where the PaperJourney's closing sheet lies on screen, so ProjectSheet01
   can be laid exactly over it.

   Position and size follow from the journey's closing camera (the key at
   t 1 in lib/timeline.js) and its pane rules (resize and pane fit in
   paper-journey.js), all locked. The angle cannot be derived: the camera
   looks almost straight down, so the journey's hand-held drift slowly
   turns the sheet on screen by several degrees. It is measured instead,
   from the frame the journey has just rendered. The journey's canvas is
   only ever read, never written.
   ══════════════════════════════════════════════════════════════════ */

import { SHEET_01, CLOSING_CAMERA } from './sheet-01.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const LOCK = 14;   // least wall-to-paper contrast that counts as having found the sheet

/** The closing sheet's centre and scale (px per metre) in a pane of w × h CSS px. */
export function closingProjection(w, h) {
  const aspect = w / Math.max(1, h);
  const fov = clamp(40 * (aspect < .88 ? .88 / aspect : 1), 34, 58);
  const reach = aspect < 1.05 ? 1 + (1.05 / Math.max(.5, aspect) - 1) * .3025 : 1;
  const [ex, ey, ez] = CLOSING_CAMERA.eye;
  const depth = Math.hypot(ex, ey, ez) * reach + CLOSING_CAMERA.aimAbovePaper;
  const k = (h / 2) / (Math.tan(fov * Math.PI / 360) * depth);
  return { x: w / 2, y: h / 2, k, theta: -Math.atan2(ex, ez) };
}

/**
 * Measures the closing sheet's angle (and a last percent of scale) in the
 * journey's canvas: the walls of the plan are dark and the paper either
 * side of them is light, and only the true angle lines both up.
 * Call it just after the journey has rendered, within the same frame.
 */
export function createSheetTracker(canvas) {
  const capture = document.createElement('canvas');
  const ctx = capture.getContext('2d', { willReadFrequently: true });
  const points = [];
  for (const [w, d, x, z] of SHEET_01.plan.walls) {
    const along = w >= d, length = Math.max(w, d), n = Math.max(2, Math.round(length / .25));
    for (let i = 0; i <= n; i++) {
      const t = -length / 2 + length * i / n;
      const px = along ? x + t : x, pz = along ? z : z + t;
      points.push(along ? [px, pz, px, z - .55, px, z + .55] : [px, pz, x - .55, pz, x + .55, pz]);
    }
  }
  let theta = null, scale = 1;

  function measure(projection, w, h) {
    const cw = 320, ch = Math.max(2, Math.round(cw * h / w));
    if (capture.width !== cw || capture.height !== ch) { capture.width = cw; capture.height = ch; }
    try {
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(canvas, 0, 0, cw, ch);
    } catch { return null; }
    const data = ctx.getImageData(0, 0, cw, ch).data;
    const u = cw / w, ox = projection.x * u, oy = projection.y * u;
    const lum = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 1 || y < 1 || x >= cw - 1 || y >= ch - 1) return -1;
      const i = (y * cw + x) * 4;
      return data[i + 3] ? data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114 : -1;
    };
    const score = (th, sc) => {
      const k = projection.k * u * sc, c = Math.cos(th) * k, s = Math.sin(th) * k;
      let sum = 0, n = 0;
      for (const [x, z, ax, az, bx, bz] of points) {
        const dark = lum(ox + x * c - z * s, oy + x * s + z * c);
        const a = lum(ox + ax * c - az * s, oy + ax * s + az * c);
        const b = lum(ox + bx * c - bz * s, oy + bx * s + bz * c);
        if (dark < 0 || a < 0 || b < 0) continue;
        sum += (a + b) / 2 - dark;
        n++;
      }
      return n > points.length * .5 ? sum / n : -Infinity;
    };
    const sweep = (from, to, step, sc) => {
      let best = -Infinity, at = from;
      for (let th = from; th <= to + 1e-9; th += step) {
        const v = score(th, sc);
        if (v > best) { best = v; at = th; }
      }
      return [at, best];
    };

    let [th, best] = theta === null ? [0, -Infinity] : sweep(theta - .05, theta + .05, .005, scale);
    if (best < LOCK) [th, best] = sweep(-.6, .6, .01, 1);
    [th, best] = sweep(th - .008, th + .008, .001, scale);
    let sc = scale;
    for (const s of [.98, .99, 1, 1.01, 1.02]) {
      const v = score(th, s);
      if (v > best) { best = v; sc = s; }
    }
    if (best < LOCK) return null;
    theta = th;
    scale = sc;
    return { theta, scale, contrast: best };
  }

  return { measure };
}
