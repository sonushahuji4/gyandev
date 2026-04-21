#!/usr/bin/env node
/**
 * WCAG contrast validator for `--color-*` tokens in `src/styles/global.css`.
 *
 * Reads two scopes:
 *   - light  — tokens inside `@theme { ... }`
 *   - dark   — tokens inside `html.dark { ... }` (overrides)
 *
 * For each pair in `scripts/contrast-pairs.json`, computes the WCAG 2.x
 * relative-luminance contrast ratio in BOTH themes and fails (exit 1) if
 * either theme drops below the pair's `min`.
 *
 * Supported color forms for `--color-*` values:
 *   - `#rgb` / `#rrggbb` / `#rrggbbaa`
 *   - `rgb(r g b [/ a])`, `rgba(...)`, comma or space-separated
 *
 * Anything else (tokens that reference other tokens via `color-mix()`,
 * named colors, HSL) fails validation with an explicit "unsupported color
 * form" message so we never silently skip a pair.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(REPO_ROOT, 'src/styles/global.css');
const PAIRS_PATH = path.join(__dirname, 'contrast-pairs.json');

// ---------------------------------------------------------------------------
// Block extraction
// ---------------------------------------------------------------------------

/**
 * Strip `/* ... *\/` block comments so selector matches aren't fooled by text
 * inside documentation comments.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Extract a top-level block's contents given an opening brace selector regex.
 * Handles nested braces so `@theme { ... }` containing `rgb(0 0 0 / 0.5)`
 * parentheses is matched correctly.
 */
function extractBlock(source, openRegex) {
  const match = openRegex.exec(source);
  if (!match) return null;
  const braceStart = source.indexOf('{', match.index + match[0].length - 1);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  return null;
}

/** Parse `--color-foo: <value>;` declarations inside a block into a Map. */
function parseTokens(block) {
  const tokens = new Map();
  const re = /--(color-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block))) {
    tokens.set(`--${m[1]}`, m[2].trim());
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Color parsing
// ---------------------------------------------------------------------------

function parseHex(raw) {
  const hex = raw.replace('#', '');
  let r;
  let g;
  let b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function parseRgb(raw) {
  // Tolerant: `rgb(r g b)`, `rgb(r, g, b)`, `rgb(r g b / a)`, `rgba(...)`.
  const inside = raw.replace(/^rgba?\s*\(/i, '').replace(/\)$/, '');
  const withoutAlpha = inside.split('/')[0].trim();
  const parts = withoutAlpha.split(/[\s,]+/).filter(Boolean).slice(0, 3);
  if (parts.length !== 3) return null;
  const [r, g, b] = parts.map((p) => Number(p.replace('%', '')));
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function parseColor(raw) {
  const value = raw.trim();
  if (value.startsWith('#')) return parseHex(value);
  if (/^rgba?\(/i.test(value)) return parseRgb(value);
  return null;
}

// ---------------------------------------------------------------------------
// WCAG contrast math
// ---------------------------------------------------------------------------

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function resolve(theme, name) {
  return theme.get(name);
}

function check(pair, themeName, tokens) {
  const fgRaw = resolve(tokens, pair.fg);
  const bgRaw = resolve(tokens, pair.bg);
  if (!fgRaw || !bgRaw) {
    return {
      ok: false,
      reason: `token not found (${!fgRaw ? pair.fg : pair.bg})`,
    };
  }
  const fg = parseColor(fgRaw);
  const bg = parseColor(bgRaw);
  if (!fg || !bg) {
    return {
      ok: false,
      reason: `unsupported color form: fg=${fgRaw}, bg=${bgRaw}`,
    };
  }
  const ratio = contrastRatio(fg, bg);
  return {
    ok: ratio >= pair.min,
    ratio,
    min: pair.min,
    fg: fgRaw,
    bg: bgRaw,
  };
}

function main() {
  const css = stripComments(readFileSync(CSS_PATH, 'utf8'));
  const pairs = JSON.parse(readFileSync(PAIRS_PATH, 'utf8'));

  const themeBlock = extractBlock(css, /@theme\s*\{/);
  const darkBlock = extractBlock(css, /html\.dark\s*\{/);
  if (!themeBlock) {
    console.error('check-contrast: could not find @theme { ... } block in global.css');
    process.exit(2);
  }
  if (!darkBlock) {
    console.error('check-contrast: could not find html.dark { ... } block in global.css');
    process.exit(2);
  }

  const light = parseTokens(themeBlock);
  const dark = new Map(light); // dark inherits then overrides
  for (const [k, v] of parseTokens(darkBlock)) dark.set(k, v);

  const failures = [];
  let passCount = 0;

  for (const pair of pairs) {
    for (const [themeName, tokens] of [['light', light], ['dark', dark]]) {
      const result = check(pair, themeName, tokens);
      const label = `${themeName.padEnd(5)}  ${pair.fg} on ${pair.bg}`;
      if (!result.ok && result.reason) {
        failures.push({ pair, themeName, result });
        console.error(`✗ ${label} — ${result.reason}`);
        continue;
      }
      if (!result.ok) {
        failures.push({ pair, themeName, result });
        console.error(
          `✗ ${label} — ratio ${result.ratio.toFixed(2)}:1 < required ${result.min}:1`
        );
        continue;
      }
      passCount += 1;
      console.log(
        `✓ ${label} — ratio ${result.ratio.toFixed(2)}:1 ≥ ${result.min}:1  (${pair.label})`
      );
    }
  }

  console.log(`\n${passCount} pass, ${failures.length} fail`);
  if (failures.length > 0) process.exit(1);
}

main();
