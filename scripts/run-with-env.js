const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const idx = l.indexOf('=');
    if (idx === -1) return;
    const key = l.substring(0, idx).trim();
    let val = l.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/run-with-env.js <script-path>');
    process.exit(2);
  }
  const envPath = path.join(process.cwd(), '.env');
  loadEnv(envPath);
  const scriptPath = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  if (!fs.existsSync(scriptPath)) {
    console.error('Target script not found:', scriptPath);
    process.exit(3);
  }
  require(scriptPath);
}

main();
