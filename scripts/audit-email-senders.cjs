#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MATCH = /sendMailSafe|sendMail\s*\(/g

function walk(dir) {
  const res = []
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'coverage', 'public', 'tmp'].includes(name)) continue
    const file = path.join(dir, name)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) res.push(...walk(file))
    else if (/\.tsx?$|\.js$|\.cjs$|\.ts$/.test(name)) res.push(file)
  }
  return res
}

function find() {
  const files = walk(ROOT)
  const matches = []
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8')
    if (MATCH.test(content)) {
      const idx = content.search(MATCH)
      const start = Math.max(0, idx - 120)
      const snippet = content.slice(start, start + 240).replace(/\n/g, ' ')
      matches.push({ file: path.relative(ROOT, f), snippet })
    }
  }
  return matches
}

const found = find()
if (!found.length) console.log('No sendMail/sendMailSafe calls found')
else {
  console.log('Found sendMail/sendMailSafe occurrences:')
  for (const m of found) {
    console.log('- ', m.file)
    console.log('   ', m.snippet)
    console.log('')
  }
}
