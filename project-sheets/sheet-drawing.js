/* ══════════════════════════════════════════════════════════════════
   PART 2 of 3 — PROJECTSHEETS · sheet drawing

   Draws a sheet exactly the way the PaperJourney prints its closing sheet
   (paper-journey/lib/plan.js, sheetTexture): 2048 × 1408 px for 24 × 16.5 m,
   the same paper, inks, line weights, hatching, type and title block.
   ProjectSheet01 is that sheet; the placeholder sheets are drawn in the
   same hand, so the five read as one set of drawings.
   ══════════════════════════════════════════════════════════════════ */

import { PAPER_SIZE } from './sheet-01.js';
import { text } from '../shared/i18n.js';
import { localizeCanvas } from '../shared/localized-canvas.js';

export const SHEET_PX = [2048, 1408];
const STUDIO_LINE = 'EYLÜL YILDIZ  ·  INTERIOR ARCHITECTURE';

/** The title block of a sheet entry: title, then three lines. */
export function titleBlock(sheet) {
  return [sheet.title, ...(sheet.lines || [sheet.drawing, text('{scale}   /   A1   /   SHEET {number}', { scale: sheet.scale, number: sheet.sheet }), STUDIO_LINE])].map(line => text(line));
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw one sheet at 2048 × 1408 px. `image`, if given, is a real drawing used instead of the plan. */
export function drawSheet(c, sheet, image = null, seed = 1) {
  localizeCanvas(c);
  const [W, H] = SHEET_PX, S = W / PAPER_SIZE[0];
  const px = x => W / 2 + x * S, pz = z => H / 2 + z * S;
  const plan = sheet.plan || {};
  const wallRect = ([w, d, x, z]) => [px(x - w / 2), pz(z - d / 2), w * S, d * S];
  const boxRect = ([x, z, w, d]) => [px(x), pz(z), w * S, d * S];
  const line = ([x1, z1, x2, z2]) => { c.beginPath(); c.moveTo(px(x1), pz(z1)); c.lineTo(px(x2), pz(z2)); c.stroke(); };
  const ring = ([x, z, r]) => { c.beginPath(); c.arc(px(x), pz(z), r * S, 0, Math.PI * 2); c.stroke(); };

  // paper
  c.fillStyle = '#e9e4d6';
  c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,.5)');
  g.addColorStop(.6, 'rgba(226,219,203,.25)');
  g.addColorStop(1, 'rgba(198,189,169,.4)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.lineJoin = 'miter';
  c.lineCap = 'butt';

  // sheet border
  c.strokeStyle = 'rgba(77,81,69,.55)';
  c.lineWidth = 1.4;
  c.strokeRect(30, 30, W - 60, H - 60);

  // a real drawing, fitted above the title block
  if (image) {
    const [bx, by, bw, bh] = [70, 70, W - 140, H - 320];
    const k = Math.min(bw / image.naturalWidth, bh / image.naturalHeight);
    const w = image.naturalWidth * k, h = image.naturalHeight * k;
    c.drawImage(image, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
  }

  const walls = plan.walls || [];
  if (walls.length) {
    // hatched poche inside every wall
    c.save();
    c.beginPath();
    for (const wall of walls) c.rect(...wallRect(wall));
    c.clip();
    c.fillStyle = '#cfc8b4';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(60,62,52,.55)';
    c.lineWidth = 1.1;
    for (let i = -H; i < W + H; i += 9) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); }
    c.restore();
    // structure
    c.strokeStyle = '#33362d';
    c.lineWidth = 3.4;
    for (const wall of walls) c.strokeRect(...wallRect(wall));
  }

  // columns and glazing (placeholder plans)
  c.fillStyle = '#33362d';
  for (const [x, z, size] of plan.posts || []) c.fillRect(px(x - size / 2), pz(z - size / 2), size * S, size * S);
  c.strokeStyle = '#5c6053';
  c.lineWidth = 1.2;
  for (const [x1, z1, x2, z2] of plan.glazing || []) {
    const len = Math.hypot(x2 - x1, z2 - z1) || 1, ox = -(z2 - z1) / len * .06, oz = (x2 - x1) / len * .06;
    line([x1 + ox, z1 + oz, x2 + ox, z2 + oz]);
    line([x1 - ox, z1 - oz, x2 - ox, z2 - oz]);
  }

  // furniture
  c.strokeStyle = '#5c6053';
  c.lineWidth = 1.9;
  for (const f of plan.furniture || []) c.strokeRect(...boxRect(f));
  for (const r of plan.rounds || []) ring(r);

  // interior indications, so the plan reads as designed, not diagrammatic
  const d = plan.details || {};
  c.lineWidth = 1.1;
  c.strokeStyle = '#767a6a';
  for (const r of d.rects || []) c.strokeRect(...boxRect(r));
  for (const l of d.lines || []) line(l);
  for (const r of d.circles || []) ring(r);

  // door swings
  c.strokeStyle = '#5c6053';
  c.lineWidth = 1.6;
  for (const [hx, hz, r, from, to, lx, lz] of plan.doors || []) {
    c.beginPath(); c.arc(px(hx), pz(hz), r * S, from * Math.PI / 180, to * Math.PI / 180); c.stroke();
    line([hx, hz, lx, lz]);
  }

  // dimensions
  c.strokeStyle = '#6d7162';
  c.lineWidth = 1.2;
  c.font = '400 22px Georgia, serif';
  for (const [x1, z1, x2, z2, label] of plan.dimensions || []) {
    line([x1, z1, x2, z2]);
    const vertical = Math.abs(x2 - x1) < .01;
    c.save();
    c.translate((px(x1) + px(x2)) / 2, (pz(z1) + pz(z2)) / 2);
    if (vertical) c.rotate(-Math.PI / 2);
    c.textAlign = 'center';
    c.fillStyle = '#e9e4d6';
    c.fillRect(-38, -20, 76, 20);
    c.fillStyle = '#4d5145';
    c.fillText(label, 0, -4);
    c.restore();
    for (const [tx, tz] of [[x1, z1], [x2, z2]]) {
      c.beginPath();
      if (vertical) { c.moveTo(px(tx) - 8, pz(tz)); c.lineTo(px(tx) + 8, pz(tz)); }
      else { c.moveTo(px(tx), pz(tz) - 8); c.lineTo(px(tx), pz(tz) + 8); }
      c.stroke();
    }
  }

  // north arrow
  if (plan.north) {
    const [nx, nz] = plan.north;
    c.strokeStyle = '#4d5145';
    c.fillStyle = '#4d5145';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(px(nx), pz(nz)); c.lineTo(px(nx), pz(nz - 1));
    c.moveTo(px(nx), pz(nz - 1)); c.lineTo(px(nx - .23), pz(nz - .5));
    c.moveTo(px(nx), pz(nz - 1)); c.lineTo(px(nx + .23), pz(nz - .5));
    c.stroke();
    c.font = '400 20px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('N', px(nx + .45), pz(nz - .75));
  }

  // room names
  c.font = '400 20px Georgia, serif';
  c.fillStyle = '#6d7162';
  c.textAlign = 'center';
  for (const [text, x, z] of plan.labels || []) c.fillText(text, px(x), pz(z));

  // title block, bottom right
  const [title, ...lines] = titleBlock(sheet);
  const tx = W - 456, ty = H - 218;
  c.textAlign = 'left';
  c.strokeStyle = '#4d5145';
  c.lineWidth = 1.6;
  c.strokeRect(tx, ty, 410, 160);
  c.beginPath(); c.moveTo(tx, ty + 56); c.lineTo(tx + 410, ty + 56); c.stroke();
  c.fillStyle = '#33362d';
  c.font = '400 30px Georgia, serif';
  c.fillText(title, tx + 18, ty + 38);
  c.font = '400 17px Georgia, serif';
  c.fillStyle = '#5c6053';
  lines.forEach((text, i) => c.fillText(text, tx + 18, ty + 84 + i * 26));

  // paper tone: soft enough never to read as marks on the drawing
  const random = seeded(seed);
  c.globalAlpha = .022;
  c.filter = 'blur(26px)';
  for (let i = 0; i < 40; i++) {
    c.fillStyle = random() < .5 ? '#8d8877' : '#ffffff';
    c.beginPath();
    c.arc(random() * W, random() * H, 60 + random() * 190, 0, Math.PI * 2);
    c.fill();
  }
  c.filter = 'none';
  c.globalAlpha = 1;
}

/**
 * The sheet at halving sizes, from `largest` px wide down to 256, each
 * downsampled from the one above, so a sheet stays crisp and calm at any
 * size it is shown at.
 */
export function sheetLevels(sheet, image, largest = 2048, seed = 1) {
  let source = document.createElement('canvas');
  [source.width, source.height] = SHEET_PX;
  drawSheet(source.getContext('2d'), sheet, image, seed);
  const levels = [];
  for (;;) {
    if (source.width <= largest) levels.push(source);
    if (source.width <= 256) break;
    const next = document.createElement('canvas');
    next.width = source.width / 2;
    next.height = Math.round(source.height / 2);
    const ctx = next.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, next.width, next.height);
    if (!levels.includes(source)) source.width = source.height = 0;
    source = next;
  }
  return levels;
}

export function loadImage(src) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image.decode().then(() => image);
}
