/* SHARED — project routes, derived from shared/projects.data.js.

   Addresses are built from each project's real title, never from its folder
   or file name: "LOS PLATOS DE FRIDA" → projects/los-platos-de-frida/.
   Titles that repeat get a number in project order (nature-retreat,
   nature-retreat-2). A `slug` in the data overrides the derived one. */
import { PROJECTS } from './projects.data.js';

const TURKISH = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U' };

export function slugify(title) {
  return title.replace(/[ıİşŞğĞçÇöÖüÜ]/g, c => TURKISH[c])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function withRoutes(projects) {
  const taken = new Map();
  return projects.map(project => {
    const base = project.slug || slugify(project.title);
    const n = (taken.get(base) || 0) + 1;
    taken.set(base, n);
    const slug = project.slug || (n === 1 ? base : `${base}-${n}`);
    // Relative to the site root, so the site works from any base path.
    return Object.freeze({ ...project, slug, href: `projects/${slug}/` });
  });
}

/** Every project in stack order, with `slug` and `href` added. */
export const ARCHIVE = Object.freeze(withRoutes(PROJECTS));

export const projectBySlug = slug => ARCHIVE.find(p => p.slug === slug);

/** The previous and next project, wrapping around the archive. */
export function neighbours(project) {
  const i = ARCHIVE.indexOf(project), n = ARCHIVE.length;
  return { previous: ARCHIVE[(i - 1 + n) % n], next: ARCHIVE[(i + 1) % n] };
}
