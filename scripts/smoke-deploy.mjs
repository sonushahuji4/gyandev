#!/usr/bin/env node
/**
 * Post-deploy HTTP smoke test (PR-6.2 / PHASE-1-ROADMAP §4 Sprint 6).
 *
 * When to run:
 *   - In CI after a Cloudflare Pages deploy completes (non-blocking).
 *   - Locally before pushing to main — `npm run smoke:local` (requires
 *     `npm run build && npm run preview` in a separate terminal).
 *
 * What it checks (per PHASE-1-ROADMAP §5.9 Ops launch gates):
 *   a) Canonical URLs — 200 for every Phase-1 route, 404 for a bogus path.
 *   b) Static resources — sitemap-index, RSS/Atom/JSON Feed, robots.txt,
 *      default OG — with correct Content-Type.
 *   c) Canonical tags — home points to `/`, revision + flow tabs point to
 *      the Full Notes URL (spec §9 per-tab contract).
 *   d) Robots meta — Full Notes `index, follow`; revision/flow/404 `noindex`.
 *   e) CSP — response header contains `'wasm-unsafe-eval'` (R4 ratification;
 *      load-bearing for Pagefind WASM runtime).
 *   f) Performance sanity — TTFB, total time, HTML payload size.
 *
 * How to interpret:
 *   - Green PASS   — check passed.
 *   - Yellow WARN  — soft signal (slow response, oversized HTML, local mode
 *                    can't see Cloudflare headers). Does not fail CI.
 *   - Red FAIL     — hard failure. Exit code 1.
 *
 * Exit code 0 if all checks pass (warnings allowed); 1 if any failure.
 *
 * Zero external dependencies — Node 22 built-in `fetch` only.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? 'https://gyandev.org').replace(/\/$/, '');
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(BASE_URL);
const REQUEST_TIMEOUT_MS = 30_000;
const TTFB_WARN_MS = 1_000;
const TOTAL_WARN_MS = 3_000;
const HTML_WARN_BYTES = 100 * 1024;

// Canonical SITE used for building the expected absolute URLs inside HTML,
// independent of BASE_URL. Matches `src/lib/routes.ts`.
const SITE = 'https://gyandev.org';

// Seed course/chapter — only `javascript/closures` has all three tabs
// authored in Sprint 5. Override via env if later seeds change.
const SEED_COURSE = process.env.SEED_COURSE ?? 'javascript';
const SEED_CHAPTER = process.env.SEED_CHAPTER ?? 'closures';

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const isTTY = process.stdout.isTTY;
const color = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => color('32', s);
const yellow = (s) => color('33', s);
const red = (s) => color('31', s);
const dim = (s) => color('2', s);

const results = { pass: 0, warn: 0, fail: 0 };

function record(name, outcome) {
  if (outcome.status === 'pass') {
    results.pass++;
    console.log(`${green('PASS')}  ${name}${outcome.detail ? dim(` — ${outcome.detail}`) : ''}`);
  } else if (outcome.status === 'warn') {
    results.warn++;
    console.log(`${yellow('WARN')}  ${name} — ${outcome.detail ?? ''}`);
  } else {
    results.fail++;
    console.log(`${red('FAIL')}  ${name} — ${outcome.detail ?? ''}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function timedFetch(path, init = {}) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'manual' });
    const ttfb = performance.now() - start;
    const buf = await res.arrayBuffer();
    const total = performance.now() - start;
    return {
      ok: true,
      url,
      status: res.status,
      headers: res.headers,
      body: buf,
      ttfbMs: ttfb,
      totalMs: total,
    };
  } catch (err) {
    return { ok: false, url, error: err };
  } finally {
    clearTimeout(timer);
  }
}

function asText(res) {
  return new TextDecoder('utf-8').decode(res.body);
}

// ---------------------------------------------------------------------------
// HTML parse helpers (regex — avoids a jsdom dep for two-tag extraction)
// ---------------------------------------------------------------------------

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

function extractRobotsMeta(html) {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  if (!m) return null;
  const content = m[0].match(/content=["']([^"']+)["']/i);
  return content ? content[1] : null;
}

// ---------------------------------------------------------------------------
// Check builders
// ---------------------------------------------------------------------------

function statusCheck(path, expected) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok) return { status: 'fail', detail: `request error: ${res.error?.message ?? res.error}` };
    if (res.status !== expected) {
      return { status: 'fail', detail: `expected ${expected}, got ${res.status}` };
    }
    return { status: 'pass', detail: `${res.status} in ${Math.round(res.totalMs)}ms` };
  };
}

function contentTypeCheck(path, { expectedStatus = 200, allowedTypes }) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok) return { status: 'fail', detail: `request error: ${res.error?.message ?? res.error}` };
    if (res.status !== expectedStatus) {
      return { status: 'fail', detail: `expected ${expectedStatus}, got ${res.status}` };
    }
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const ok = allowedTypes.some((t) => ct.includes(t));
    if (!ok) {
      return { status: 'fail', detail: `content-type ${ct || '(none)'} — expected one of ${allowedTypes.join(', ')}` };
    }
    return { status: 'pass', detail: `${res.status} ${ct.split(';')[0]}` };
  };
}

function canonicalCheck(path, expectedCanonical) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok || res.status !== 200) {
      return { status: 'fail', detail: `fetch failed (status ${res.status ?? 'err'})` };
    }
    const html = asText(res);
    const canonical = extractCanonical(html);
    if (!canonical) return { status: 'fail', detail: 'no <link rel="canonical"> found' };
    if (canonical !== expectedCanonical) {
      return { status: 'fail', detail: `canonical = ${canonical}, expected ${expectedCanonical}` };
    }
    return { status: 'pass', detail: canonical };
  };
}

function robotsMetaCheck(path, { mustInclude = [], mustExclude = [] }) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok) return { status: 'fail', detail: `request error: ${res.error?.message ?? res.error}` };
    // 404 route returns status 404 but still renders HTML — accept either.
    if (res.status !== 200 && res.status !== 404) {
      return { status: 'fail', detail: `unexpected status ${res.status}` };
    }
    const html = asText(res);
    const robots = extractRobotsMeta(html);
    if (!robots) return { status: 'fail', detail: 'no <meta name="robots"> found' };
    const lower = robots.toLowerCase();
    for (const token of mustInclude) {
      if (!lower.includes(token.toLowerCase())) {
        return { status: 'fail', detail: `robots="${robots}" missing "${token}"` };
      }
    }
    for (const token of mustExclude) {
      if (lower.includes(token.toLowerCase())) {
        return { status: 'fail', detail: `robots="${robots}" should not contain "${token}"` };
      }
    }
    return { status: 'pass', detail: `robots="${robots}"` };
  };
}

/**
 * CSP header check (R4 ratification — load-bearing).
 *
 * `astro preview` does not apply `public/_headers` (that's a Cloudflare Pages
 * runtime concern), so against a localhost BASE_URL we fall back to parsing
 * the static `_headers` file and surface a WARN that the live header wasn't
 * observable. In production BASE_URL mode we require the header on the wire.
 */
