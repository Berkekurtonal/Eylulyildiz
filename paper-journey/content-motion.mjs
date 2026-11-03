import { ANCHORS, T04, W, smooth } from './lib/timeline.js';

// Presentation windows only, on the existing 0…1 journey clock. The third
// introduction anticipates its chapter so the walls rise with no overlay.
// Each row is [enter, readable, release, gone], independent of scroll speed.
export const PANEL_WINDOWS = [
  { side: 'right', at: [.010, .023, .043, W.approach[0] * T04] },
  { side: 'left',  at: [.100, .120, .166, .184] },
  { side: 'left',  at: [.191, .204, .220, W.walls.start * T04 - .002] },
  { side: 'left',  at: [ANCHORS[3] - .008, ANCHORS[3] + .010, .585, .621] },
  { side: 'left',  at: [.646, .670, .720, .758] },
  { side: 'left',  at: [.786, .807, .839, .871] },
  { side: 'right', at: [.886, .908, .951, .979] }
];

const ease = (a, b, t) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export function contentAt(t) {
  const index = PANEL_WINDOWS.findIndex(({at:[a,,,d]}) => t > a && t < d);
  let amount = 0, side = 'left';
  if (index >= 0) {
    const window = PANEL_WINDOWS[index], [a,b,c,d] = window.at;
    amount = ease(a,b,t) * (1-ease(c,d,t)); side = window.side;
  }
  // Wayfinding also steps away during the transformation and closing hold.
  const reveal = smooth(.218, .238, t) * (1-smooth(.496, .512, t));
  const ending = smooth(.967, .988, t);
  return { index, amount, side, chrome: (1-reveal)*(1-ending) };
}
