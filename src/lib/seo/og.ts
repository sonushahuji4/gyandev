/**
 * OG image helpers — slug-building and URL composition for the astro-og-canvas
 * route at `src/pages/og/[...slug].png.ts`.
 *
 * Slug formats consumed by the OG route:
 *   - `'home' | 'about' | 'privacy' | 'terms' | 'default' | '404'`
 *   - `'courses/<courseSlug>'`
 *   - `'courses/<courseSlug>/<chapterSlug>'`
 */

import { SITE } from '../routes';

export const STATIC_OG_SLUGS = [
  'home',
  'about',
  'privacy',
  'terms',
  'default',
  '404',
] as const;

export type StaticOgSlug = typeof STATIC_OG_SLUGS[number];

export interface OgSlugInput {
  staticSlug?: StaticOgSlug;
  course?: string;
  chapter?: string;
}

export function getOgSlug(input: OgSlugInput): string {
  if (input.staticSlug) return input.staticSlug;
  if (input.course && input.chapter) return `courses/${input.course}/${input.chapter}`;
  if (input.course) return `courses/${input.course}`;
  return 'default';
}

/** Site-relative OG image path, e.g. `/og/courses/nodejs/origin-story.png`. */
export function ogImagePath(slug: string): string {
  return `/og/${slug}.png`;
}

/** Absolute OG image URL. */
export function ogImageUrl(slug: string): string {
  return `${SITE}${ogImagePath(slug)}`;
}
