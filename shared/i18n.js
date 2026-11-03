import { translations } from './translations.js';

export const LANGUAGE_KEY = 'eylul-language';
export const supportedLanguages = ['tr', 'en'];
const browser = typeof document !== 'undefined';
function savedLanguage() {
  try { return localStorage.getItem(LANGUAGE_KEY); } catch { return null; }
}
let language = browser && supportedLanguages.includes(savedLanguage()) ? savedLanguage() : 'tr';
const listeners = new Set();
const bindings = [];
let anchorFrame = 0;
let originalAnchoring = '';
let heldPageHeight = false;
export const getLanguage = () => language;
export const getContent = () => translations[language];
export function text(source, variables = {}) {
  return (translations[language].copy[source] ?? source).replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
}
export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Bind existing text nodes, preserving markup, controls, focus and animation hosts.
// No translated copy is injected into unrelated animation code.
export function bindCopy(root = document) {
  const dictionary = translations.en.copy;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script,style,noscript,[data-language]')) continue;
    const original = node.nodeValue, source = original.trim().replace(/\s+/g, ' ');
    if (!Object.hasOwn(dictionary, source)) continue;
    const leading = original.match(/^\s*/)[0], trailing = original.match(/\s*$/)[0];
    bindings.push(() => { node.nodeValue = leading + text(source) + trailing; });
  }
  for (const el of root.querySelectorAll('[aria-label],[alt],[title],[placeholder],meta[name="description"]')) {
    for (const attr of ['aria-label', 'alt', 'title', 'placeholder', 'content']) {
      const source = el.getAttribute(attr);
      if (source && Object.hasOwn(dictionary, source)) bindings.push(() => el.setAttribute(attr, text(source)));
    }
  }
}

function paintCopy() {
  document.documentElement.lang = language;
  bindings.forEach(paint => paint());
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
}

export function setLanguage(next, { persist = true } = {}) {
  if (!supportedLanguages.includes(next)) return;
  if (persist && browser) {
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Private browsing: in-memory selection still works. */ }
  }
  if (next === language) return;
  const position = browser ? [scrollX, scrollY] : null;
  const root = browser ? document.documentElement : null;
  if (root) {
    if (anchorFrame) cancelAnimationFrame(anchorFrame);
    else originalAnchoring = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';
    if (heldPageHeight) document.body.style.minHeight = '';
  }
  language = next;
  if (browser) paintCopy();
  listeners.forEach(paint => paint(language));
  if (browser) {
    // A shorter translation at the footer must not clamp the saved scroll offset.
    heldPageHeight = document.body.getBoundingClientRect().height < position[1] + innerHeight;
    document.body.style.minHeight = heldPageHeight ? position[1] + innerHeight + 'px' : '';
    if (scrollX !== position[0] || scrollY !== position[1]) scrollTo({ left: position[0], top: position[1], behavior: 'instant' });
    anchorFrame = requestAnimationFrame(() => {
      root.style.overflowAnchor = originalAnchoring;
      anchorFrame = 0;
    });
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
  }
}

if (browser) {
  // Option values are language-independent; existing selections survive translation.
  document.querySelectorAll('option:not([value])').forEach(option => { option.value = option.textContent; });
  bindCopy();
  paintCopy();
  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
  addEventListener('storage', event => {
    if (event.key === LANGUAGE_KEY || event.key === null) setLanguage(event.newValue === 'en' ? 'en' : 'tr', { persist: false });
  });
  addEventListener('resize', () => {
    if (heldPageHeight) document.body.style.minHeight = '';
    heldPageHeight = false;
  });
}
