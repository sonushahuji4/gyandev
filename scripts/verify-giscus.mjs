#!/usr/bin/env node
/**
 * Giscus smoke test (PR-6.4 companion).
 *
 * Why it exists:
 *   `docs/DEPLOY.md` requires PUBLIC_GISCUS_REPO / _REPO_ID / _CATEGORY_ID to
 *   be set in the Cloudflare Pages environment before comments work. The
 *   values come from giscus.app's config generator and are wired into
 *   `src/components/pages/chapter/ChapterComments.astro` at build time via
 *   `import.meta.env`. If a value is missing, the build falls back to a
 *   "Comments are disabled" placeholder — silently. This script is the
 *   post-deploy check that catches that silent fallback.
 *
 * What it checks:
 *   1. All three Giscus env vars are present in process.env (build-time
 *      check — assumes CF Pages has injected them).
 *   2. One built chapter page includes the Giscus wiring:
 *        a. `<section id="comments" data-giscus-repo=...>` container with the
 *           three data attributes populated (ChapterComments rendered the
 *           active path, not the disabled placeholder).
 *        b. `https://giscus.app/client.js` script reference present in the
 *           HTML (confirms the runtime injection path is wired).
 *
 * Modes:
 *   - HTTP mode (default): fetches `${BASE_URL}/courses/javascript/event-loop`.
 *     `BASE_URL` defaults to `https://gyandev.org`; override for previews:
 *       BASE_URL=https://<branch>.gyandev.pages.dev node scripts/verify-giscus.mjs
 *   - File mode: set `VERIFY_GISCUS_FILE=dist/courses/javascript/event-loop.html`
 *     to read a built artifact off disk instead of fetching. Useful in CI
 *     immediately after `npm run build` without standing up a preview server.
 *
 * Exit codes:
 *   0 — all checks passed.
 *   1 — any env var missing, fetch/read failed, or HTML assertions failed.
 *
 * Not wired into `npm run check` — it needs real env vars + a built artifact,
 * neither of which is guaranteed in a local `check` run.
 */

import { readFile } from 'node:fs/promises';

const REQUIRED_ENV = [
  'PUBLIC_GISCUS_REPO',
  'PUBLIC_GISCUS_REPO_ID',
  'PUBLIC_GISCUS_CATEGORY_ID',
];

const BASE_URL = (process.env.BASE_URL ?? 'https://gyandev.org').replace(/\/$/, '');
const CHAPTER_PATH = process.env.VERIFY_GISCUS_PATH ?? '/courses/javascript/event-loop';
const FILE_OVERRIDE = process.env.VERIFY_GISCUS_FILE;

// ---------------------------------------------------------------------------
// Output helpers — single-file, zero deps.
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const pass = (msg) => console.log(`${GREEN}PASS${RESET} ${msg}`);
const fail = (msg, hint) => {
  console.log(`${RED}FAIL${RESET} ${msg}`);
  if (hint) console.log(`     ${DIM}→ ${hint}${RESET}`);
};
const warn = (msg) => console.log(`${YELLOW}WARN${RESET} ${msg}`);

let failures = 0;

// ---------------------------------------------------------------------------
// Step 1 — env vars present in process.env.
// ---------------------------------------------------------------------------

console.log(`\n${DIM}—— env vars ——${RESET}`);

