/**
 * Generate PWA icon set from public/icons/teacher-vidya-source.png
 * Sizes: 72, 96, 128, 144, 152, 192, 384, 512
 * Also writes:
 *   public/apple-touch-icon.png      (192px copy)
 *   public/icons/teacher-vidya-avatar.png  (256px, transparent bg, face crop)
 *
 * Usage: node scripts/generate-vidya-icons.cjs
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// Resolve sharp from node_modules (may be nested under next/)
let sharp;
try {
  sharp = require('sharp');
} catch {
  try {
    sharp = require(path.join(process.cwd(), 'node_modules', 'sharp'));
  } catch {
    sharp = require(
      path.join(process.cwd(), 'node_modules', 'next', 'node_modules', 'sharp')
    );
  }
}

const SOURCE   = path.join(process.cwd(), 'public', 'icons', 'teacher-vidya-source.png');
const OUT_DIR  = path.join(process.cwd(), 'public', 'icons');
const SIZES    = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcon(size) {
  const meta = await sharp(SOURCE).metadata();
  // For small icons crop top 65% to focus on face; large icons use full image
  const cropHeight = size <= 152 ? Math.floor(meta.height * 0.65) : meta.height;

  // Purple circle background SVG
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#534AB7"/>` +
    `</svg>`
  );

  const padding   = Math.floor(size * 0.05);
  const innerSize = size - padding * 2;

  const teacherResized = await sharp(SOURCE)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const out = path.join(OUT_DIR, `icon-${size}.png`);
  await sharp(circle)
    .composite([{ input: teacherResized, top: padding, left: padding }])
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log(`  ✓ icon-${size}.png`);
}

async function generateAvatar() {
  // 256px avatar with transparent bg, face-cropped top 65%
  const meta = await sharp(SOURCE).metadata();
  const cropHeight = Math.floor(meta.height * 0.65);
  const size = 256;

  const out = path.join(OUT_DIR, 'teacher-vidya-avatar.png');
  await sharp(SOURCE)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log('  ✓ teacher-vidya-avatar.png (256px, transparent bg)');
}

async function main() {
  console.log('Generating PWA icons from:', SOURCE);

  for (const size of SIZES) {
    await generateIcon(size);
  }

  // apple-touch-icon = copy of 192px icon
  const appleOut = path.join(process.cwd(), 'public', 'apple-touch-icon.png');
  fs.copyFileSync(path.join(OUT_DIR, 'icon-192.png'), appleOut);
  console.log('  ✓ apple-touch-icon.png (192px copy)');

  await generateAvatar();

  console.log('\nDone -- all icons written to public/icons/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
