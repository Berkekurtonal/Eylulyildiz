/* ══════════════════════════════════════════════════════════════════
   PART 3 of 3 — EDITORIALSITE

   Plain document behaviour for the sections after the sticky pin:
   entry reveals, the header's active section and tone, the inquiry
   form, and the way back to the first line. It reads no scroll zone
   and imports nothing from the PaperJourney.
   ══════════════════════════════════════════════════════════════════ */

import { text, onLanguageChange } from '../shared/i18n.js';

const site = document.querySelector('#editorial-site');
const embedded = document.documentElement.classList.contains('is-embedded');

if (site && !embedded) start();

function start() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- reveals ------------------------------------------------------ */
  const reveals = [...site.querySelectorAll('.es-reveal')];
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: .06 });
  reveals.forEach(el => observer.observe(el));

  /* ---- header: current section and tone ----------------------------- */
  const header = site.querySelector('.es-header');
  const links = [...header.querySelectorAll('.es-nav a[href^="#"]')];
  const targets = links.map(a => document.querySelector(a.getAttribute('href')));
  const darkBands = [...site.querySelectorAll('[data-tone="dark"]')].filter(el => el !== header);

  let queued = false;
  function paintHeader() {
    queued = false;
    const line = header.getBoundingClientRect().bottom;
    if (line > innerHeight) return;           // still below the fold: nothing to mark
    const under = y => el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; };
    header.dataset.tone = darkBands.some(under(line - header.offsetHeight / 2)) ? 'dark' : 'light';
    let active = -1;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top <= line + innerHeight * .35) active = i; });
    links.forEach((a, i) => {
      if (i === active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paintHeader); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  paintHeader();

  /* ---- every project: the preview frame follows the row in use -------- */
  const previews = [...site.querySelectorAll('.es-work__preview img')];
  site.querySelectorAll('.es-work__row').forEach((row, i) => {
    const show = () => previews.forEach((img, n) => img.classList.toggle('is-active', n === i));
    row.addEventListener('pointerenter', show);
    row.addEventListener('focus', show);
  });

  /* ---- inquiry: composes an email in the visitor's own mail app ------ */
  const form = site.querySelector('#inquiry-form');
  if (form) {
    const status = form.querySelector('.es-form__status');
    let composed = false;
    const paintStatus = () => {
      if (composed) status.textContent = text('Your email app should open with this message written out. If nothing happens, write to {email}.', { email: form.dataset.mailto });
    };
    onLanguageChange(paintStatus);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const value = name => String(new FormData(form).get(name) || '').trim();
      const to = form.dataset.mailto;
      const type = text(value('type')), place = value('place'), timing = text(value('timing'));
      const subject = text('Website inquiry') + (type ? ' — ' + type : '') + (place ? ', ' + place : '');
      const lines = [value('message'), '', '—', text('Name') + ': ' + value('name'), text('Email') + ': ' + value('email')];
      if (type) lines.push(text('Subject') + ': ' + type);
      if (place) lines.push(text('Location') + ': ' + place);
      if (timing) lines.push(text('Timing') + ': ' + timing);
      const href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
      composed = true;
      paintStatus();
      location.href = href;
    });
  }

  /* ---- back to the first line ---------------------------------------- */
  site.querySelectorAll('[data-to-top]').forEach(b => b.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  }));

  const year = site.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
}
