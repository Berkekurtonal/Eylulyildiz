// The stack's sheets, read from the central archive (shared/projects.data.js).
// Titles are PDF-verified; each sheet shows the same drawing its project page opens with.
// ARCHÉ comes first as the live closing frame of the journey, so it is not a PDF card.
// See tools/project-sheets.sources.json for the page and crop each stack drawing came from.
import { ARCHIVE } from '../shared/projects.js';

const journey = ARCHIVE.find(p => p.journey);
export const JOURNEY_SHEET = { number: journey.number, title: journey.title, href: journey.href };
// The plan ARCHÉ's sheet settles on as it recedes: colourless and seen from
// above, like every other sheet, and the drawing its project page opens with.
export const JOURNEY_PLAN = { src: journey.hero.src, alt: journey.hero.alt };

export const PROJECT_SHEETS = ARCHIVE.filter(p => !p.journey).map(p => ({
  number: p.number,
  title: p.title,
  href: p.href,
  image: { src: p.hero.src, alt: p.hero.alt }
}));
