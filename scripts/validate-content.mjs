#!/usr/bin/env node
/**
 * validate-content — CI gate for MDX authoring hygiene (PR-5.2).
 *
 * Enforces the four rules listed in `.claude/plans/pages/chapter.md` Step 21
 * (and roadmap §8 script inventory):
 *
 *   a) mermaid-flow-only
 *      ```mermaid fences may appear ONLY in `flow.mdx`. `astro-mermaid`
 *      injects its ~300KB runtime on any route whose MDX contains a mermaid
 *      fence, so keeping fences out of `index.mdx` / `revision.mdx` is what
 *      keeps Full Notes + Revision bundles under their size budget.
 *
 *   b) no-h1-in-body
 *      Chapter body MDX (`index.mdx`, `revision.mdx`, `flow.mdx`) must not
 *      contain a root-level `# ` heading. `ChapterHeader` renders the <h1>
 *      from frontmatter; a stray H1 in the body would double-header the page
 *      and break the a11y focus-landing contract (roadmap §2.R3).
 *
 *   c) orphan-view
 *      If `revision.mdx` or `flow.mdx` exists in a chapter folder, the
 *      sibling `index.mdx` must also exist. Full Notes is canonical; the
 *      other views are supplementary and cannot stand alone.
 *
 *   d) frontmatter-presence
 *      Every .mdx file needs a `---`-delimited frontmatter block.
 *      Chapter `index.mdx` files additionally need `title:` and `course:`
 *      so the `chapters` Zod schema has the fields it needs to build an
 *      entry. `course.mdx` + view files (`revision.mdx`, `flow.mdx`) only
 *      need the block; their schemas allow empty / optional fields.
 *
 * This script runs in CI — keep it fast (< 2s on the typical content tree).
 * Pure Node ESM; only built-in modules.
 *
 * Exit 0 on pass, 1 on fail.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_DIR = join(ROOT, 'src/content/courses');

const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const RED = USE_COLOR ? '[31m' : '';
const GREEN = USE_COLOR ? '[32m' : '';
const DIM = USE_COLOR ? '[2m' : '';
const RESET = USE_COLOR ? '[0m' : '';

const CHAPTER_BODY_FILES = new Set(['index.mdx', 'revision.mdx', 'flow.mdx']);
const VIEW_FILES = ['revision.mdx', 'flow.mdx'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Collect every .mdx path under `src/content/courses/` (recursive). */
async function collectMdx(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      // Node 20.12+ exposes `parentPath` on recursive readdir Dirents.
      const parent = entry.parentPath ?? dir;
      out.push(join(parent, entry.name));
    }
  }
  return out;
}

/**
 * Parse an opening-`---` / closing-`---` frontmatter block.
 * Returns `{ endLine, body }` (1-indexed closing line) or null if missing.
 */
function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return { endLine: i + 1, body: lines.slice(1, i).join('\n') };
    }
  }
  return null;
}

/**
 * Walk body lines once, tracking fenced-code state per CommonMark. Returns
 * line numbers (1-indexed) of mermaid-fenced blocks and root-level H1s.
 *
 * Fence tracking uses the opening backtick count — a fence only closes on a
 * line of >= that many backticks with no info-string. This handles nested
 * fences (e.g. a 4-backtick outer fence containing 3-backtick inner ones).
 */
function scanBody(source, frontmatterEndLine) {
  const lines = source.split(/\r?\n/);
  const mermaid = [];
  const h1 = [];
  let fenceLen = 0;
  const FENCE_RE = /^\s{0,3}(`{3,})\s*([a-zA-Z0-9_-]*)/;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (frontmatterEndLine && lineNo <= frontmatterEndLine) continue;
    const line = lines[i];
    const m = FENCE_RE.exec(line);
    if (m) {
      const ticks = m[1].length;
      const lang = (m[2] || '').toLowerCase();
      if (fenceLen === 0) {
        fenceLen = ticks;
        if (lang === 'mermaid') mermaid.push(lineNo);
      } else if (ticks >= fenceLen && !lang) {
        fenceLen = 0;
      }
      continue;
    }
    if (fenceLen === 0 && /^# \S/.test(line)) {
      h1.push(lineNo);
    }
  }
  return { mermaid, h1 };
}

/** Flat YAML-ish field probe: does a top-level `key:` line exist? */
function hasTopLevelField(fmBody, key) {
  const re = new RegExp(`^${key}\\s*:`, 'm');
  return re.test(fmBody);
}

async function main() {
  if (!(await exists(CONTENT_DIR))) {
    console.log(`${DIM}validate-content: no src/content/courses — skipping.${RESET}`);
    return;
  }

  const files = await collectMdx(CONTENT_DIR);
  const errors = [];
  const dirToFiles = new Map();

  for (const abs of files) {
    const name = basename(abs);
    const dir = dirname(abs);
    if (!dirToFiles.has(dir)) dirToFiles.set(dir, new Set());
    dirToFiles.get(dir).add(name);

    const rel = relative(ROOT, abs);
    const source = await readFile(abs, 'utf8');

    const fm = parseFrontmatter(source);
    if (!fm) {
      errors.push(
        `${rel}:1 missing frontmatter block (rule: frontmatter-presence)`,
      );
      continue;
    }

    if (name === 'index.mdx') {
      if (!hasTopLevelField(fm.body, 'title')) {
        errors.push(
          `${rel}:1 chapter index.mdx frontmatter missing \`title:\` ` +
            `(rule: frontmatter-presence)`,
        );
      }
      if (!hasTopLevelField(fm.body, 'course')) {
        errors.push(
          `${rel}:1 chapter index.mdx frontmatter missing \`course:\` ` +
            `(rule: frontmatter-presence)`,
        );
      }
    }

    if (CHAPTER_BODY_FILES.has(name)) {
      const { mermaid, h1 } = scanBody(source, fm.endLine);

      if (name !== 'flow.mdx') {
        for (const lineNo of mermaid) {
          errors.push(
            `${rel}:${lineNo} \`\`\`mermaid fence only allowed in flow.mdx ` +
              `(rule: mermaid-flow-only)`,
          );
        }
      }

      for (const lineNo of h1) {
        errors.push(
          `${rel}:${lineNo} H1 (\`# \`) not allowed in chapter body; ` +
            `ChapterHeader owns the <h1> (rule: no-h1-in-body)`,
        );
      }
    }
  }

  for (const [dir, fileSet] of dirToFiles) {
    const hasView = VIEW_FILES.some((v) => fileSet.has(v));
    if (hasView && !fileSet.has('index.mdx')) {
      const relDir = relative(ROOT, dir);
      for (const v of VIEW_FILES) {
        if (fileSet.has(v)) {
          errors.push(
            `${relDir}/${v}:1 orphan ${v} — sibling index.mdx missing ` +
              `(rule: orphan-view)`,
          );
        }
      }
    }
  }

  const total = files.length;
  const failedFiles = new Set(errors.map((e) => e.slice(0, e.indexOf(':')))).size;
  const passedFiles = total - failedFiles;

  if (errors.length > 0) {
    for (const err of errors) console.error(`${RED}error:${RESET} ${err}`);
    console.error(
      `${RED}validate-content: FAILED${RESET} — validated ${total} files, ` +
        `${passedFiles} passed, ${failedFiles} failed`,
    );
    process.exit(1);
  }

  console.log(
    `${GREEN}validate-content: OK${RESET} — validated ${total} files, ` +
      `${total} passed, 0 failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
