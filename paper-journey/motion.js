// Preserve fractional scroll positions, including across chapter boundaries.
// The explicitly requested cinematic mode must not quantize to still frames.
export function advanceProgress(current, target, seconds) {
  const destination = Math.max(0, Math.min(6, target));
  const delta = Math.max(0, Math.min(.05, seconds));
  return current + (destination - current) * (1 - Math.exp(-5.5 * delta));
}
