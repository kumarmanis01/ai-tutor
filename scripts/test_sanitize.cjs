require('dotenv').config({ path: '.env.production' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function sanitizeLLMOutput(content) {
  if (!content || typeof content !== 'string') return content
  let s = content.trim()
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n')
    if (firstNewline !== -1) s = s.slice(firstNewline + 1)
    const closingFence = s.lastIndexOf('```')
    if (closingFence !== -1) s = s.slice(0, closingFence)
    s = s.trim()
  }
  if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1).trim()
  if (s.startsWith('~~~')) {
    const firstNewline = s.indexOf('\n')
    if (firstNewline !== -1) s = s.slice(firstNewline + 1)
    const closing = s.lastIndexOf('~~~')
    if (closing !== -1) s = s.slice(0, closing)
    s = s.trim()
  }
  return s
}

;(async () => {
  try {
    const row = await prisma.aIContentLog.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!row) return console.log('no rows')
    console.log('id:', row.id)
    const raw = row.responseBody?.choices?.[0]?.message?.content || row.responseBody || row.response
    console.log('--- original (trim 400) ---')
    console.log(String(raw).slice(0,400))
    const sanitized = sanitizeLLMOutput(String(raw))
    console.log('--- sanitized (trim 400) ---')
    console.log(sanitized.slice(0,400))
    try {
      const parsed = JSON.parse(sanitized)
      console.log('PARSE OK: chapters count=', (parsed.chapters||[]).length)
    } catch (err) {
      console.error('PARSE FAILED', err.message)
    }
  } catch(e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
})()
