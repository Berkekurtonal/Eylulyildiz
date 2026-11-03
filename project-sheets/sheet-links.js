/* The settled sheets are links to their project pages. A chosen sheet is handed
   to that page (shared/sheet-handoff.js) so it can grow into the page's hero,
   and the sheet a visitor returns from receives the hero back. This module only
   names or measures sheets; it never moves them or touches the scroll. */
import { recordHandoff, nameSheet, unnameSheets, takeReturn, quietTransition } from '../shared/sheet-handoff.js';

export function connectSheetLinks(list) {
  let chosen = null;

  list.addEventListener('click', event => {
    const link = event.target.closest('.ps-sheet__link');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    unnameSheets(list);
    chosen = link.querySelector('.ps-sheet__paper');
    recordHandoff(chosen, link.href);
    nameSheet(chosen);
  });

  addEventListener('pageswap', event => {
    quietTransition(event.viewTransition);
    if (!chosen) return;
    const to = event.activation?.entry?.url;
    if (!event.viewTransition || !to || new URL(to).pathname !== new URL(chosen.closest('a').href).pathname) unnameSheets(list);
  });

  // Back from a project page: its hero returns to the sheet it came from.
  addEventListener('pagereveal', event => {
    unnameSheets(list);
    chosen = null;
    const from = takeReturn();
    if (!event.viewTransition || !from) return;
    const link = [...list.querySelectorAll('.ps-sheet__link')].find(a => new URL(a.href).pathname === from);
    if (!link || link.closest('.ps-sheet').dataset.interactive !== 'true') return;
    nameSheet(link.querySelector('.ps-sheet__paper'));
    const done = () => unnameSheets(list);
    event.viewTransition.finished.then(done, done);
  });

  addEventListener('pageshow', event => { if (event.persisted && !chosen) unnameSheets(list); });
}
