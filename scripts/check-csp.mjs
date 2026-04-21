#!/usr/bin/env node
/**
 * CSP smoke test — parses the effective `Content-Security-Policy` from
 * `public/_headers` and asserts the ratified Phase-1 directives are present.
 *
 * This is a static gate; the full runtime gate (headless browser visits
 * `/search` and fails on any CSP violation event) lives in `smoke-deploy.mjs`
 * under PR-6.2. The ratified `'wasm-unsafe-eval'` source is the load-bearing
 * check here — Pagefind's WASM runtime silently fails without it.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADERS_PATH = join(fileURLToPath(import.meta.url), '../../public/_headers');

const REQUIRED_DIRECTIVES = [
  { directive: 'default-src', sources: ["'self'"] },
  { directive: 'script-src', sources: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://giscus.app'] },
  { directive: 'style-src', sources: ["'self'", "'unsafe-inline'"] },
  { directive: 'img-src', sources: ["'self'", 'data:', 'https:'] },
  { directive: 'font-src', sources: ["'self'"] },
  { directive: 'connect-src', sources: ["'self'", 'https://giscus.app'] },
  { directive: 'frame-src', sources: ['https://giscus.app'] },
  { directive: 'frame-ancestors', sources: ["'none'"] },
  { directive: 'base-uri', sources: ["'self'"] },
  { directive: 'form-action', sources: ["'self'"] },
];

function extractCsp(headers) {
  const match = headers.match(/Content-Security-Policy:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

function parseCsp(csp) {
  const map = new Map();
  for (const part of csp.split(';')) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (name) map.set(name.toLowerCase(), rest);
  }
  return map;
}

async function main() {
  const headers = await readFile(HEADERS_PATH, 'utf8');
  const csp = extractCsp(headers);
  if (!csp) {
    console.error(`[csp] no Content-Security-Policy found in ${HEADERS_PATH}`);
    process.exit(1);
  }
  const parsed = parseCsp(csp);
  const errors = [];
  for (const { directive, sources } of REQUIRED_DIRECTIVES) {
    const actual = parsed.get(directive.toLowerCase());
    if (!actual) {
      errors.push(`missing directive: ${directive}`);
      continue;
    }
    for (const src of sources) {
      if (!actual.includes(src)) {
        errors.push(`${directive} missing source: ${src}`);
      }
    }
  }
  if (errors.length > 0) {
    console.error(`[csp] ${errors.length} issue(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`[csp] OK — ${REQUIRED_DIRECTIVES.length} directive(s) validated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