function cspHeaderCheck(path) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok) return { status: 'fail', detail: `request error: ${res.error?.message ?? res.error}` };
    const csp = res.headers.get('content-security-policy');
    if (csp) {
      if (!csp.includes("'wasm-unsafe-eval'")) {
        return { status: 'fail', detail: `CSP present but missing 'wasm-unsafe-eval' — Pagefind WASM will fail` };
      }
      return { status: 'pass', detail: `CSP on wire includes 'wasm-unsafe-eval'` };
    }
    if (IS_LOCAL) {
      // Parse public/_headers as a proxy so the check still runs locally.
      try {
        const scriptDir = dirname(fileURLToPath(import.meta.url));
        const headersPath = join(scriptDir, '..', 'public', '_headers');
        const raw = await readFile(headersPath, 'utf8');
        const match = raw.match(/Content-Security-Policy:\s*([^\n]+)/i);
        if (!match) {
          return { status: 'fail', detail: 'no CSP on wire and no CSP in public/_headers' };
        }
        if (!match[1].includes("'wasm-unsafe-eval'")) {
          return { status: 'fail', detail: `static _headers CSP missing 'wasm-unsafe-eval'` };
        }
        return {
          status: 'warn',
          detail: `astro preview doesn't apply _headers — verified 'wasm-unsafe-eval' in public/_headers instead`,
        };
      } catch (err) {
        return { status: 'fail', detail: `could not read public/_headers: ${err.message}` };
      }
    }
    return { status: 'fail', detail: 'no Content-Security-Policy header on response' };
  };
}

function performanceCheck(path) {
  return async () => {
    const res = await timedFetch(path);
    if (!res.ok) return { status: 'fail', detail: `request error: ${res.error?.message ?? res.error}` };
    if (res.status !== 200) {
      return { status: 'fail', detail: `expected 200, got ${res.status}` };
    }
    const bytes = res.body.byteLength;
    const warns = [];
    if (res.ttfbMs > TTFB_WARN_MS) warns.push(`TTFB ${Math.round(res.ttfbMs)}ms > ${TTFB_WARN_MS}ms`);
    if (res.totalMs > TOTAL_WARN_MS) warns.push(`total ${Math.round(res.totalMs)}ms > ${TOTAL_WARN_MS}ms`);
    if (bytes > HTML_WARN_BYTES) warns.push(`${(bytes / 1024).toFixed(1)}KB > ${HTML_WARN_BYTES / 1024}KB`);
    const summary = `TTFB ${Math.round(res.ttfbMs)}ms · total ${Math.round(res.totalMs)}ms · ${(bytes / 1024).toFixed(1)}KB`;
    if (warns.length > 0) return { status: 'warn', detail: `${summary} — ${warns.join('; ')}` };
    return { status: 'pass', detail: summary };
  };
}

