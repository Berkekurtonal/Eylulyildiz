/* ══════════════════════════════════════════════════════════════════
   PART 2 of 3 — PROJECTSHEETS · ProjectSheet01

   The PaperJourney's closing bird's-eye sheet, as data. Every value is
   traced from paper-journey/lib/plan.js (WALLS, FOOTPRINTS, DIMENSIONS and
   sheetTexture) and lib/timeline.js (PAPER_SIZE, the closing camera);
   project-sheets.test.mjs fails if they drift apart. This sheet is not a
   placeholder: it must stay identical to the 3D sheet it continues from.
   ══════════════════════════════════════════════════════════════════ */

/** Local metres the sheet texture maps onto (lib/timeline.js). */
export const PAPER_SIZE = [24, 16.5];

export const SHEET_01 = {
  label: 'The Still House, ground floor plan',
  title: 'THE STILL HOUSE',
  lines: ['GROUND FLOOR PLAN', '1 : 50   /   A1   /   SHEET 04', 'EYLÜL YILDIZ  ·  INTERIOR ARCHITECTURE'],
  plan: {
    // [width, depth, centreX, centreZ]
    walls: [
      [12.0, .22, 0, -4.5], [.22, 9.0, -6, 0], [.22, 2.9, 6, -3.05], [.22, 2.1, 6, 3.45],
      [3.6, .22, -4.2, 4.5], [2.6, .22, 4.7, 4.5], [3.3, .18, -4.35, .55], [.18, 2.2, -2.75, 1.65], [1.9, .18, 4.95, -1.4]
    ],
    // [x, z, width, depth]
    furniture: [
      [-1.15, -2.95, 4.0, 1.55], [-1.15, -1.45, 1.45, 1.35], [-.35, -.75, 1.9, 1.0], [3.05, -.35, 1.15, 1.2],
      [-5.85, -1.75, .85, 3.3], [-5.6, 1.9, 2.4, 1.9], [-2.6, -3.35, 6.9, 4.6]
    ],
    details: {
      rects: [
        [-1.05, -2.85, 1.2, .55], [.25, -2.85, 1.2, .55], [1.55, -2.85, 1.2, .55],
        [-5.26, 1.52, .42, .4], [-3.96, 1.52, .42, .4], [-5.26, 3.88, .42, .4], [-3.96, 3.88, .42, .4]
      ],
      lines: [[-5.85, -1.2, -5.0, -1.2], [-5.85, -.65, -5.0, -.65], [-5.85, -.1, -5.0, -.1], [-5.85, .45, -5.0, .45], [-5.85, 1.0, -5.0, 1.0]],
      circles: [[.6, -.25, .34]]
    },
    // [hingeX, hingeZ, radius, fromDeg, toDeg, leafX, leafZ]
    doors: [[-2.4, 4.5, 1.6, -90, 0, -2.4, 2.9]],
    // [x1, z1, x2, z2, label]
    dimensions: [[-6, 5.35, 6, 5.35, '12 000'], [6.35, -4.5, 6.35, 4.5, '9 000'], [-6, -5.35, -2.7, -5.35, '3 300']],
    labels: [['LIVING', 1.3, -1.95], ['DINING', -4.4, 1.35], ['ENTRY', .5, 3.9]],
    north: [6.35, -5.5]
  }
};

/**
 * The journey's closing camera, in ProjectOrigin metres at full scale
 * (lib/timeline.js, the key at t 1). The look-at point lies SLAB + .004 m
 * above the paper (lib/timeline.js originAt).
 */
export const CLOSING_CAMERA = { eye: [.02, 20.20, .60], aimAbovePaper: .224 };
