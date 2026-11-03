import '../shared/i18n.js';
import { zoneBounds } from '../shared/scroll-zones.js';
import { smoothNavigationTo } from '../shared/navigation-scroll.js';
import { PANEL_WINDOWS } from '../paper-journey/content-motion.mjs';

// Read the existing chapter timing; never write to the journey or its clock.
const rail = document.querySelector('.signature-rail');
if (rail && !document.documentElement.classList.contains('is-embedded')) start();

function start() {
  const name = rail.querySelector('.signature-rail__name');
  const toggle = rail.querySelector('.signature-rail__toggle');
  const sheet = matchMedia('(max-width: 760px)'); // the rail is a full sheet here: hover must not open it
  const wings = [...rail.querySelectorAll('.signature-rail__wing, .signature-rail__languages')];
  const links = [...rail.querySelectorAll('[data-destination]')];
  const journey = document.querySelector('[data-zone="paper-journey"]');
  const projects = document.querySelector('#projects');
  const studio = document.querySelector('#studio');
  const contact = document.querySelector('#inquiry');
  let open = false;
  let leaveTimer;
  let transitionId = 0;

  function setOpen(value) {
    clearTimeout(leaveTimer);
    if (open === value) return;
    const currentTransition = ++transitionId;
    open = value;
    rail.dataset.closing = String(!value);
    rail.dataset.open = String(value);
    name.setAttribute('aria-expanded', String(value));
    toggle?.setAttribute('aria-expanded', String(value));
    wings.forEach(wing => { wing.inert = !value; });

    if (!value) {
      // Keep the cream surface unblended until all closing pixels disappear.
      // Reopening cancels these transitions; an older completion must not alter
      // the blend mode of a newer close/open cycle.
      const closing = rail.getAnimations({ subtree: true });
      Promise.allSettled(closing.map(animation => animation.finished)).then(() => {
        if (currentTransition === transitionId && !open) rail.dataset.closing = 'false';
      });
    }
  }
  function close() {
    if (wings.some(wing => wing.contains(document.activeElement))) name.focus({ preventScroll: true });
    setOpen(false);
  }

  rail.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && !sheet.matches) setOpen(true);
  });
  rail.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !sheet.matches && !rail.querySelector(':focus-visible')) {
      leaveTimer = setTimeout(close, 100);
    }
  });
  name.addEventListener('click', event => setOpen((event.pointerType === 'mouse' && !sheet.matches) || !open));
  toggle?.addEventListener('click', () => setOpen(!open));
  rail.addEventListener('focusin', event => {
    if (event.target.matches(':focus-visible')) setOpen(true);
  });
  rail.addEventListener('focusout', event => {
    if (!rail.contains(event.relatedTarget)) setOpen(false);
  });
  rail.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!rail.contains(event.target)) close();
  });

  links.forEach(link => link.addEventListener('click', event => {
    // Keep modified clicks as ordinary links; primary activation always scrolls.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = link.dataset.destination;
    close();
    if (destination === 'journey') {
      const zone = zoneBounds(journey);
      const fraction = PANEL_WINDOWS[0].at[1];
      smoothNavigationTo(zone.start + zone.span * fraction);
    }
    else {
      const target = destination === 'projects' ? projects : destination === 'studio' ? studio : contact;
      const clearance = name.getBoundingClientRect().bottom + 18;
      smoothNavigationTo(target.getBoundingClientRect().top + scrollY - clearance);
    }
  }));

  let queued = false;
  function paintActive() {
    queued = false;
    const line = name.getBoundingClientRect().bottom + 20;
    let active = 'journey';
    if (projects.getBoundingClientRect().top <= line) active = 'projects';
    if (studio.getBoundingClientRect().top <= line) active = 'studio';
    if (contact.getBoundingClientRect().top <= line) active = 'contact';
    links.forEach(link => {
      if (link.dataset.destination === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(paintActive); }
  }
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  paintActive();
}
