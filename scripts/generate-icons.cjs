const sharp = require('sharp')
const fs = require('fs')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function generateBrandIcons() {
  console.log('\n--- Generating Spinzy brand icons (owl logo) ---')
  const source = 'public/icons/spinzy-logo-source.png'
  for (const size of sizes) {
    const padding = Math.floor(size * 0.08)
    const innerSize = size - (padding * 2)
    await sharp(source)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .extend({
        top: padding, bottom: padding,
        left: padding, right: padding,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(`public/icons/icon-${size}.png`)
    console.log(`✅ icon-${size}.png`)
  }
  fs.copyFileSync('public/icons/icon-192.png', 'public/apple-touch-icon.png')
  console.log('✅ apple-touch-icon.png')
}

async function generateVidyaAvatar() {
  console.log('\n--- Generating Teacher Vidya avatar ---')
  const source = 'public/icons/teacher-vidya-source.png'
  const meta = await sharp(source).metadata()
  const cropHeight = Math.floor(meta.height * 0.65)
  await sharp(source)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile('public/icons/teacher-vidya-avatar.png')
  console.log('✅ teacher-vidya-avatar.png')
  await sharp(source)
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(96, 96, { fit: 'cover', position: 'top' })
    .png()
    .toFile('public/icons/teacher-vidya-96.png')
  console.log('✅ teacher-vidya-96.png')
}

async function generateFavicon() {
  console.log('\n--- Generating favicon ---')
  await sharp('public/icons/spinzy-logo-source.png')
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile('public/favicon.png')
  console.log('✅ favicon.png (32px owl)')
}

async function main() {
  await generateBrandIcons()
  await generateVidyaAvatar()
  await generateFavicon()
  console.log('\n✅ All icons generated successfully')
}

main().catch(console.error)
