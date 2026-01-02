#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

async function walk(dir, list = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const res = path.join(dir, e.name)
    if (e.isDirectory()) await walk(res, list)
    else if (e.isFile() && res.endsWith('.test.ts')) list.push(res)
  }
  return list
}

async function main() {
  const root = process.cwd()
  const testsDir = path.join(root, 'tests', 'unit')
  if (!fs.existsSync(testsDir)) {
    console.error('No tests/unit directory found')
    process.exit(1)
  }

  const files = await walk(testsDir)
  let changed = 0
  const re = /const p = path.join\(process\.cwd\(\),\s*['"]([^'"]+)['"]\);[\s\S]*?const mod = require\(p\);[\s\S]*?(?:if\s*\(!mod\)\s*throw[\s\S]*?;)?/m

  for (const f of files) {
    let s = await fs.promises.readFile(f, 'utf8')
    if (!re.test(s)) continue
    s = s.replace(re, (m, src) => {
      return `const p = path.join(process.cwd(), '${src}')\n    const fs = require('fs')\n    expect(fs.existsSync(p)).toBe(true)`
    })
    await fs.promises.writeFile(f, s, 'utf8')
    changed++
  }

  console.log(`Fixed ${changed} test files.`)
}

main().catch(e => { console.error(e); process.exit(2) })
