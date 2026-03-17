/**
 * Generate PWA icon set from public/icons/teacher-vidya.svg
 * Sizes: 72, 96, 128, 144, 152, 192, 384, 512
 * Also writes public/apple-touch-icon.png (192px copy)
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

const SVG_PATH   = path.join(process.cwd(), 'public', 'icons', 'teacher-vidya.svg');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  console.log('Read SVG:', SVG_PATH);

  for (const size of SIZES) {
    const out = path.join(OUTPUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  ✓ icon-${size}.png`);
  }

  // apple-touch-icon is a copy of the 192px icon
  const appleOut = path.join(process.cwd(), 'public', 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(appleOut);
  console.log('  ✓ apple-touch-icon.png (192px)');

  console.log('\nDone — all icons written to public/icons/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
