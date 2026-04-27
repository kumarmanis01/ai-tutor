#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const banned = ['dotenv', 'ts-node', 'tsconfig-paths']
const root = path.resolve(process.cwd(), 'dist')

function walk(dir) {
  const files = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

if (!fs.existsSync(root)) {
  console.log('dist not found, skipping verify-dist')
  process.exit(0)
}

const files = walk(root)
for (const token of banned) {
  const found = files.find((f) => fs.readFileSync(f, 'utf8').includes(token))
  if (found) {
    console.error(`❌ Forbidden dependency in dist: ${token} (found in ${found})`)
    process.exit(1)
  }
}
console.log('✅ dist is production-clean')
process.exit(0)