// ---------------------------------------------------------------------------
// Check registry
// ---------------------------------------------------------------------------

const chapterPath = `/courses/${SEED_COURSE}/${SEED_CHAPTER}`;
const revisionPath = `${chapterPath}/revision`;
const flowPath = `${chapterPath}/flow`;
const canonicalChapter = `${SITE}${chapterPath}`;

const checks = [
  // a) Canonical URL reachability
  ['GET / → 200', statusCheck('/', 200)],
  ['GET /courses → 200', statusCheck('/courses', 200)],
  [`GET /courses/${SEED_COURSE} → 200`, statusCheck(`/courses/${SEED_COURSE}`, 200)],
  [`GET ${chapterPath} → 200`, statusCheck(chapterPath, 200)],
  [`GET ${revisionPath} → 200`, statusCheck(revisionPath, 200)],
  [`GET ${flowPath} → 200`, statusCheck(flowPath, 200)],
  ['GET /about → 200', statusCheck('/about', 200)],
  ['GET /privacy → 200', statusCheck('/privacy', 200)],
  ['GET /terms → 200', statusCheck('/terms', 200)],
  ['GET /bogus-does-not-exist → 404', statusCheck('/bogus-does-not-exist', 404)],

  // b) Static resources (Content-Type enforced)
  ['GET /sitemap-index.xml → 200 xml', contentTypeCheck('/sitemap-index.xml', { allowedTypes: ['application/xml', 'text/xml'] })],
  ['GET /rss.xml → 200 rss+xml', contentTypeCheck('/rss.xml', { allowedTypes: ['application/rss+xml', 'application/xml', 'text/xml'] })],
  ['GET /atom.xml → 200 atom+xml', contentTypeCheck('/atom.xml', { allowedTypes: ['application/atom+xml', 'application/xml', 'text/xml'] })],
  // JSON Feed 1.1 mandates `application/feed+json`; accept plain json as fallback.
  ['GET /feed.json → 200 json', contentTypeCheck('/feed.json', { allowedTypes: ['application/feed+json', 'application/json'] })],
  ['GET /robots.txt → 200 text/plain', contentTypeCheck('/robots.txt', { allowedTypes: ['text/plain'] })],
  ['GET /og/default.png → 200 image/png', contentTypeCheck('/og/default.png', { allowedTypes: ['image/png'] })],

  // c) Canonical tag verification
  ['canonical home → SITE/', canonicalCheck('/', `${SITE}/`)],
  [`canonical ${revisionPath} → Full Notes`, canonicalCheck(revisionPath, canonicalChapter)],
  [`canonical ${flowPath} → Full Notes`, canonicalCheck(flowPath, canonicalChapter)],

  // d) Robots meta verification
  ['robots meta home → index,follow', robotsMetaCheck('/', { mustInclude: ['index', 'follow'], mustExclude: ['noindex'] })],
  [`robots meta ${chapterPath} → index,follow`, robotsMetaCheck(chapterPath, { mustInclude: ['index', 'follow'], mustExclude: ['noindex'] })],
  [`robots meta ${revisionPath} → noindex,follow`, robotsMetaCheck(revisionPath, { mustInclude: ['noindex', 'follow'] })],
  [`robots meta ${flowPath} → noindex,follow`, robotsMetaCheck(flowPath, { mustInclude: ['noindex', 'follow'] })],
  ['robots meta /404 → noindex', robotsMetaCheck('/404', { mustInclude: ['noindex'] })],

  // e) CSP header (R4) — required on every page; check on home.
  ["CSP response header includes 'wasm-unsafe-eval'", cspHeaderCheck('/')],

  // f) Performance sanity (home only — enough signal without padding the log)
  ['perf home (TTFB / total / size)', performanceCheck('/')],
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log(dim(`smoke-deploy ${BASE_URL}${IS_LOCAL ? ' (local mode)' : ''}`));
  console.log(dim('—'.repeat(60)));

  // Run all checks in parallel — they're independent HTTP probes. Preserve
  // registry order in the output so the log reads top-to-bottom.
  const outcomes = await Promise.all(checks.map(([, fn]) => fn().catch((err) => ({ status: 'fail', detail: `check threw: ${err?.message ?? err}` }))));
  for (let i = 0; i < checks.length; i++) {
    record(checks[i][0], outcomes[i]);
  }

  console.log(dim('—'.repeat(60)));
  const total = results.pass + results.warn + results.fail;
  const summary = `${results.pass}/${total} passed, ${results.warn} warnings, ${results.fail} failures`;
  if (results.fail > 0) {
    console.log(red(summary));
    process.exit(1);
  }
  if (results.warn > 0) {
    console.log(yellow(summary));
  } else {
    console.log(green(summary));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(red(`smoke-deploy crashed: ${err?.stack ?? err}`));
  process.exit(1);
});
