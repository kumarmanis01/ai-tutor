const fs = require('fs');
const s = fs.readFileSync('worker/services/paymentDunningWorker.ts', 'utf8');
const opens = (s.match(/\(/g) || []).length;
const closes = (s.match(/\)/g) || []).length;
console.log('opens', opens, 'closes', closes, 'diff', opens - closes);
