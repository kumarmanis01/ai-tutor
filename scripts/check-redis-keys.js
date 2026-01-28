#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import IORedis from 'ioredis'

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

async function main() {
  const envFile = path.resolve(process.cwd(), '.env.production')
  const env = parseEnvFile(envFile)
  const redisUrl = process.env.REDIS_URL || env.REDIS_URL
  if (!redisUrl) {
    console.error('REDIS_URL not found in environment or .env.production')
    process.exitCode = 2
    return
  }

  console.log('Connecting to Redis...')
  const r = new IORedis(redisUrl)
  try {
    await r.ping()
  } catch (e) {
    console.error('Redis connection failed:', e.message || e)
    r.disconnect()
    process.exitCode = 3
    return
  }

  const patterns = [
    'bull:content-hydration*',
    'bull:content-engine*',
    'bull:*content-hydration*'
  ]

  for (const p of patterns) {
    console.log(`Scanning pattern: ${p}`)
    let keys = []
    if (typeof r.scanIterator === 'function') {
      try {
        for await (const k of r.scanIterator({ MATCH: p })) {
          keys.push(k)
        }
      } catch {
        // fallback to keys
      }
    }
    if (keys.length === 0) {
      try {
        keys = await r.keys(p)
      } catch (e) {
        console.error('Error running KEYS command (may be disabled):', e.message || e)
      }
    }
    console.log(`Found ${keys.length} keys for pattern ${p}`)
    if (keys.length > 0) console.log(keys.slice(0, 200).join('\n'))
  }

  r.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
