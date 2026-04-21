#!/usr/bin/env node
/**
 * check-bundle-size.mjs — enforce per-route JavaScript budgets against `dist/`.
 *
 * Owner: PR-1.4 (performance.md §3.6 + Step 12). Runs as `postbuild` and in
 * CI so a regression cannot merge without a visible budget failure. Budgets
 * below are from PHASE-1-ROADMAP §5.5 and the PR-1.4 brief.
 *
 * Budgets (gzipped JS per route):
 *
 *   home               <   5 KB   — static hero, theme toggle only
 *   all-courses        <  40 KB   — progress-hydrate island
 *   course-overview    <  50 KB   — course-overview-hydrate island
 *   chapter Full Notes < 500 KB   — Pagefind + hydrate scripts (chapter capstone)
 *   flow               exempt     — Mermaid isolation (spec §12 + RESEARCH Topic 8)
 *   revision           <  30 KB   — lightweight view
 *   other              <  30 KB   — 404, about, privacy, terms, courses index
 *
 * Algorithm:
 *   1. Walk `dist/` for every `*.html` — each is one route.
 *   2. For each route, extract `<script src>` asset references, resolve to
 *      file paths under `dist/`, gzip their contents, and sum the bytes.
 *   3. Classify the route against BUDGETS (longest-prefix match).
 *   4. Print a table (actual JS gz vs budget) and exit 1 on any violation.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep, posix, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST = join(REPO_ROOT, 'dist');

/**
 * Budget table — matched longest-prefix-first. `null` means exempt.
 * Values are gzipped bytes of first-party JS referenced by the route's HTML.
 */
const BUDGETS = [
  { pattern: /^\/courses\/[^/]+\/[^/]+\/flow(\.html)?$/, limit: null, name: 'chapter-flow' },
  { pattern: /^\/courses\/[^/]+\/[^/]+\/revision(\.html)?$/, limit: 30_000, name: 'chapter-revision' },
  { pattern: /^\/courses\/[^/]+\/[^/]+(\.html)?$/, limit: 500_000, name: 'chapter-full' },
  { pattern: /^\/courses\/[^/]+(\.html)?$/, limit: 50_000, name: 'course-overview' },
  { pattern: /^\/courses(\/index\.html|\.html)?$/, limit: 40_000, name: 'all-courses' },
  { pattern: /^\/(index\.html)?$/, limit: 5_000, name: 'home' },
];

const OTHER_LIMIT = 30_000;

function classify(route) {
  for (const b of BUDGETS) if (b.pattern.test(route)) return b;
  return { pattern: null, limit: OTHER_LIMIT, name: 'other' };
}

/** Recursive walk that yields every file path under `root`. */
async function walk(root) {
  const out = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const p = join(root, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Resolve a src against a route's HTML location, returning an absolute path under dist/ or null. */
function resolveAsset(href, htmlPath) {
  const clean = href.split('?')[0].split('#')[0];
  if (!clean) return null;
  if (/^(?:data:|https?:|mailto:|tel:)/i.test(clean)) return null;
  if (clean.startsWith('/')) return join(DIST, clean.slice(1));
  return resolve(dirname(htmlPath), clean);
}

/** Extract <script src> references — we emit plain HTML so cheap regexes are fine. */
function extractScriptSrcs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi)) {
    refs.add(m[1]);
  }
  return [...refs];
}

function fmtKB(bytes) {
  return (bytes / 1000).toFixed(1) + ' KB';
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function measureRoute(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const route = '/' + relative(DIST, htmlPath).split(sep).join(posix.sep);

  let jsGz = 0;
  const seen = new Set();
  for (const ref of extractScriptSrcs(html)) {
    const absolute = resolveAsset(ref, htmlPath);
    if (!absolute || seen.has(absolute) || !existsSync(absolute)) continue;
    const ext = extname(absolute).toLowerCase();
    if (ext !== '.js' && ext !== '.mjs') continue;
    seen.add(absolute);
    const st = await stat(absolute);
    if (!st.isFile()) continue;
    jsGz += gzipSync(await readFile(absolute)).length;
  }

  const bucket = classify(route);
  return {
    route,
    bucket: bucket.name,
    limit: bucket.limit,
    jsGz,
  };
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('check-bundle-size: dist/ not found. Run `npm run build` first.');
    process.exit(1);
  }

  const files = await walk(DIST);
  const htmlFiles = files.filter((f) => f.endsWith('.html')).sort();
  if (htmlFiles.length === 0) {
    console.error('check-bundle-size: no .html files found in dist/.');
    process.exit(1);
  }

  const rows = [];
  for (const htmlPath of htmlFiles) rows.push(await measureRoute(htmlPath));

  const routeWidth = Math.max(40, ...rows.map((r) => r.route.length + 2));
  const bucketWidth = Math.max(16, ...rows.map((r) => r.bucket.length + 2));
  const numWidth = 14;

  const header = ['Route', 'Bucket', 'JS (gz)', 'Budget', 'Status'];
  const widths = [routeWidth, bucketWidth, numWidth, numWidth, 10];

  console.log();
  console.log(header.map((h, i) => pad(h, widths[i])).join('  '));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));

  let failed = 0;
  for (const r of rows) {
    const budgetLabel = r.limit === null ? 'exempt' : fmtKB(r.limit);
    const status = r.limit === null ? 'skip' : r.jsGz > r.limit ? 'FAIL' : 'ok';
    if (status === 'FAIL') failed++;
    console.log(
      [
        pad(r.route, widths[0]),
        pad(r.bucket, widths[1]),
        pad(fmtKB(r.jsGz), widths[2]),
        pad(budgetLabel, widths[3]),
        pad(status, widths[4]),
      ].join('  '),
    );
  }
  console.log();

  if (failed > 0) {
    console.error(`check-bundle-size: ${failed} route(s) exceeded the JS budget.`);
    process.exit(1);
  }
  console.log(`check-bundle-size: ${rows.length} route(s) within budget.`);
}

main().catch((err) => {
  console.error('check-bundle-size: unexpected error');
  console.error(err);
  process.exit(1);
});
