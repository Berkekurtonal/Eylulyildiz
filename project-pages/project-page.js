/* PROJECT PAGES — behaviour shared by every page in dist/projects/<slug>/.

   - Copy and the TR / EN buttons are handled by shared/i18n.js, as on the index.
   - The hero arrives as the sheet that was chosen in the stack (shared/sheet-handoff.js):
     the browser morphs it with a view transition, or, without one, this module
     settles it from where it was.
   - "Projects" returns to the stack itself when it is in this tab's history.
   - ARCHÉ's "Replay journey" returns to the first line of the PaperJourney.
   - Drawings open in a viewer that pans and zooms. */
import '../shared/i18n.js';
import { takeHandoff, recordHandoff, nameSheet, unnameSheets, rememberReturn, quietTransition } from '../shared/sheet-handoff.js';

const root = document.documentElement;
root.classList.remove('pp-translating');

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const modified = e => e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
const hero = document.querySelector('.pp-hero .pp-sheet');
const home = new URL(document.querySelector('.pp-bar__name').href);
const samePath = (a, b) => new URL(a, location.href).pathname === new URL(b, location.href).pathname;

/* ---- arrival: the chosen sheet becomes the hero ------------------------------------------- */
// The page's inline head script reports at `pagereveal` whether the browser is morphing
// the sheet (window.ppReveal = 'transition'). Otherwise the sheet is settled here.
const handoff = takeHandoff();
function arrive() {
  if (!handoff || !root.classList.contains('pp-arriving')) return root.classList.remove('pp-arriving');
  root.classList.remove('pp-arriving');
  const box = hero.getBoundingClientRect();
  const dx = handoff.x - (box.left + box.width / 2), dy = handoff.y - (box.top + box.height / 2);
  hero.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(${handoff.rotation}deg) scale(${handoff.w / box.width})` },
    { transform: 'none' }
  ], { duration: 900, easing: 'cubic-bezier(.22, 1, .36, 1)' });
}
if (window.ppReveal || !('onpagereveal' in window)) arrive();
else addEventListener('pagereveal', () => requestAnimationFrame(arrive), { once: true });

/* ---- leaving: hand a sheet to the next page ----------------------------------------------- */
let chosen = null, replaying = false;
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-neighbour]');
  if (!link || modified(event)) return;
  unnameSheets();
  chosen = link.querySelector('.pp-sheet');
  recordHandoff(chosen, link.href);
  nameSheet(chosen);
});

function heroInView() {
  const box = hero.getBoundingClientRect();
  return box.bottom > innerHeight * .25 && box.top < innerHeight * .75;
}
addEventListener('pageswap', event => {
  quietTransition(event.viewTransition);
  const to = event.activation?.entry?.url;
  if (chosen) {
    if (!event.viewTransition || !to || !samePath(to, chosen.closest('a').href)) unnameSheets();
    return;
  }
  if (!to || !samePath(to, home) || replaying) return;
  // Back to the stack: the sheet this page came from receives the hero again.
  rememberReturn(location.pathname);
  if (event.viewTransition && heroInView()) nameSheet(hero);
});
addEventListener('pageshow', event => {
  if (!event.persisted) return;
  chosen = null; replaying = false;
  unnameSheets();
  root.classList.remove('pp-leaving');
});

/* ---- back to the stack --------------------------------------------------------------------- */
document.querySelectorAll('a[data-stack]').forEach(link => link.addEventListener('click', event => {
  if (modified(event)) return;
  // Prefer the visitor's own place in the stack over a fresh load of the index.
  const nav = window.navigation;
  if (nav?.entries && nav.currentEntry) {
    const earlier = nav.entries().slice(0, nav.currentEntry.index).reverse().find(e => e.url && samePath(e.url, home));
    if (earlier) { event.preventDefault(); nav.traverseTo(earlier.key); return; }
  }
  if (document.referrer && samePath(document.referrer, home) && new URL(document.referrer).origin === location.origin && history.length > 1) {
    event.preventDefault();
    history.back();
  }
}));

/* ---- ARCHÉ: replay the journey from its first line ---------------------------------------- */
document.querySelectorAll('a[data-replay]').forEach(link => link.addEventListener('click', event => {
  if (modified(event)) return;
  event.preventDefault();
  replaying = true;
  // A new navigation, not a history step: the index opens at the top, where the journey begins.
  const go = () => location.assign(link.href);
  if (reduced.matches) return go();
  root.classList.add('pp-leaving');
  setTimeout(go, 460);
}));

/* ---- scroll reveals ------------------------------------------------------------------------ */
const reveals = document.querySelectorAll('.pp-reveal');
if ('IntersectionObserver' in window && !reduced.matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(el => observer.observe(el));
} else reveals.forEach(el => el.classList.add('is-in'));

/* ---- drawing viewer -------------------------------------------------------------------------- */
const dialog = document.querySelector('.pp-inspect');
const stage = dialog.querySelector('.pp-inspect__stage');
const image = dialog.querySelector('.pp-inspect__image');
const caption = dialog.querySelector('.pp-inspect__caption');
let view = { s: 1, x: 0, y: 0 }, size = { w: 1, h: 1 }, fit = 1, figure = null;
const MAX = 2.5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function paint() {
  const W = stage.clientWidth, H = stage.clientHeight, w = size.w * view.s, h = size.h * view.s;
  view.x = w <= W ? (W - w) / 2 : clamp(view.x, W - w, 0);
  view.y = h <= H ? (H - h) / 2 : clamp(view.y, H - h, 0);
  image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
}
function fitView() {
  fit = Math.min(stage.clientWidth / size.w, stage.clientHeight / size.h) * .94;
  view.s = fit;
  paint();
}
function zoomAt(factor, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) {
  const s = clamp(view.s * factor, fit, Math.max(fit, MAX));
  view.x = cx - (cx - view.x) * s / view.s;
  view.y = cy - (cy - view.y) * s / view.s;
  view.s = s;
  paint();
}
function describe() {
  if (!figure) return;
  const text = figure.querySelector('.pp-figure__caption')?.textContent || '';
  const scale = figure.querySelector('.pp-figure__scale')?.textContent;
  caption.textContent = scale ? `${text} · ${scale}` : text;
}
function open(link) {
  figure = link.closest('figure');
  size = { w: +link.dataset.width, h: +link.dataset.height };
  const preview = link.querySelector('img');
  image.style.width = size.w + 'px';
  image.style.height = size.h + 'px';
  image.src = preview.currentSrc || preview.src;
  image.alt = preview.alt;
  describe();
  dialog.showModal();
  root.style.overflow = 'hidden';
  fitView();
  const full = new Image();
  full.src = link.href;
  full.decode().then(() => { if (figure === link.closest('figure')) image.src = link.href; }).catch(() => {});
}
function close() { if (dialog.open) dialog.close(); }
dialog.addEventListener('close', () => { root.style.overflow = ''; figure = null; });

document.querySelectorAll('a[data-inspect]').forEach(link => link.addEventListener('click', event => {
  if (modified(event) || typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  open(link);
}));
dialog.querySelector('[data-close]').addEventListener('click', close);
dialog.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.zoom;
  if (kind === 'fit') fitView(); else zoomAt(kind === 'in' ? 1.5 : 1 / 1.5);
}));
document.addEventListener('languagechange', describe);
addEventListener('resize', () => { if (!dialog.open) return; const wasFit = view.s <= fit * 1.01; if (wasFit) fitView(); else paint(); });

stage.addEventListener('wheel', event => {
  event.preventDefault();
  const r = stage.getBoundingClientRect();
  zoomAt(Math.exp(-event.deltaY * (event.deltaMode === 1 ? .05 : .0016)), event.clientX - r.left, event.clientY - r.top);
}, { passive: false });
stage.addEventListener('dblclick', event => {
  const r = stage.getBoundingClientRect();
  zoomAt(view.s > fit * 1.05 ? fit / view.s : 2.2 * fit < MAX ? 2.2 : MAX / view.s, event.clientX - r.left, event.clientY - r.top);
});

// One pointer pans, two pinch.
const pointers = new Map();
let gesture = null;
stage.addEventListener('pointerdown', event => {
  stage.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  gesture = null;
});
stage.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  const previous = pointers.get(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    view.x += event.clientX - previous.x;
    view.y += event.clientY - previous.y;
    paint();
    return;
  }
  const [a, b] = [...pointers.values()], r = stage.getBoundingClientRect();
  const distance = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
  if (gesture) {
    view.x += mid.x - gesture.mid.x;
    view.y += mid.y - gesture.mid.y;
    zoomAt(distance / gesture.distance, mid.x, mid.y);
  }
  gesture = { distance, mid };
});
const release = event => { pointers.delete(event.pointerId); gesture = null; };
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

dialog.addEventListener('keydown', event => {
  const step = 80;
  const actions = {
    '+': () => zoomAt(1.5), '=': () => zoomAt(1.5), '-': () => zoomAt(1 / 1.5), '0': fitView,
    ArrowLeft: () => { view.x += step; paint(); }, ArrowRight: () => { view.x -= step; paint(); },
    ArrowUp: () => { view.y += step; paint(); }, ArrowDown: () => { view.y -= step; paint(); }
  };
  if (actions[event.key] && !event.target.closest('button')) { event.preventDefault(); actions[event.key](); }
});
