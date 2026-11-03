/* SHARED — one paper sheet carried from page to page.

   A sheet chosen in the ProjectSheets stack (or a neighbour sheet at the foot
   of a project page) becomes the next page's hero. Where the browser supports
   cross-document view transitions (shared/page-transition.css), both papers
   carry the same `view-transition-name` and the browser morphs one into the
   other. Otherwise (the arriving page decides at `pagereveal`) the new page
   starts its hero on the recorded geometry and settles it itself
   (project-pages/project-page.js). Reduced motion skips both. */

export const SHEET_NAME = 'project-sheet';
export const HANDOFF_KEY = 'eylul-sheet-handoff';
export const RETURN_KEY = 'eylul-sheet-return';
const FRESH_MS = 8000;

function store(key, value) {
  try { value == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage denied: no handoff, plain navigation. */ }
}
function load(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

/** Rotation (deg) and scale of an element, including all ancestor transforms. */
export function sheetTransform(el) {
  let m = new DOMMatrix();
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    const t = getComputedStyle(node).transform;
    if (t && t !== 'none') m = new DOMMatrix(t).multiply(m);
  }
  return { rotation: Math.atan2(m.b, m.a) * 180 / Math.PI, scale: Math.hypot(m.a, m.b) };
}

/** Remember where `paper` sits on screen for the page at `href`. */
export function recordHandoff(paper, href) {
  const box = paper.getBoundingClientRect(), { rotation, scale } = sheetTransform(paper);
  const w = paper.offsetWidth * scale, h = paper.offsetHeight * scale;
  store(HANDOFF_KEY, {
    path: new URL(href, location.href).pathname,
    x: box.left + box.width / 2, y: box.top + box.height / 2,
    w, h, ratio: w / h, rotation, at: Date.now()
  });
}

/** A transition the next page declines is skipped; that is not an error. */
export function quietTransition(transition) {
  if (!transition) return;
  transition.ready.catch(() => {});
  transition.finished.catch(() => {});
  transition.updateCallbackDone?.catch(() => {});
}

/** The recorded handoff for this page, if it is recent. */
export function takeHandoff(path = location.pathname) {
  const record = load(HANDOFF_KEY);
  store(HANDOFF_KEY, null);
  return record && record.path === path && Date.now() - record.at < FRESH_MS ? record : null;
}

export const rememberReturn = path => store(RETURN_KEY, { path, at: Date.now() });
export function takeReturn() {
  const record = load(RETURN_KEY);
  store(RETURN_KEY, null);
  return record && Date.now() - record.at < FRESH_MS ? record.path : null;
}

export function nameSheet(el) { if (el) el.style.viewTransitionName = SHEET_NAME; }
export function unnameSheets(root = document) {
  root.querySelectorAll('[style*="view-transition-name"]').forEach(el => { el.style.viewTransitionName = ''; });
}
