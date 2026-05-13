const sharp = require('sharp')
async function main() {
  const source = 'public/icons/spinzy-logo-owl.png'
  const meta = await sharp(source).metadata()
  const W = meta.width
  const H = meta.height
  const third = Math.floor(W / 3)
  console.log(`Source: ${W}x${H}, each third: ${third}px`)

//   // LEFT THIRD -- favicon owl face icon
//   await sharp(source)
//     .extract({ left: padX, top: padY, width: third - (padX * 2), height: H - (padY * 2) })
//     .png()
//     .toFile('public/icons/spinzy-favicon-source.png')
//   console.log('✅ spinzy-favicon-source.png')

//   // MIDDLE THIRD -- navbar icon + Spinzy text
//   await sharp(source)
//     .extract({ left: third + padX, top: padY, width: third - (padX * 2), height: H - (padY * 2) })
//     .png()
//     .toFile('public/icons/spinzy-navbar-source.png')
//   console.log('✅ spinzy-navbar-source.png')

//   // RIGHT THIRD -- full marketing logo
//   await sharp(source)
//     .extract({ left: (third * 2) + padX, top: padY, width: third - (padX * 2), height: H - (padY * 2) })
//     .png()
//     .toFile('public/icons/spinzy-marketing-source.png')
//   console.log('✅ spinzy-marketing-source.png')
}
main().catch(console.error)
