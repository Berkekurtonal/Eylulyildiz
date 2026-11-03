// One asymmetrical arrangement inside the pinned viewport. Later papers overlap
// portions of earlier ones; their positions never form a row or a vertical pile.
export const LAYOUT = {
  wide: [
    { x: .25, y: .22, w: .42, ratio: 1.4545, r: -2.8 },
    { x: .63, y: .20, w: .24, ratio: .82, r: 2.2, from: [.35, -.4], turn: 3 },
    { x: .78, y: .40, w: .39, ratio: 1.45, r: -1.8, from: [.6, .1], turn: 3 },
    { x: .17, y: .65, w: .26, ratio: .95, r: 2.6, from: [-.55, .2], turn: -3 },
    { x: .46, y: .48, w: .40, ratio: 1.45, r: -1.2, from: [-.1, .55], turn: 2 },
    { x: .46, y: .82, w: .32, ratio: 1.15, r: 2.4, from: [-.4, .5], turn: -3 },
    { x: .77, y: .81, w: .33, ratio: 1.45, r: -1.6, from: [.4, .5], turn: 3 }
  ],
  tall: [
    { x: .30, y: .19, w: .57, ratio: 1.04, r: -2.5 },
    { x: .76, y: .22, w: .43, ratio: .82, r: 2, from: [.8, -.15], turn: 3 },
    { x: .35, y: .42, w: .62, ratio: 1.45, r: -2, from: [-.9, .2], turn: -3 },
    { x: .80, y: .62, w: .37, ratio: .8, r: 2.4, from: [.9, .15], turn: 3 },
    { x: .27, y: .56, w: .53, ratio: 1.4, r: -1.8, from: [-.9, .3], turn: -3 },
    { x: .29, y: .83, w: .50, ratio: 1.04, r: 2, from: [-.6, .5], turn: -2 },
    { x: .72, y: .84, w: .51, ratio: 1.4, r: -2.2, from: [.8, .4], turn: 3 }
  ]
};
export function stageFor(w, h) {
  const tall = w / h < .9;
  const sw = tall ? Math.min(w * .94, h * .62) : Math.min(1360, w * .92, h * 1.48);
  return { tall, x: (w - sw) / 2, y: h * .08, w: sw, h: h * .84 };
}