for (const key of REQUIRED_ENV) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    failures += 1;
    fail(
      `${key} is not set`,
      'Set it via `export PUBLIC_GISCUS_* = ...` locally or in the Cloudflare ' +
        'Pages dashboard → Settings → Environment variables. Values come from ' +
        'https://giscus.app (select the repo + "Comments" category → copy ' +
        '`data-repo`, `data-repo-id`, `data-category-id`).',
    );
  } else {
    // Never log REPO_ID / CATEGORY_ID values — they are not secrets, but logging
    // them makes CI output noisy and leaks the repo identity into public logs.
    const display = key === 'PUBLIC_GISCUS_REPO' ? value : '(set)';
    pass(`${key}=${display}`);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — fetch / read the built chapter HTML.
// ---------------------------------------------------------------------------

console.log(`\n${DIM}—— chapter HTML ——${RESET}`);

let html = '';
let source = '';

try {
  if (FILE_OVERRIDE) {
    source = `file ${FILE_OVERRIDE}`;
    html = await readFile(FILE_OVERRIDE, 'utf8');
    pass(`read ${source}`);
  } else {
    source = `${BASE_URL}${CHAPTER_PATH}`;
    const res = await fetch(source, {
      headers: { 'user-agent': 'gyandev-verify-giscus/1.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    html = await res.text();
    pass(`fetched ${source} (${res.status})`);
  }
} catch (err) {
  failures += 1;
  fail(
    `could not load chapter page (${source})`,
    'HTTP mode: check BASE_URL is reachable and the chapter slug exists. ' +
      'File mode: run `npm run build` first, then point VERIFY_GISCUS_FILE at ' +
      'an actual `dist/courses/<course>/<chapter>.html`.',
  );
  console.log(`     ${DIM}${err.message}${RESET}`);
  // Can't assert against empty HTML; bail out of the content checks.
  process.exit(failures > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Step 3 — ChapterComments rendered the active path, not the disabled fallback.
// ---------------------------------------------------------------------------

if (html.includes('comments-disabled')) {
  failures += 1;
  fail(
    'chapter HTML contains the disabled-comments placeholder',
    'ChapterComments.astro fell back to the "Comments are disabled" section ' +
      'because one or more PUBLIC_GISCUS_* env vars were empty at build time. ' +
      'Fix: set the env vars in the build environment, then redeploy.',
  );
}

const containerMatch = html.match(
  /<section\b[^>]*\bid="comments"[^>]*data-giscus-repo="([^"]*)"[^>]*data-giscus-repo-id="([^"]*)"[^>]*data-giscus-category-id="([^"]*)"/,
);

if (!containerMatch) {
  failures += 1;
  fail(
    '<section id="comments"> container with data-giscus-* attributes not found',
    'Either the chapter page did not render ChapterComments (check ' +
      'ChapterLayout.astro mounts it) or the attribute order changed. ' +
      'Open the HTML in a browser to inspect what rendered.',
  );
} else {
  const [, repoAttr, repoIdAttr, categoryIdAttr] = containerMatch;

  if (process.env.PUBLIC_GISCUS_REPO && repoAttr !== process.env.PUBLIC_GISCUS_REPO) {
    failures += 1;
    fail(
      `data-giscus-repo="${repoAttr}" does not match PUBLIC_GISCUS_REPO="${process.env.PUBLIC_GISCUS_REPO}"`,
      'The built HTML was produced with a different env value than this ' +
        'script is checking against. Confirm the CF Pages build used the ' +
        'same PUBLIC_GISCUS_REPO you have set locally.',
    );
  } else {
    pass(`data-giscus-repo="${repoAttr}"`);
  }

  if (!repoIdAttr) {
    failures += 1;
    fail(
      'data-giscus-repo-id is empty',
      'PUBLIC_GISCUS_REPO_ID was empty at build time. Set it and redeploy.',
    );
  } else {
    pass('data-giscus-repo-id populated');
  }

  if (!categoryIdAttr) {
    failures += 1;
    fail(
      'data-giscus-category-id is empty',
      'PUBLIC_GISCUS_CATEGORY_ID was empty at build time. Set it and redeploy.',
    );
  } else {
    pass('data-giscus-category-id populated');
  }
}

// ---------------------------------------------------------------------------
// Step 4 — the Giscus runtime script reference is in the HTML.
// ---------------------------------------------------------------------------

if (html.includes('https://giscus.app/client.js')) {
  pass('giscus.app/client.js reference present');
} else {
  failures += 1;
  fail(
    'giscus.app/client.js script reference not found in chapter HTML',
    'GiscusLazy is expected to inject `<script src="https://giscus.app/client.js">` ' +
      'when the comments section intersects the viewport. If this reference ' +
      'never appears in the built HTML (static or server-injected), the chapter ' +
      'page will show the placeholder but never load the widget. Check ' +
      'src/components/performance/GiscusLazy.astro — the `giscus:ready` ' +
      'listener that performs the injection must be wired in.',
  );
}

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log(`${GREEN}✓ giscus verification passed${RESET}`);
  process.exit(0);
}

console.log(`${RED}✗ giscus verification failed (${failures} check${failures === 1 ? '' : 's'})${RESET}`);
console.log(
  `${DIM}See docs/DEPLOY.md → "Giscus configuration" for the full setup flow.${RESET}`,
);
process.exit(1);
