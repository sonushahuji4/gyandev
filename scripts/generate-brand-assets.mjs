#!/usr/bin/env node
/**
 * One-shot generator for brand assets and favicons.
 *
 * Source: `.claude/plans/brand/Gyan_Dev_Brand_Logo.png` (1408×768, full
 * composition: icon + wordmark + tagline).
 *
 * Outputs to `public/brand/` (logomark sizes + full logo PNG+WebP) and
 * `public/` (favicons + apple-touch + android-chrome).
 *
 * Cropping: the icon region (book + sprout + star) sits in the top ~63%
 * of the source. Hand-tuned bounds keep the icon centered with a small
 * breathing margin, without leaking wordmark pixels.
 */
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.claude/plans/brand/Gyan_Dev_Brand_Logo.png');
const OUT_BRAND = path.join(ROOT, 'public/brand');
const OUT_PUBLIC = path.join(ROOT, 'public');

// Icon crop bounds (tuned for 1408×768 source).
// The icon is horizontally centered around x≈704 and spans roughly
// y=30 (star tip) to y=485 (bottom of book). Square crop with small pad.
const ICON_CROP = {
  left: 464,
  top: 10,
  width: 480,
  height: 480,
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function buildMultiIco(entries) {
  // Minimal ICO encoder with PNG payloads. Each entry: { size, buffer }.
  const n = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(n, 4);

  const directory = Buffer.alloc(16 * n);
  let offset = 6 + 16 * n;
  const bodies = [];
  for (let i = 0; i < n; i++) {
    const { size, buffer } = entries[i];
    const len = buffer.length;
    directory[i * 16 + 0] = size >= 256 ? 0 : size;
    directory[i * 16 + 1] = size >= 256 ? 0 : size;
    directory[i * 16 + 2] = 0;
    directory[i * 16 + 3] = 0;
    directory.writeUInt16LE(1, i * 16 + 4);
    directory.writeUInt16LE(32, i * 16 + 6);
    directory.writeUInt32LE(len, i * 16 + 8);
    directory.writeUInt32LE(offset, i * 16 + 12);
    bodies.push(buffer);
    offset += len;
  }
  return Buffer.concat([header, directory, ...bodies]);
}

async function main() {
  try {
    await fs.access(SRC);
  } catch {
    console.error(`❌ source not found: ${SRC}`);
    process.exit(1);
  }

  await ensureDir(OUT_BRAND);
  await ensureDir(OUT_PUBLIC);

  const srcBuf = await fs.readFile(SRC);
  const meta = await sharp(srcBuf).metadata();
  console.log(`source: ${meta.width}×${meta.height} ${meta.format}`);

  // ---------- Full logo (hero/marketing) ----------
  await sharp(srcBuf).toFile(path.join(OUT_BRAND, 'logo-full.png'));
  await sharp(srcBuf)
    .webp({ quality: 88 })
    .toFile(path.join(OUT_BRAND, 'logo-full.webp'));
  console.log('✓ logo-full.png + logo-full.webp');

  // ---------- Logomark sizes ----------
  const makeMark = async (size) => {
    const buf = await sharp(srcBuf)
      .extract(ICON_CROP)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return buf;
  };

  const mark512 = await makeMark(512);
  const mark256 = await makeMark(256);
  const mark192 = await makeMark(192);
  const mark180 = await makeMark(180);
  const mark128 = await makeMark(128);
  const mark64 = await makeMark(64);
  const mark32 = await makeMark(32);
  const mark16 = await makeMark(16);

  await fs.writeFile(path.join(OUT_BRAND, 'logomark.png'), mark512);
  await fs.writeFile(path.join(OUT_BRAND, 'logomark-256.png'), mark256);
  await fs.writeFile(path.join(OUT_BRAND, 'logomark-128.png'), mark128);
  await fs.writeFile(path.join(OUT_BRAND, 'logomark-64.png'), mark64);
  console.log('✓ logomark-{512,256,128,64}.png');

  // ---------- Favicons ----------
  await fs.writeFile(path.join(OUT_PUBLIC, 'favicon-16x16.png'), mark16);
  await fs.writeFile(path.join(OUT_PUBLIC, 'favicon-32x32.png'), mark32);
  await fs.writeFile(path.join(OUT_PUBLIC, 'apple-touch-icon.png'), mark180);
  await fs.writeFile(path.join(OUT_PUBLIC, 'android-chrome-192x192.png'), mark192);
  await fs.writeFile(path.join(OUT_PUBLIC, 'android-chrome-512x512.png'), mark512);
  console.log('✓ favicon PNGs + apple-touch + android-chrome');

  // ---------- Multi-size ICO ----------
  const icoBuf = await buildMultiIco([
    { size: 16, buffer: mark16 },
    { size: 32, buffer: mark32 },
    { size: 48, buffer: await makeMark(48) },
  ]);
  await fs.writeFile(path.join(OUT_PUBLIC, 'favicon.ico'), icoBuf);
  console.log(`✓ favicon.ico (multi-size, ${icoBuf.length} bytes)`);

  console.log('\nall assets generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
