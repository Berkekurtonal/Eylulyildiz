// The original hold → dissolve → recede → sequential arrivals, in one pin.
// The settled stack closes it: a short hold, then the pin releases into Studio.
export const WINDOWS = Object.freeze({
  hold: [0, .033], dissolve: [.033, .088], recede: [.088, .274],
  sheets: [.274, .888], settle: [.888, .932], finalHold: [.932, 1]
});
const clamp01 = x => Math.min(1, Math.max(0, x));
export const ramp = (a, b, x) => clamp01((x - a) / (b - a));
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
export function stackAt(f) {
  return {
    dissolve: easeInOut(ramp(...WINDOWS.dissolve, f)),
    recede: easeInOut(ramp(...WINDOWS.recede, f))
  };
}
export function sheetWindow(i, n) {
  const [a, b] = WINDOWS.sheets, each = (b - a) / n;
  return [a + i * each, a + (i + 1) * each];
}
export function sheetAt(f, i, n) {
  const [a, b] = sheetWindow(i, n);
  // Finish the arrival early enough to read each sheet before the next arrives.
  return easeInOut(ramp(a, a + (b - a) * .72, f));
}
