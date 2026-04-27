#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = process.argv[2] || path.join(process.cwd(), 'dist')

function walk(dir, cb){
  for (const name of fs.readdirSync(dir)){
    const p = path.join(dir, name)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p, cb)
    else if (s.isFile() && p.endsWith('.js')) cb(p)
  }
}

const importRe = /(from\s+|import\()(['"])(\.\.\/(?:src|lib|worker|workers|hydra)[^'"\)]+)(['"])/g

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
