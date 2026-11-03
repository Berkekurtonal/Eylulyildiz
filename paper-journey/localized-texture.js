import { drawnTexture as createTexture } from './lib/core.js';
import { localizeCanvas } from '../shared/localized-canvas.js';
import { onLanguageChange } from '../shared/i18n.js';

// Text-only texture refresh. Geometry, material instances and scene state survive.
export function drawnTexture(width, height, draw, srgb = true) {
  let context;
  const paint = c => {
    context = localizeCanvas(c);
    c.save();
    draw(c, width, height);
    c.restore();
  };
  const texture = createTexture(width, height, paint, srgb);
  if (context.localizedText.used) {
    const stop = onLanguageChange(() => {
      context.clearRect(0, 0, width, height);
      paint(context);
      texture.needsUpdate = true;
    });
    texture.addEventListener('dispose', stop);
  }
  return texture;
}
