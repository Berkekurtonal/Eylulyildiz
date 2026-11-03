// Complete model → true overhead → source technical sheet → reading hold.
export const ENDING = Object.freeze({ completeHold: [0, .18], camera: [.18, .66],
  topDownHold: [.66, 1], technical: [.69, .84], technicalHold: [.84, 1] });
export function endingAt(f) {
  const t = Math.max(0, Math.min(1, (f - ENDING.camera[0]) / (ENDING.camera[1] - ENDING.camera[0])));
  return t * t * (3 - 2 * t);
}
export function technicalAt(f) {
  const t = Math.max(0, Math.min(1, (f - ENDING.technical[0]) / (ENDING.technical[1] - ENDING.technical[0])));
  return t * t * (3 - 2 * t);
}
// Wide views include the full source paper. Portrait views frame the complete
// building footprint more closely, keeping the architecture readable on phones.
// The whole pose is raised 30% so a margin of desk stays around the sheet.
// Coordinates are local to ProjectOrigin, just like the construction camera.
export function topDownCamera(aspect, fov) {
  const half = Math.tan(fov * Math.PI / 360);
  const [halfWidth, halfDepth] = aspect < .9 ? [7.4, 6.4] : [12.8, 8.6];
  const height = (Math.max(halfWidth / (half * aspect), halfDepth / half) * 1.12 + 4.8) * 1.3;
  return { eye: [.65, height, .1], aim: [.65, 0, .1], up: [0, 0, -1] };
}
