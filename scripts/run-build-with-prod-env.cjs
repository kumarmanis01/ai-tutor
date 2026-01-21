#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const child = require('child_process')

function parseEnvFile(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    let val = trimmed.slice(idx + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const repoRoot = path.resolve(process.cwd())
const envFile = path.resolve(repoRoot, '.env.production')
const env = parseEnvFile(envFile)
console.log('Loaded env keys from .env.production:', Object.keys(env))

const mergedEnv = Object.assign({}, process.env, env)
// Ensure NODE_ENV=production
mergedEnv.NODE_ENV = mergedEnv.NODE_ENV || 'production'

const res = child.spawnSync('npm', ['run', 'build:prod'], { stdio: 'inherit', env: mergedEnv })
process.exit(res.status)
