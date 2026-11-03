// Localized editorial data; the animation consumes the same seven chapter slots.
import { getContent, onLanguageChange } from '../../shared/i18n.js';
export let CHAPTERS = getContent().paperJourney.chapters;
export let PROJECTS = getContent().paperJourney.projects;
onLanguageChange(() => {
  CHAPTERS = getContent().paperJourney.chapters;
  PROJECTS = getContent().paperJourney.projects;
});
export const CONTACT = 'merhaba@eylulyildiz.archi';
