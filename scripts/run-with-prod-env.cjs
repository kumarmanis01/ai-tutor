#!/usr/bin/env node
/*
 * Usage:
 *  node scripts/run-with-prod-env.cjs -- <command> [args...]
 * Example:
 *  node scripts/run-with-prod-env.cjs -- npx prisma migrate dev --name init
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadEnv(envFilePath) {
  if (!fs.existsSync(envFilePath)) return {};
  const content = fs.readFileSync(envFilePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    let key = line.slice(0, idx);
    let val = line.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, '.env.production');
const envVars = loadEnv(envPath);

// Merge into process.env (without overwriting existing env vars)
for (const k of Object.keys(envVars)) {
  if (process.env[k] === undefined) process.env[k] = envVars[k];
}

const dashIndex = process.argv.indexOf('--');
const cmdArgs = dashIndex >= 0 ? process.argv.slice(dashIndex + 1) : process.argv.slice(2);
if (cmdArgs.length === 0) {
  console.error('No command provided. Usage: node scripts/run-with-prod-env.cjs -- <command> [args...]');
  process.exit(2);
}

const child = spawn(cmdArgs[0], cmdArgs.slice(1), { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code));
child.on('error', (err) => { console.error(err); process.exit(1); });
