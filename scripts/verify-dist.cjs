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

const allowedExt = new Set(['.js', '.mjs', '.cjs', '.json', '.map', '.d.ts', '.ts'])
const files = walk(root).filter((f) => allowedExt.has(path.extname(f)))
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

for (const token of banned) {
  let found = null

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const code = stripComments(src)

    if (token === 'dotenv') {
      // Only consider an actual import/use of dotenv (not mere mentions in comments).
      // Also only enforce this in production builds — local/dev builds may mention dotenv.
      if (process.env.NODE_ENV !== 'production') continue

      const importPattern = /\b(require\(['"]dotenv(?:\/config)?['"]\)|import\s+['"][^'"\n]*dotenv(?:\/config)?['"]|import\s+.+from\s+['"]dotenv(?:\/config)?['"])/
      const usePattern = /\bdotenv\.config\s*\(/
      if (importPattern.test(code) || usePattern.test(code)) {
        found = f
        break
      }

      continue
    }

    if (code.includes(token)) {
      found = f
      break
    }
  }

  if (found) {
    console.error(`❌ Forbidden dependency in dist: ${token} (found in ${found})`)
    process.exit(1)
  }
}
console.log('✅ dist is production-clean')
process.exit(0)
