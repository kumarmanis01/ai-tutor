const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED = new Set(['node_modules', '.git', 'dist', 'coverage', 'public']);
const MATCH_REGEX = /sendMailSafe\s*\(\s*\{[\s\S]*?\bhtml\s*:/m;

function walk(dir) {
  const results = [];
  for (const name of fs.readdirSync(dir)) {
    if (IGNORED.has(name)) continue;
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      results.push(...walk(file));
    } else if (/\.tsx?$|\.js$|\.ts$/.test(name)) {
      results.push(file);
    }
  }
  return results;
}

function findMatches() {
  const files = walk(ROOT);
  const matches = [];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (MATCH_REGEX.test(content)) matches.push(f);
  }
  return matches;
}

const matches = findMatches();
if (matches.length) {
  console.error('Found ad-hoc HTML sends (sendMailSafe with html) in the following files:');
  for (const m of matches) console.error(' -', path.relative(ROOT, m));
  process.exit(2);
} else {
  console.log('OK: no ad-hoc sendMailSafe({ html: ... }) patterns found');
  process.exit(0);
}
