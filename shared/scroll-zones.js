/* ══════════════════════════════════════════════════════════════════
   SHARED — scroll zones

   The immersive section is divided into named, invisible zones
   (`[data-zone]`), one per scroll-driven part:

     data-zone="paper-journey"   Part 1, the locked 3D sequence
     data-zone="project-sheets"  Part 2, the paper stack that continues it

   Each part reads only the fraction of its own zone. No part knows how
   long another part is, and the EditorialSite that follows can grow
   freely without retiming either of them.
   ══════════════════════════════════════════════════════════════════ */

const clamp01 = x => Math.min(1, Math.max(0, x));

/** Pure: how far through a zone [start, start + span] a scroll position is. */
export function fractionOf(scroll, start, span) {
  return clamp01((scroll - start) / Math.max(1, span));
}

/** A zone's document-space bounds, in CSS px. */
export function zoneBounds(zone) {
  const r = zone.getBoundingClientRect();
  const start = r.top + scrollY;
  return { start, span: r.height, end: start + r.height };
}

/** 0 before the zone, 1 once it has been scrolled past. */
export function zoneFraction(zone) {
  const b = zoneBounds(zone);
  return fractionOf(scrollY, b.start, b.span);
}

/** Whether the page is currently scrolled within the zone. */
export function zoneContains(zone, slack = 1) {
  const b = zoneBounds(zone);
  return scrollY >= b.start - slack && scrollY <= b.end + slack;
}

/** Scroll to a fraction of a zone. */
export function scrollToZone(zone, fraction, instant = false) {
  const b = zoneBounds(zone);
  scrollTo({ top: b.start + clamp01(fraction) * b.span, behavior: instant ? 'instant' : 'smooth' });
}

/** Scroll to the end of the zone after this one, or out of the immersive section. */
export function scrollBeyond(zone, instant = false) {
  let next = zone.nextElementSibling;
  while (next && !next.hasAttribute('data-zone')) next = next.nextElementSibling;
  if (next) return scrollToZone(next, 1, instant);
  const host = zone.parentElement.getBoundingClientRect();
  scrollTo({ top: host.bottom + scrollY - innerHeight, behavior: instant ? 'instant' : 'smooth' });
}
