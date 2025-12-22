function crc32(buf: Buffer) {
  const table = (crc32 as any).table || ((crc32 as any).table = makeTable())
  let crc = 0 ^ -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function makeTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
}

function u16(v: number) { const b = Buffer.alloc(2); b.writeUInt16LE(v,0); return b }
function u32(v: number) { const b = Buffer.alloc(4); b.writeUInt32LE(v,0); return b }

function buildLocalFileHeader(nameBuf: Buffer, dataBuf: Buffer) {
  const crc = crc32(dataBuf)
  const header = Buffer.concat([
    u32(0x04034b50), // signature
    u16(20), // version needed
    u16(0), // flags
    u16(0), // compression (0 = store)
    u16(0), // mod time
    u16(0), // mod date
    u32(crc),
    u32(dataBuf.length),
    u32(dataBuf.length),
    u16(nameBuf.length),
    u16(0) // extra
  ])
  return Buffer.concat([header, nameBuf, dataBuf])
}

function buildCentralDirHeader(nameBuf: Buffer, dataBuf: Buffer, offset: number) {
  const crc = crc32(dataBuf)
  const header = Buffer.concat([
    u32(0x02014b50),
    u16(0), // version made
    u16(20), // version needed
    u16(0), // flags
    u16(0), // compression
    u16(0), // mod time
    u16(0), // mod date
    u32(crc),
    u32(dataBuf.length),
    u32(dataBuf.length),
    u16(nameBuf.length),
    u16(0), // extra
    u16(0), // comment
    u16(0), // disk
    u16(0), // int attrs
    u32(0), // ext attrs
    u32(offset) // relative offset
  ])
  return Buffer.concat([header, nameBuf])
}

function buildEndCentralDir(numEntries: number, centralSize: number, centralOffset: number) {
  return Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(numEntries),
    u16(numEntries),
    u32(centralSize),
    u32(centralOffset),
    u16(0) // comment length
  ])
}

export function exportCourseToLMS(coursePackage: any): Buffer {
  // deterministic ordering: <slug>/index.html, <slug>/lessons/lesson-01.html..., <slug>/manifest.json
  const files: { name: string; data: Buffer }[] = []

  const title = coursePackage?.title ?? 'Course'
  const slug = slugify(title || 'course')
  const lessons: any[] = []
  if (Array.isArray(coursePackage?.modules)) {
    for (const m of coursePackage.modules) {
      if (Array.isArray(m.lessons)) for (const l of m.lessons) lessons.push(l)
    }
  }

  const indexHtml = [`<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<ul>`,
    ...lessons.map((l, i) => `<li><a href="${slug}/lessons/lesson-${pad(i+1,2)}.html">${escapeHtml(l.title ?? 'Lesson '+(i+1))}</a></li>`),
    `</ul>`,
    `</body></html>`].join('\n')
  files.push({ name: `${slug}/index.html`, data: Buffer.from(indexHtml, 'utf8') })

  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i]
    const parts: string[] = []
    parts.push('<html><head><meta charset="utf-8"></head><body>')
    parts.push(`<h1>${escapeHtml(l.title ?? 'Lesson '+(i+1))}</h1>`)
    if (Array.isArray(l.objectives) && l.objectives.length) {
      parts.push('<h3>Objectives</h3><ul>')
      for (const o of l.objectives) parts.push(`<li>${escapeHtml(String(o))}</li>`)
      parts.push('</ul>')
    }
    if (l.explanation?.overview) parts.push(`<p>${escapeHtml(String(l.explanation.overview))}</p>`)
    if (Array.isArray(l.explanation?.concepts)) {
      for (const c of l.explanation.concepts) {
        parts.push(`<h4>${escapeHtml(c.title ?? '')}</h4>`)
        parts.push(`<p>${escapeHtml(String(c.explanation ?? ''))}</p>`)
      }
    }
    parts.push('</body></html>')
    files.push({ name: `${slug}/lessons/lesson-${pad(i+1,2)}.html`, data: Buffer.from(parts.join('\n'), 'utf8') })
  }

  const manifest = { title, lessons: lessons.map((l: any, i: number) => ({ title: l.title ?? `Lesson ${i+1}`, file: `lessons/lesson-${pad(i+1,2)}.html` })) }
  files.push({ name: `${slug}/manifest.json`, data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') })

  // build zip
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const lf = buildLocalFileHeader(nameBuf, f.data)
    localParts.push(lf)
    const cd = buildCentralDirHeader(nameBuf, f.data, offset)
    centralParts.push(cd)
    offset += lf.length
  }
  const central = Buffer.concat(centralParts)
  const centralOffset = offset
  const end = buildEndCentralDir(files.length, central.length, centralOffset)

  const out = Buffer.concat([...localParts, central, end])
  return out
}

function pad(n: number, width: number) { return String(n).padStart(width, '0') }

function slugify(s: string) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'') }

function escapeHtml(s: string) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

export default exportCourseToLMS
