const sharp = require('sharp')
const fs = require('fs')

async function main() {
  // PWA icons (72-152px) — owl face only (favicon source)
  console.log('\n--- PWA small icons (owl face) ---')
  for (const size of [72, 96, 128, 144, 152]) {
    await sharp('public/icons/spinzy-favicon-source.png')
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(`public/icons/icon-${size}.png`)
    console.log(`✅ icon-${size}.png`)
  }

  // PWA icons (192-512px) — full marketing logo (readable at these sizes)
  console.log('\n--- PWA large icons (full logo) ---')
  for (const size of [192, 384, 512]) {
    const padding = Math.floor(size * 0.06)
    const inner = size - padding * 2
    await sharp('public/icons/spinzy-marketing-source.png')
      .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding,
                background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(`public/icons/icon-${size}.png`)
    console.log(`✅ icon-${size}.png`)
  }

  // Favicon — owl face at 32px
  console.log('\n--- Favicons ---')
  await sharp('public/icons/spinzy-favicon-source.png')
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile('public/favicon.png')
  console.log('✅ favicon.png (32px)')

  // Apple touch icon — full logo at 192px
  fs.copyFileSync('public/icons/icon-192.png', 'public/apple-touch-icon.png')
  console.log('✅ apple-touch-icon.png')

  // Navbar icon — owl face at 40px
  await sharp('public/icons/spinzy-favicon-source.png')
    .resize(40, 40, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile('public/icons/spinzy-navbar-icon.png')
  console.log('✅ spinzy-navbar-icon.png (40px)')

  // Teacher Vidya avatar (unchanged)
  console.log('\n--- Teacher Vidya avatar ---')
  const vm = await sharp('public/icons/teacher-vidya-source.png').metadata()
  await sharp('public/icons/teacher-vidya-source.png')
    .extract({ left: 0, top: 0, width: vm.width, height: Math.floor(vm.height * 0.65) })
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('public/icons/teacher-vidya-avatar.png')
  console.log('✅ teacher-vidya-avatar.png')

  console.log('\n✅ All brand assets generated')
}

main().catch(console.error)
