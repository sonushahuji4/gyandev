#!/usr/bin/env node
/**
 * validate-slugs — CI gate for course/chapter slug hygiene.
 *
 * Checks (per shared/routing-and-urls.md Step 13):
 *   1. Course folder names match `^[a-z][a-z0-9-]*[a-z0-9]$` (spec Rule 1/2).
 *   2. Chapter folder names match either that same slug form OR the
 *      `NN-<slug>` ordering-prefixed form (e.g. `01-event-loop`) — the URL
 *      slug is the trailing portion (spec Rule 5: no chapter numbers in URLs).
 *   3. No slug collides with the reserved-path list (spec §9).
 *   4. No duplicate chapter slugs within a course.
 *   5. `public/_redirects` parses: each non-comment line has 3 whitespace-
 *      separated tokens, source is unique, status ∈ {301, 302, 308}.
 *
 * Exits 0 on success, 1 on any failure (with human-readable errors).
 *
 * Note: the plan also calls for MDX internal-link resolution checks. That's
 * deferred to PR-5.2 (`validate-content.mjs`) so this script stays focused
 * on slug + redirect format. Wiring PR is PR-1.1.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_DIR = join(ROOT, 'src/content/courses');
const REDIRECTS_FILE = join(ROOT, 'public/_redirects');

const SLUG_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const NUMBERED_CHAPTER_RE = /^\d{2,3}-([a-z][a-z0-9-]*[a-z0-9])$/;

// Keep in sync with `src/lib/routes.ts` RESERVED_SLUGS.
const RESERVED = new Set([
  'about', 'courses', 'privacy', 'terms', 'search', '404',
  'tracks', 'review', 'bookmarks', 'settings', 'contributing', 'dmca',
  'api', 'admin', 'sitemap.xml', 'robots.txt',
  'rss.xml', 'atom.xml', 'feed.json',
  '_redirects', '_headers',
  'en', 'hi', 'es',
]);

const errors = [];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function deriveChapterSlug(folderName) {
  const numbered = NUMBERED_CHAPTER_RE.exec(folderName);
  return numbered ? numbered[1] : folderName;
}

function isValidChapterFolder(name) {
  return SLUG_RE.test(name) || NUMBERED_CHAPTER_RE.test(name);
}

async function validateCourses() {
  if (!(await exists(CONTENT_DIR))) {
    // PR-0.3 created this directory with a .gitkeep. Absence here is a real
    // regression, not a content-empty-yet state.
    errors.push(`content dir missing: ${relative(ROOT, CONTENT_DIR)}`);
    return;
  }

  const courseEntries = await readdir(CONTENT_DIR, { withFileTypes: true });
  const courseDirs = courseEntries.filter((e) => e.isDirectory()).map((e) => e.name);

  for (const courseSlug of courseDirs) {
    if (!SLUG_RE.test(courseSlug)) {
      errors.push(`invalid course slug format: ${courseSlug}`);
      continue;
    }
    if (RESERVED.has(courseSlug)) {
      errors.push(`course slug collides with reserved path: ${courseSlug}`);
    }

    const coursePath = join(CONTENT_DIR, courseSlug);
    const chapterEntries = await readdir(coursePath, { withFileTypes: true });
    const chapterDirs = chapterEntries.filter((e) => e.isDirectory()).map((e) => e.name);

    const seen = new Map();
    for (const folder of chapterDirs) {
      if (!isValidChapterFolder(folder)) {
        errors.push(`invalid chapter folder in ${courseSlug}/: ${folder}`);
        continue;
      }
      const slug = deriveChapterSlug(folder);
      if (RESERVED.has(slug)) {
        errors.push(`chapter slug collides with reserved path: ${courseSlug}/${slug}`);
      }
      if (seen.has(slug)) {
        errors.push(
          `duplicate chapter slug in ${courseSlug}/: ${slug} ` +
            `(folders: ${seen.get(slug)}, ${folder})`,
        );
      } else {
        seen.set(slug, folder);
      }
    }
  }
}

async function validateRedirects() {
  if (!(await exists(REDIRECTS_FILE))) {
    errors.push(`_redirects missing at ${relative(ROOT, REDIRECTS_FILE)}`);
    return;
  }

  const raw = await readFile(REDIRECTS_FILE, 'utf8');
  const sources = new Map();
  const lines = raw.split('\n');

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/);
    if (parts.length !== 3) {
      errors.push(
        `_redirects line ${lineNo}: expected 3 tokens, got ${parts.length}: "${trimmed}"`,
      );
      return;
    }
    const [src, , status] = parts;
    if (!['301', '302', '308'].includes(status)) {
      errors.push(
        `_redirects line ${lineNo}: invalid status "${status}" (allowed: 301, 302, 308)`,
      );
    }
    if (sources.has(src)) {
      errors.push(
        `_redirects line ${lineNo}: duplicate source "${src}" ` +
          `(first seen on line ${sources.get(src)})`,
      );
    } else {
      sources.set(src, lineNo);
    }
  });
}

await validateCourses();
await validateRedirects();

if (errors.length > 0) {
  console.error('validate-slugs: FAILED');
  for (const err of errors) console.error('  •', err);
  process.exit(1);
}

console.log('validate-slugs: OK');
