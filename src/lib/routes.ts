/**
 * URL construction helpers — the single sanctioned place to build GyanDev URLs.
 *
 * Rule (see `shared/routing-and-urls.md` §8): never hand-concatenate course or
 * chapter paths anywhere in the codebase. Import `courseUrl` / `chapterUrl` /
 * `canonicalFor` and compose from there so one rename here ripples everywhere.
 *
 * Reserved slug list (`RESERVED_SLUGS`) mirrors spec §9 and is the
 * authoritative source consumed by `scripts/validate-slugs.mjs`.
 */

export const SITE = 'https://gyandev.org' as const;

/** `/courses/<course>` */
export function courseUrl(course: string): string {
  return `/courses/${course}`;
}

/** `/courses/<course>/<chapter>` — canonical Full Notes URL. */
export function chapterUrl(course: string, chapter: string): string {
  return `/courses/${course}/${chapter}`;
}

/** `/courses/<course>/<chapter>/revision` — non-canonical, noindex. */
export function chapterRevisionUrl(course: string, chapter: string): string {
  return `${chapterUrl(course, chapter)}/revision`;
}

/** `/courses/<course>/<chapter>/flow` — non-canonical, noindex. */
export function chapterFlowUrl(course: string, chapter: string): string {
  return `${chapterUrl(course, chapter)}/flow`;
}

/** Turn a site-relative path into an absolute URL rooted at `SITE`. */
export function canonicalFor(path: string): string {
  return new URL(path, SITE).toString();
}

/**
 * Reserved paths that cannot be used as course or chapter slugs.
 * Per spec §9: current Phase-1 routes + Phase-2 reservations + i18n locales.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Phase 1 live routes
  'about', 'courses', 'privacy', 'terms', 'search', '404',
  // Phase 2 reserved routes
  'tracks', 'review', 'bookmarks', 'settings', 'contributing', 'dmca',
  // Infrastructure / auto-generated resources
  'api', 'admin', 'sitemap.xml', 'robots.txt',
  'rss.xml', 'atom.xml', 'feed.json',
  '_redirects', '_headers',
  // i18n locale prefixes (Phase 3+)
  'en', 'hi', 'es',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
