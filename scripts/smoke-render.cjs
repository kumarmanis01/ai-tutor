const fs = require('fs')
const path = require('path')

function render(templatePath, replacements) {
  let txt = fs.readFileSync(templatePath, 'utf8')
  for (const k of Object.keys(replacements)) {
    const v = replacements[k]
    const re = new RegExp(`\\{${k}\\}`, 'g')
    txt = txt.replace(re, String(v))
  }
  return txt
}

const promptsDir = path.join(process.cwd(), 'prompts')
const samples = {
  language: 'en',
  board: 'CBSE',
  grade: '8',
  subject: 'Mathematics',
  chapter_title: 'Number System',
  topic_title: 'Rational Numbers'
}

const files = [
  'base_context.md',
  'chapters.md',
  'topics.md',
  'notes.md',
  'questions.easy.md',
  'questions.medium.md',
  'questions.hard.md',
  'syllabus_worker_prompt.md'
]

for (const f of files) {
  const p = path.join(promptsDir, f)
  if (!fs.existsSync(p)) {
    console.warn('missing', f)
    continue
  }
  console.log('---', f, '---')
  try {
    const out = render(p, samples)
    console.log(out.slice(0, 800))
    if (out.length > 800) console.log('...[truncated]')
  } catch (err) {
    console.error('render failed for', f, err.message)
  }
}

console.log('\nSmoke render complete')
