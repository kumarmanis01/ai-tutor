#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach(line => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const idx = l.indexOf('=');
    if (idx === -1) return;
    const key = l.substring(0, idx).trim();
    let val = l.substring(idx + 1).trim();
    if ((val.startsWith('\"') && val.endsWith('\"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
    process.env[key] = val; // set in current process
  });
  return env;
}

function mask(val) {
  if (!val) return '';
  if (val.length <= 8) return '****';
  return val.slice(0, 4) + '...' + val.slice(-3);
}

function printSummary(env, required) {
  console.log('Loaded .env keys:', Object.keys(env).length);
  required.forEach(k => {
    const v = process.env[k];
    if (v) console.log(`${k}=${mask(v)}`);
    else console.log(`${k}=<MISSING>`);
  });
}

function usage() {
  console.log('Usage: node scripts/run-and-validate.cjs <script-to-run> [args...]');
  process.exit(2);
}

(async function main(){
  const args = process.argv.slice(2);
  if (!args || args.length === 0) usage();
  const target = args[0];
  const targetArgs = args.slice(1);

  const envPath = path.join(process.cwd(), '.env');
  const env = loadEnv(envPath);

  // default required keys (can be overridden by REQUIRED_ENV env var)
  const required = (process.env.REQUIRED_ENV || 'NEXTAUTH_SECRET,DATABASE_URL,REDIS_URL').split(',').map(s => s.trim()).filter(Boolean);

  printSummary(env, required);

  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing required env vars:', missing.join(', '));
    process.exit(3);
  }

  // Spawn target script in a child process with the loaded env
  const nodeArgs = [target].concat(targetArgs);
  console.log('Executing:', 'node', nodeArgs.join(' '));
  const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit', env: process.env, cwd: process.cwd() });
  child.on('exit', (code, sig) => {
    if (sig) {
      console.error('Child terminated with signal', sig);
      process.exit(1);
    }
    process.exit(code);
  });
})();
