#!/usr/bin/env node
/**
 * generate-icons.cjs
 * Generates placeholder PWA icons for Spinzy.
 * Uses canvas if available, otherwise creates minimal valid PNG files.
 * All icons: purple (#534AB7) square with white "S" initial.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BG_COLOR = '#534AB7';

// Ensure output directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  console.log('Created public/icons/');
}

// Try canvas first
let canvasAvailable = false;
try {
  require.resolve('canvas');
  canvasAvailable = true;
} catch (_) {
  canvasAvailable = false;
}

if (canvasAvailable) {
  const { createCanvas } = require('canvas');
  for (const size of SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);

    // "S" initial
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.floor(size * 0.55);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', size / 2, size / 2);

    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ icon-${size}.png (canvas)`);
  }
  console.log('\nAll icons generated with canvas.');
} else {
  // Minimal valid PNG — 1×1 purple pixel, scaled by browsers.
  // PNG structure: signature + IHDR + IDAT + IEND (all CRC-correct).
  // We generate a solid-color PNG at the exact requested size using a raw
  // uncompressed IDAT chunk so no zlib dependency is needed.

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })());
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function uint32BE(n) {
    return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
  }

  function pngChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBytes, data]);
    const crc = crc32(crcInput);
    return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc)]);
  }

  // zlib "store" wrapper (method 0, no compression)
  function zlibStore(data) {
    // zlib header: CMF=0x78 (deflate, window 32k), FLG=0x01 (check bits, no dict)
    // Actually 0x7801 is valid: CM=8, CINFO=7, FCHECK=1 -> 0x7801 % 31 == 0
    const cmf = 0x78;
    const flg = 0x01;

    // deflate non-compressed block
    const BFINAL = 1; // last block
    const BTYPE = 0;  // no compression
    const len = data.length;
    const nlen = (~len) & 0xffff;

    const deflate = Buffer.alloc(5 + data.length);
    deflate[0] = (BFINAL | (BTYPE << 1));
    deflate[1] = len & 0xff;
    deflate[2] = (len >>> 8) & 0xff;
    deflate[3] = nlen & 0xff;
    deflate[4] = (nlen >>> 8) & 0xff;
    data.copy(deflate, 5);

    // Adler-32
    let s1 = 1, s2 = 0;
    for (let i = 0; i < data.length; i++) {
      s1 = (s1 + data[i]) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    const adler = (s2 << 16) | s1;

    return Buffer.concat([Buffer.from([cmf, flg]), deflate, uint32BE(adler)]);
  }

  function generatePNG(size) {
    // Parse hex color
    const r = parseInt(BG_COLOR.slice(1, 3), 16);
    const g = parseInt(BG_COLOR.slice(3, 5), 16);
    const b = parseInt(BG_COLOR.slice(5, 7), 16);

    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
    const ihdrData = Buffer.concat([
      uint32BE(size), uint32BE(size),
      Buffer.from([8, 2, 0, 0, 0]),
    ]);

    // Raw image data: for each row, filter byte (0) + RGB pixels
    const rowSize = 1 + size * 3;
    const rawData = Buffer.alloc(size * rowSize);
    for (let y = 0; y < size; y++) {
      const offset = y * rowSize;
      rawData[offset] = 0; // filter type None
      for (let x = 0; x < size; x++) {
        rawData[offset + 1 + x * 3] = r;
        rawData[offset + 2 + x * 3] = g;
        rawData[offset + 3 + x * 3] = b;
      }
    }

    const idatData = zlibStore(rawData);
    const iendData = Buffer.alloc(0);

    return Buffer.concat([
      PNG_SIG,
      pngChunk('IHDR', ihdrData),
      pngChunk('IDAT', idatData),
      pngChunk('IEND', iendData),
    ]);
  }

  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    try {
      const png = generatePNG(size);
      fs.writeFileSync(outPath, png);
      console.log(`  ✓ icon-${size}.png (${size}×${size} solid purple placeholder)`);
    } catch (err) {
      console.error(`  ✗ icon-${size}.png FAILED:`, err.message);
    }
  }
  console.log('\nPlaceholder icons generated (solid purple — no canvas available).');
  console.log('Replace with real brand icons before launch.');
  console.log('Use https://www.pwabuilder.com/imageGenerator');
}

// Write README regardless of method
const readme = `# PWA Icons

Replace these placeholder icons with real Spinzy brand icons before launch.

## Required sizes
72, 96, 128, 144, 152, 192, 384, 512 px PNG.

## How to generate
Upload your Spinzy logo to https://www.pwabuilder.com/imageGenerator
It generates all required sizes instantly, including maskable variants.

NOTE FOR MANISH: The real brand icons must come from the actual Spinzy logo.
`;
fs.writeFileSync(path.join(ICONS_DIR, 'README.md'), readme);
console.log('  ✓ README.md');
