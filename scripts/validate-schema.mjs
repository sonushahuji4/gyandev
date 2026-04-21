#!/usr/bin/env node
/**
 * JSON-LD schema validator — scans every `dist/**\/*.html`, extracts
 * `<script type="application/ld+json">` blocks, parses them, and asserts
 * minimum required keys per `@type`. Fails the build on any malformed or
 * structurally invalid block.
 *
 * Runs as `npm run check:schema`; wired into the `check` chain and into CI
 * (seo.md Step 21 / PHASE-1-ROADMAP §7).
 *
 * Required-key tables below are the Phase-1 Google rich-results minimums.
 * Expand as new schemas ship (e.g. `VideoObject` in Phase 2).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(import.meta.url), '../../dist');

const REQUIRED = {
  WebSite: ['name', 'url'],
  TechArticle: ['headline', 'author', 'datePublished', 'dateModified', 'publisher'],
  Course: ['name', 'description', 'provider'],
  ItemList: ['itemListElement'],
  BreadcrumbList: ['itemListElement'],
  Person: ['name', 'url'],
  AboutPage: ['name', 'url'],
  Organization: ['name'],
};

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) blocks.push(m[1].trim());
  return blocks;
}

function validateSchema(schema, file, idx, errors) {
  const type = schema['@type'];
  if (!type) {
    errors.push(`${file} [#${idx}] missing @type`);
    return;
  }
  const typeStr = Array.isArray(type) ? type[0] : type;
  const required = REQUIRED[typeStr];
  if (!required) return;
  for (const key of required) {
    if (!(key in schema)) {
      errors.push(`${file} [#${idx}] ${typeStr} missing required key: ${key}`);
    }
  }
}

async function main() {
  const files = await walk(DIST);
  if (files.length === 0) {
    console.error(`[schema] no HTML in ${DIST} — run \`npm run build\` first.`);
    process.exit(1);
  }

  const errors = [];
  let totalBlocks = 0;
  let filesWithSchema = 0;

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const blocks = extractJsonLdBlocks(html);
    if (blocks.length === 0) continue;
    filesWithSchema++;
    for (let i = 0; i < blocks.length; i++) {
      totalBlocks++;
      const raw = blocks[i];
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        errors.push(`${relative(process.cwd(), file)} [#${i}] invalid JSON: ${err.message}`);
        continue;
      }
      const schemas = Array.isArray(parsed) ? parsed : [parsed];
      for (const schema of schemas) {
        validateSchema(schema, relative(process.cwd(), file), i, errors);
      }
    }
  }

  console.log(
    `[schema] scanned ${files.length} HTML file(s), ${filesWithSchema} with JSON-LD, ${totalBlocks} block(s).`,
  );

  if (errors.length > 0) {
    console.error(`[schema] ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('[schema] OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
