/**
 * OG image route — generates 1200×630 PNGs for every indexed page type via
 * `astro-og-canvas` (SEO spec §5). Fallback static `/og/default.png` lives in
 * `public/og/` and ships even if the build fails here.
 *
 * Slug map (built once at route init):
 *   - Static: home, about, privacy, terms, 404, default
 *   - Dynamic: any course in the `courses` collection → `courses/<slug>`
 *   - Dynamic: any chapter in the `chapters` collection →
 *              `courses/<courseSlug>/<chapterSlug>`
 *
 * When new collections are seeded (PR-3.1+) this file picks them up
 * automatically — no edits required.
 */

import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';

interface OgPage {
  title: string;
  description: string;
}

const staticPages: Record<string, OgPage> = {
  home: {
    title: 'GyanDev',
    description: 'Deep technical notes for modern developers.',
  },
  about: {
    title: 'About',
    description: 'About GyanDev — who builds it and why.',
  },
  privacy: {
    title: 'Privacy',
    description: 'What we store locally, what leaves the browser, and why.',
  },
  terms: {
    title: 'Terms',
    description: 'Terms of use for GyanDev content and this site.',
  },
  '404': {
    title: 'Not Found',
    description: 'The page you were looking for could not be found.',
  },
  default: {
    title: 'GyanDev',
    description: 'Deep technical notes for modern developers.',
  },
};

const courses = await getCollection('courses');
const chapters = await getCollection('chapters');

const coursePages: Record<string, OgPage> = Object.fromEntries(
  courses.map((c) => {
    const courseSlug = c.id.split('/')[0];
    return [
      `courses/${courseSlug}`,
      { title: c.data.title, description: c.data.description },
    ];
  }),
);

const chapterPages: Record<string, OgPage> = Object.fromEntries(
  chapters.map((c) => {
    const parts = c.id.split('/');
    const courseSlug = parts[0];
    const chapterSlug = parts.slice(1, -1).join('/');
    return [
      `courses/${courseSlug}/${chapterSlug}`,
      { title: c.data.title, description: c.data.description },
    ];
  }),
);

const pages: Record<string, OgPage> = {
  ...staticPages,
  ...coursePages,
  ...chapterPages,
};

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  // Default `getSlug` appends `.png` to the map key; combined with our
  // `[...slug].png.ts` filename that produces `/og/foo.png.png`. Return the
  // key unchanged so Astro's filename supplies the single `.png` suffix.
  getSlug: (path) => path,
  getImageOptions: (_path, page: OgPage) => ({
    title: page.title,
    description: page.description,
    bgGradient: [
      [250, 247, 240],
      [245, 240, 225],
    ],
    border: { color: [194, 65, 12], width: 8, side: 'inline-start' },
    padding: 64,
    font: {
      title: {
        size: 72,
        lineHeight: 1.1,
        families: ['Inter'],
        weight: 'Bold',
        color: [23, 21, 15],
      },
      description: {
        size: 32,
        lineHeight: 1.3,
        families: ['Inter'],
        weight: 'Normal',
        color: [91, 86, 73],
      },
    },
  }),
});
