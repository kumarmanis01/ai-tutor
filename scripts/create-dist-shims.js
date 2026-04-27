#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : path.join(process.cwd(), 'dist')

const exts = ['.js', '.mjs', '.cjs']

async function walk(dir, cb) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, cb)
    else if (e.isFile()) await cb(full)
  }
}

async function ensureShim(file) {
  for (const ext of exts) {
    if (file.endsWith(ext)) {
      const linkPath = file.slice(0, -ext.length)
      try {
        const stat = await fs.promises.lstat(linkPath).catch(() => null)
        if (stat) return // already exists
        const target = path.basename(file)
        await fs.promises.symlink(target, linkPath)
        console.log('created shim:', linkPath, '->', target)
      } catch (err) {
        console.error('shim error for', file, err && err.message)
      }
      return
    }
  }
}

(async function main(){
  try{
    const root = path.resolve(ROOT)
    if (!fs.existsSync(root)) {
      console.error('dist root not found:', root)
      process.exit(2)
    }
    await walk(root, async (f) => { await ensureShim(f) })
    console.log('shims complete')
  }catch(err){
    console.error(err)
    process.exit(1)
  }
})();
