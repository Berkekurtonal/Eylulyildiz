// Global navigation only. Existing scene scroll helpers and clocks stay untouched.
let cancelTravel = () => {};

// CSS cubic-bezier(.22, 1, .36, 1): solve its time axis before reading progress.
function navigationEase(t) {
  if (t <= 0 || t >= 1) return t;
  let low = 0, high = 1;
  for (let i = 0; i < 16; i++) {
    const u = (low + high) / 2, v = 1 - u;
    const x = 3 * v * v * u * .22 + 3 * v * u * u * .36 + u * u * u;
    if (x < t) low = u;
    else high = u;
  }
  return 1 - (1 - (low + high) / 2) ** 3;
}

export function smoothNavigationTo(top) {
  cancelTravel();
  const from = scrollY;
  const to = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
  const distance = to - from;
  if (Math.abs(distance) < 1) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const travelFraction = Math.min(1, Math.abs(distance) / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  const duration = reduced ? 180 : 1800 + 800 * travelFraction;
  let frame, started;
  const cancel = () => {
    cancelAnimationFrame(frame);
    removeEventListener('wheel', cancel);
    removeEventListener('touchstart', cancel);
    removeEventListener('pointerdown', cancel);
    removeEventListener('keydown', onKey);
    cancelTravel = () => {};
  };
  const onKey = event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape'].includes(event.key)) cancel();
  };
  cancelTravel = cancel;
  addEventListener('wheel', cancel, { passive: true });
  addEventListener('touchstart', cancel, { passive: true });
  addEventListener('pointerdown', cancel, { passive: true });
  addEventListener('keydown', onKey);
  function tick(time) {
    started ??= time;
    const t = Math.min(1, (time - started) / duration);
    const eased = navigationEase(t);
    // Immediate individual frames form one continuous, bidirectional travel.
    // Native smooth scroll can be disabled by browser/OS settings.
    scrollTo({ top: from + distance * eased, behavior: 'instant' });
    if (t < 1) frame = requestAnimationFrame(tick);
    else cancel();
  }
  frame = requestAnimationFrame(tick);
}
