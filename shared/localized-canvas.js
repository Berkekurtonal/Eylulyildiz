import { text } from './i18n.js';

// Local to a text canvas: never patches CanvasRenderingContext2D globally.
export function localizeCanvas(context) {
  if (context.localizedText) return context;
  context.localizedText = { used: false };
  for (const method of ['fillText', 'strokeText']) {
    const original = context[method].bind(context);
    context[method] = (source, x, y, maxWidth) => {
      context.localizedText.used = true;
      const translated = text(source);
      // Preserve the original line's allocation when the translation is longer.
      const width = maxWidth ?? (translated !== source ? Math.max(context.measureText(source).width, 1) : undefined);
      return width === undefined ? original(translated, x, y) : original(translated, x, y, width);
    };
  }
  return context;
}
