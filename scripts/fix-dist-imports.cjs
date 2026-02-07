#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

// By default operate only on the worker output to avoid touching Next runtime files.
// To operate on the top-level `dist` explicitly pass the root as the first arg
// AND provide the `--force` flag to acknowledge the risk.
const userRoot = process.argv[2]
const FORCE = process.argv.includes('--force')
const DEFAULT_ROOT = path.join(process.cwd(), 'dist', 'worker')
let ROOT = userRoot || DEFAULT_ROOT
ROOT = path.resolve(ROOT)

const topLevelDist = path.resolve(path.join(process.cwd(), 'dist'))
if (!userRoot) {
  // default to worker output
  if (!fs.existsSync(ROOT)) {
    console.error('worker dist not found at', ROOT, '\nRun a workers build first or pass an explicit root.')
    process.exit(1)
  }
} else {
  // user provided a root; disallow operating on top-level dist unless --force
  if (ROOT === topLevelDist && !FORCE) {
    console.error('\nRefusing to run on top-level dist. This script can modify Next/React server files and cause runtime issues.')
    console.error('If you really want to run on the top-level dist, re-run with:')
    console.error('  node scripts/fix-dist-imports.cjs dist --force\n')
    process.exit(1)
  }
}

function walk(dir, cb){
  for (const name of fs.readdirSync(dir)){
    const p = path.join(dir, name)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p, cb)
    else if (s.isFile() && p.endsWith('.js')) cb(p)
  }
}

const importRe = /(from\s+|import\()(['"])(\.\.?\/[^'"\)]+)(['"])/g

let patched = 0
walk(ROOT, (file) => {
  try{
    let src = fs.readFileSync(file, 'utf8')
    const out = src.replace(importRe, (m, prefix, q, imp, q2) => {
      if (imp.endsWith('.js') || imp.endsWith('.mjs') || imp.endsWith('.cjs')) return m
      return `${prefix}${q}${imp}.js${q2}`
    })
    if (out !== src){
      fs.writeFileSync(file, out, 'utf8')
      patched++
      console.log('patched', file)
    }
  }catch(e){
    console.error('err', file, e && e.message)
  }
})
console.log('done. patched files:', patched)
