/* The post-ARCHÉ sequence, in the original shared sticky viewport.
   The live closing image becomes sheet 01. PDF sheets 02–07 accumulate above it.
   This module only reads the journey's canvas and pane bounds. */
import { zoneFraction } from '../shared/scroll-zones.js';
import { onLanguageChange, text } from '../shared/i18n.js';
import { WINDOWS, stackAt, sheetAt } from './sheets-timeline.js';
import { JOURNEY_SHEET, JOURNEY_PLAN, PROJECT_SHEETS } from './project-sheets.data.js';
import { LAYOUT, stageFor } from './sheets-layout.js';
import { createClosingCapture } from './closing-capture.js';
import { connectSheetLinks } from './sheet-links.js';

const root = document.querySelector('#project-sheets');
const zone = document.querySelector('[data-zone="project-sheets"]');
if (root && zone && !document.documentElement.classList.contains('is-embedded')) start();

function start() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pane = document.querySelector('.paper-journey .viewport');
  const list = root.querySelector('[data-project-sheets]');
  const lerp = (a, b, t) => a + (b - a) * t;
  const sheets = [JOURNEY_SHEET, ...PROJECT_SHEETS].map((data, i) => {
    const li = document.createElement('li');
    li.className = 'ps-sheet' + (i === 0 ? ' ps-sheet--origin' : '');
    li.dataset.sheet = data.number;
    // Each settled sheet opens its project page (project-pages/, built from shared data).
    const link = document.createElement('a');
    link.className = 'ps-sheet__link'; link.href = data.href;
    link.setAttribute('aria-labelledby', `project-number-${data.number} project-title-${data.number}`);
    link.tabIndex = -1; li.inert = true;
    const paper = document.createElement('figure');
    paper.className = 'ps-sheet__paper';
    const heading = document.createElement('figcaption');
    heading.className = 'ps-sheet__heading';
    const number = document.createElement('span');
    number.className = 'ps-sheet__number'; number.textContent = data.number;
    number.id = `project-number-${data.number}`;
    const title = document.createElement('h2');
    title.className = 'ps-sheet__title'; title.textContent = data.title;
    title.id = `project-title-${data.number}`;
    heading.append(number, title);
    const visual = document.createElement('div'); visual.className = 'ps-sheet__visual';
    const image = document.createElement(i === 0 ? 'canvas' : 'img');
    let drawing = image;
    if (i === 0) {
      image.setAttribute('role', 'img'); image.setAttribute('aria-label', 'ARCHÉ');
    } else {
      image.alt = text(data.image.alt); image.decoding = 'async';
    }
    visual.append(image);
    if (i === 0) {
      // The captured frame hands over pixel for pixel, then gives way to the plan.
      const plan = document.createElement('img');
      plan.className = 'ps-sheet__plan'; plan.alt = '';
      plan.decoding = 'async'; plan.setAttribute('aria-hidden', 'true');
      visual.append(plan);
      drawing = plan;
    }
    paper.append(heading, visual); link.append(paper); li.append(link); list.append(li);
    return { li, link, paper, image, drawing, src: i === 0 ? JOURNEY_PLAN.src : data.image.src, alt: data.image?.alt };
  });

  // The drawings are seen only after the whole journey. Fetched at start, they
  // took half the opening download from the journey's own textures; now they
  // load shortly after the page (textures included) has loaded, or as soon as
  // the stack comes within a few screens, whichever is first. Not on idle: the
  // journey renders every frame, so an idle callback may never come.
  let fetched = false;
  function fetchDrawings() {
    if (fetched) return;
    fetched = true;
    sheets.forEach(s => { s.drawing.src = s.src; });
  }
  const nearStack = () => zone.getBoundingClientRect().top < innerHeight * 4;
  if (document.readyState === 'complete') fetchDrawings();
  else addEventListener('load', () => setTimeout(fetchDrawings, 1000), { once: true });

  let geo, target = zoneFraction(zone), shown = target, raf = 0, last = 0;
  let captured = false, capture, captureUntil = 0, capturePending = false;
  function requestCapture() {
    captureUntil = performance.now() + 2600;
    if (capturePending || target <= 0) return;
    capturePending = true;
    // Register after the journey's own frame; read the rendered buffer in-frame.
    setTimeout(() => requestAnimationFrame(takeCapture), 0);
  }
  function takeCapture() {
    if (target <= 0 || document.hidden) { capturePending = false; return; }
    const source = pane?.querySelector('canvas');
    if (source && pane.getAttribute('data-ending-ready') === 'true') {
      capture ||= createClosingCapture(source, sheets[0].image);
      // The ready frame is final, so one read is enough. Every read waits for
      // the GPU to drain; repeating it every 100 ms stalled the handover.
      if (capture()) { captured = true; paint(shown); capturePending = false; return; }
    }
    if (performance.now() < captureUntil) {
      setTimeout(() => requestAnimationFrame(takeCapture), 100);
    } else capturePending = false;
  }

  function measure() {
    const box = root.getBoundingClientRect();
    const rect = pane?.getBoundingClientRect() || box;
    const stage = stageFor(box.width, box.height);
    geo = {
      pane: { x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height },
      slots: (stage.tall ? LAYOUT.tall : LAYOUT.wide).map(slot => ({
        x: stage.x + slot.x * stage.w, y: stage.y + slot.y * stage.h,
        w: slot.w * stage.w, h: slot.w * stage.w / slot.ratio, r: slot.r,
        dx: (slot.from?.[0] || 0) * box.width,
        dy: (slot.from?.[1] || 0) * box.height, turn: slot.turn || 0
      }))
    };
  }
  function place(sheet, x, y, w, h, r, opacity, interactive) {
    sheet.li.style.width = w + 'px'; sheet.li.style.height = h + 'px';
    sheet.li.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,0) rotate(${r}deg)`;
    sheet.li.style.opacity = opacity;
    sheet.li.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    sheet.li.setAttribute('aria-hidden', String(opacity === 0));
    // Only settled papers can receive pointer or keyboard input. Rewinding
    // removes departing sheets from the tab order without changing the scroll.
    sheet.li.dataset.interactive = String(interactive);
    sheet.li.inert = !interactive;
    sheet.link.tabIndex = interactive ? 0 : -1;
  }
  function paint(f) {
    if (!geo) return;
    const s = stackAt(f), slot = geo.slots[0], origin = geo.pane;
    const r = reduced.matches && f > WINDOWS.dissolve[1] ? 1 : s.recede;
    // Never cover the live ARCHÉ with an empty snapshot.
    root.style.setProperty('--veil', captured ? s.dissolve : 0);
    sheets[0].paper.style.setProperty('--recede', r);
    place(sheets[0], lerp(origin.x + origin.w / 2, slot.x, r),
      lerp(origin.y + origin.h / 2, slot.y, r),
      lerp(origin.w, slot.w, r), lerp(origin.h, slot.h, r), slot.r * r,
      captured ? s.dissolve : 0, captured && r === 1);
    for (let i = 1; i < sheets.length; i++) {
      const slot = geo.slots[i], p = sheetAt(f, i - 1, PROJECT_SHEETS.length);
      const travel = reduced.matches ? 0 : 1 - p;
      place(sheets[i], slot.x + travel * slot.dx, slot.y + travel * slot.dy,
        slot.w, slot.h, slot.r + travel * slot.turn, captured ? Math.min(1, p * 3) : 0,
        captured && p === 1);
    }
    root.dataset.phase = f <= 0 ? 'idle' : f >= 1 ? 'released' : 'playing';
  }
  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    shown = reduced.matches ? target : shown + (target - shown) * (1 - Math.exp(-9 * dt));
    if (Math.abs(target - shown) < 1e-4) shown = target;
    paint(shown); raf = shown === target ? 0 : requestAnimationFrame(frame);
  }
  function kick() {
    if (!fetched && nearStack()) fetchDrawings();
    const before = target; target = zoneFraction(zone);
    if (target > 0 && (before <= 0 || !captured)) requestCapture();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  new ResizeObserver(() => { measure(); paint(shown); requestCapture(); }).observe(root);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  addEventListener('visibilitychange', () => { if (!document.hidden) requestCapture(); });
  reduced.addEventListener('change', kick);
  onLanguageChange(requestCapture);
  onLanguageChange(() => sheets.forEach(s => { if (s.alt) s.image.alt = text(s.alt); }));
  connectSheetLinks(list);
  if (nearStack()) fetchDrawings();
  measure(); paint(shown); requestCapture();
}

