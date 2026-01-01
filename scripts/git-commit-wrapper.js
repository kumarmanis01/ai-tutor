#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Usage: node scripts/git-commit-wrapper.js [--dry] [git-commit-args...]
// Example: node scripts/git-commit-wrapper.js -m "message"

const args = process.argv.slice(2);
const dryIndex = args.indexOf('--dry');
const dry = dryIndex !== -1;
if (dry) args.splice(dryIndex, 1);

if (args.length === 0) {
  console.error('git-commit-wrapper: no args provided. Example: node scripts/git-commit-wrapper.js -m "msg"');
  process.exit(2);
}

const cmd = ['commit', ...args];
console.log((dry ? '[dry-run] ' : '') + 'Running: git ' + cmd.join(' '));
if (dry) process.exit(0);

const res = spawnSync('git', cmd, { stdio: 'inherit' });
if (res.error) {
  console.error('git commit failed:', res.error);
  process.exit(1);
}
process.exit(res.status === null ? 1 : res.status);
