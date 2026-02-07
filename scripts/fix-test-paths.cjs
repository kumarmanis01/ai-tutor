const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const DEV_PREFIX = 'C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\'

function processFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8')
  if (!src.includes(DEV_PREFIX)) return false

  // find the quoted path literal containing the DEV_PREFIX
  const re = /(["'])(C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\[^"']+)\1/
  const m = src.match(re)
  if (!m) return false
  const abs = m[2]
  // compute path relative from test file dir to repo
  const testDir = path.dirname(filePath)
  // compute relative path from test file to target file within repo
  const relToRepo = path.relative(testDir, path.join(ROOT, abs.replace(/\\/g, path.sep).slice(ROOT.length + 1)))

  // But the above attempt to slice ROOT length may fail. Instead, derive the target relative to repo by removing DEV_PREFIX
  let relFromRepo
  if (abs.startsWith(DEV_PREFIX)) {
    const remainder = abs.slice(DEV_PREFIX.length).replace(/\\/g, path.sep)
    relFromRepo = remainder
  } else {
    // warn and fallback to using process.cwd()
    relFromRepo = path.relative(ROOT, abs.replace(/\\/g, path.sep))
  }

  // compute path from test file to target using __dirname
  const relPath = path.join('..', relFromRepo).split(path.sep).join('/');
  // Better compute actual relative path from test file dir to target
  const targetAbs = path.join(ROOT, relFromRepo)
  const finalRel = path.relative(testDir, targetAbs).split(path.sep).join('/')

  // Replace the quoted string with path.join(__dirname, '<finalRel>')
  const replacement = `path.join(__dirname, '${finalRel.replace(/'/g, "\\'")}')`

  // Ensure we import path and not duplicate import statements
  src = src.replace(/import fs from 'fs';?\s*/m, "import fs from 'fs'\nimport path from 'path'\n\n")

  // Replace the literal
  src = src.replace(re, replacement)

  fs.writeFileSync(filePath, src, 'utf8')
  console.log('Patched', filePath)
  return true
}

function walk(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const p = path.join(dir, f)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p)
    else if (stat.isFile() && p.endsWith('.test.ts')) processFile(p)
  }
}

walk(path.join(ROOT, 'tests', 'auto'))
console.log('Done')
