#!/usr/bin/env node
/**
 * check-legal-freshness — CI gate for `src/content/legal/*.mdx`
 * (`.claude/plans/pages/legal.md` Step 10).
 *
 * Two independent signals:
 *
 *   1. `updated:` frontmatter must not lag behind the most recent git
 *      commit that touched the file. If someone edits privacy.mdx without
 *      bumping the date, fail CI with a line pointing at the file.
 *      Freshly-added files (no git history yet) are accepted.
 *
 *   2. Advisory 12-month staleness warning. Legal pages that haven't been
 *      reviewed in over a year should be flagged — this does NOT fail the
 *      build, it just prints a `warn:` line. A 24-month gap upgrades the
 *      warning to visual WARN-loud but still stays non-fatal; production
 *      gating lives in the editorial process, not CI.
 *
 * Exits 0 on success, 1 on any hard failure.
 */

import { readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LEGAL_DIR = join(ROOT, 'src/content/legal');
const exec = promisify(execFile);

const STALE_WARN_MONTHS = 12;

/** Parse a YAML-ish frontmatter block; returns `{ updated: Date }` or null. */
function parseUpdated(source) {
  const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const updatedLine = fm
    .split(/\r?\n/)
    .find((line) => /^updated\s*:/.test(line));
  if (!updatedLine) return null;
  const raw = updatedLine.replace(/^updated\s*:\s*/, '').trim();
  // Strip surrounding quotes if present; Zod's z.date() accepts ISO-8601.
  const cleaned = raw.replace(/^['"]|['"]$/g, '');
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Returns `Date | null` for the last git commit touching `filePath`. */
async function lastCommitDate(filePath) {
  try {
    const { stdout } = await exec(
      'git',
      ['log', '-1', '--format=%cI', '--', filePath],
      { cwd: ROOT },
    );
    const iso = stdout.trim();
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Days between two Dates, rounded down. */
function daysBetween(a, b) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

async function main() {
  let entries;
  try {
    entries = await readdir(LEGAL_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('check-legal-freshness: no src/content/legal — skipping.');
      return;
    }
    throw err;
  }

  const mdxFiles = entries.filter((name) => name.endsWith('.mdx'));
  if (mdxFiles.length === 0) {
    console.log('check-legal-freshness: no MDX legal pages — skipping.');
    return;
  }

  const errors = [];
  const warnings = [];
  const now = new Date();

  for (const name of mdxFiles) {
    const abs = join(LEGAL_DIR, name);
    const rel = relative(ROOT, abs);
    const source = await readFile(abs, 'utf8');

    const updated = parseUpdated(source);
    if (!updated) {
      errors.push(`${rel}: missing or unparseable \`updated\` frontmatter`);
      continue;
    }

    const lastCommit = await lastCommitDate(abs);
    if (lastCommit) {
      const lag = daysBetween(lastCommit, updated);
      // Tolerate same-day; frontmatter written at commit-time is expected.
      if (lastCommit > updated && lag > 0) {
        errors.push(
          `${rel}: modified on ${lastCommit
            .toISOString()
            .slice(0, 10)} but frontmatter \`updated: ${updated
            .toISOString()
            .slice(0, 10)}\` is ${lag} day(s) older — bump the date`,
        );
      }
    }

    const ageDays = daysBetween(now, updated);
    const ageMonths = Math.floor(ageDays / 30);
    if (ageMonths >= STALE_WARN_MONTHS) {
      warnings.push(
        `${rel}: last updated ${ageMonths} months ago — consider a legal review`,
      );
    }
  }

  for (const w of warnings) console.warn(`warn: ${w}`);

  if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
  }

  console.log(
    `check-legal-freshness: OK (${mdxFiles.length} file${
      mdxFiles.length === 1 ? '' : 's'
    }${warnings.length ? `, ${warnings.length} stale warning(s)` : ''})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
