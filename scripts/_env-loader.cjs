'use strict';
// Shared env loader for CJS scripts.
// Reads the first .env file found (production -> local -> default) and
// sets any missing process.env vars. Safe to call multiple times.

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  const candidates = ['.env.production', '.env.local', '.env'];
  for (const name of candidates) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}

module.exports = { loadEnv };
