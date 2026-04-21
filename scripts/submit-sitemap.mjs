#!/usr/bin/env node
/**
 * Optional post-deploy sitemap pinger — notifies search engines a fresh build
 * is live via IndexNow (spec §8, seo.md Step 18).
 *
 * No-op unless `SITEMAP_SUBMIT_TOKEN` is set. Intended to run on successful
 * main-branch deploys only (not on PR builds).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = process.env.PUBLIC_SITE_URL || 'https://gyandev.org';
const TOKEN = process.env.SITEMAP_SUBMIT_TOKEN;

if (!TOKEN) {
  console.log('[submit-sitemap] SITEMAP_SUBMIT_TOKEN unset — skipping.');
  process.exit(0);
}

const sitemapPath = join(fileURLToPath(import.meta.url), '../../dist/sitemap-index.xml');

async function main() {
  let xml;
  try {
    xml = await readFile(sitemapPath, 'utf8');
  } catch (err) {
    console.error(`[submit-sitemap] cannot read ${sitemapPath}: ${err.message}`);
    process.exit(1);
  }

  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  if (locs.length === 0) {
    console.error('[submit-sitemap] no <loc> entries found.');
    process.exit(1);
  }

  const host = new URL(SITE).host;
  const body = {
    host,
    key: TOKEN,
    keyLocation: `${SITE}/${TOKEN}.txt`,
    urlList: locs,
  };

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`[submit-sitemap] IndexNow responded ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`[submit-sitemap] submitted ${locs.length} URL(s) via IndexNow.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
