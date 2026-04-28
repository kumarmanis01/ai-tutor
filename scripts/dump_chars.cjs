const fs = require('fs');
const s = fs.readFileSync('worker/services/paymentDunningWorker.ts', 'utf8');
const idx = s.indexOf('Payment applied from credits');
console.log('idx', idx);
if (idx < 0) process.exit(0);
const start = Math.max(0, idx - 20);
const end = Math.min(s.length, idx + 120);
const sub = s.slice(start, end);
console.log(sub);
for (let i = 0; i < sub.length; i++) {
  const ch = sub[i];
  const code = ch.charCodeAt(0);
  if (code > 127 || ch === '`' || ch === '"' || ch === "'") {
    console.log(i + start, ch, code, '0x' + code.toString(16));
  }
}
