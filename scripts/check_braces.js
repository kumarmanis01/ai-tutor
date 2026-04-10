const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'worker/services/paymentDunningWorker.ts');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
let brace=0, paren=0, bracket=0;
for(let i=0;i<lines.length;i++){
  const line = lines[i];
  for(let ch of line){
    if(ch==='{') brace++;
    if(ch==='}') brace--;
    if(ch==='(') paren++;
    if(ch===')') paren--;
    if(ch==='[') bracket++;
    if(ch===']') bracket--;
  }
  if(brace<0 || paren<0 || bracket<0){
    console.log(`NEGATIVE at ${i+1}: brace=${brace} paren=${paren} bracket=${bracket}`);
  }
}
console.log('Final counts:', {brace, paren, bracket});
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('recordPaymentEvent')){
    console.log('recordPaymentEvent at', i+1, lines[i].trim());
  }
}
