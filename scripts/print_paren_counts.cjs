const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'worker/services/paymentDunningWorker.ts');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
for (let i = 0; i < Math.min(lines.length, 40); i++) {
  const line = lines[i];
  const open = (line.match(/\(/g) || []).length;
  const close = (line.match(/\)/g) || []).length;
  console.log(`${i + 1}: ( +${open} ) -${close} | ${line}`);
}
