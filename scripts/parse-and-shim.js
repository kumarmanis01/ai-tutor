#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const logPathArgIndex = argv.indexOf('--log')
const rootArgIndex = argv.indexOf('--root')
const LOG = logPathArgIndex !== -1 ? argv[logPathArgIndex + 1] : path.join(process.cwd(), 'logs', 'worker-error.log')
const ROOT = rootArgIndex !== -1 ? argv[rootArgIndex + 1] : path.join(process.cwd(), 'dist')

function extractFileUrls(text){
  const re = /file:\/\/\/(\S+)/g
  const set = new Set()
  let m
  while ((m = re.exec(text)) !== null){
    // decode and strip trailing punctuation
    const raw = decodeURIComponent(m[1]).replace(/["'\)\]]+$/,'')
    set.add(raw)
  }
  return Array.from(set)
}

function tryCreateShim(absMissingPath){
  const candidates = ['.js', '.mjs', '.cjs']
  for (const ext of candidates){
    const cand = absMissingPath + ext
    if (fs.existsSync(cand)){
      try{
        // ensure parent exists
        const dir = path.dirname(absMissingPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        if (!fs.existsSync(absMissingPath)){
          fs.symlinkSync(path.basename(cand), absMissingPath)
          console.log('shim created:', absMissingPath, '->', path.basename(cand))
          return true
        }
      }catch(e){
        console.error('failed to create shim for', absMissingPath, e && e.message)
      }
    }
  }
  console.warn('no candidate for', absMissingPath)
  return false
}

(function main(){
  if (!fs.existsSync(LOG)) return console.error('log not found:', LOG)
  const txt = fs.readFileSync(LOG, 'utf8')
  const urls = extractFileUrls(txt)
  if (!urls.length) return console.log('no file:/// URLs found in', LOG)
  console.log('found', urls.length, 'unique file URLs')
  for (const u of urls){
    // if path is inside repo, relative to root
    let p = u
    if (!path.isAbsolute(p)) p = path.resolve(p)
    // If path already exists skip
    if (fs.existsSync(p)) { console.log('exists:', p); continue }
    // If the path is inside project relative to cwd, try relative to ROOT
    const relToRoot = path.join(path.resolve(ROOT), path.relative(path.resolve(process.cwd()), p))
    if (tryCreateShim(p, ROOT)) continue
    if (tryCreateShim(relToRoot, ROOT)) continue
    // lastly try direct path under ROOT + the tail
    const tail = p.split('/').slice(-3).join('/')
    const guess = path.join(path.resolve(ROOT), tail)
    tryCreateShim(guess, ROOT)
  }
})();
