import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

function parseEnvFile(filePath) {
  const out = {}
  try {
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
  } catch {
    // ignore missing env file; PM2 may inject env differently on some hosts
  }
  return out
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envFilePath = path.resolve(__dirname, '.env.production')
const PROD_ENV = parseEnvFile(envFilePath)

const config = {
  apps: [
    {
      name: 'ai-tutor-web',
      script: 'npm',
      cwd: __dirname,
      args: 'start',
      exec_interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      env_production: Object.assign({ NODE_ENV: 'production' }, (PROD_ENV && {
        REDIS_URL: PROD_ENV.REDIS_URL,
        DATABASE_URL: PROD_ENV.DATABASE_URL
      }) || {}),
      error_file: 'logs/ai-tutor-web-error.log',
      out_file: 'logs/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 5000,
      max_memory_restart: '512M',
      watch: false
    },
    {
      name: 'content-engine-worker',
      script: 'node',
      cwd: __dirname,
      args: 'dist/worker/entry.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 5000,
      max_memory_restart: '256M',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      env_production: Object.assign({ NODE_ENV: 'production' }, (PROD_ENV && {
        REDIS_URL: PROD_ENV.REDIS_URL,
        DATABASE_URL: PROD_ENV.DATABASE_URL
      }) || {}),
      error_file: 'logs/content-engine-worker-error.log',
      out_file: 'logs/content-engine-worker-out.log'
    }
  ]
}

export default config
module.exports = {
  apps: [
    {
      name: 'ai-tutor-web',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/web-error.log',
      out_file: 'logs/web-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'content-engine-worker',
      script: 'dist/worker/loop.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
