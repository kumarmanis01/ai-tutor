const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'worker/services/paymentDunningWorker.ts');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
let brace=0, paren=0, bracket=0;
for(let i=0;i<lines.length;i++){
  const line = lines[i];
  let deltaBrace=0, deltaParen=0, deltaBracket=0;
  for(let ch of line){
    if(ch==='{') { brace++; deltaBrace++; }
    if(ch==='}') { brace--; deltaBrace--; }
    if(ch==='(') { paren++; deltaParen++; }
    if(ch===')') { paren--; deltaParen--; }
    if(ch==='[') { bracket++; deltaBracket++; }
    if(ch===']') { bracket--; deltaBracket--; }
  }
  if(deltaParen<0 || deltaBrace<0 || deltaBracket<0 || brace<0 || paren<0 || bracket<0){
    console.log(`NEGATIVE at ${i+1}: brace=${brace} (Δ${deltaBrace}) paren=${paren} (Δ${deltaParen}) bracket=${bracket} (Δ${deltaBracket})`);
    console.log('LINE:', lines[i]);
  }
}
console.log('Final counts:', {brace, paren, bracket});
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('recordPaymentEvent')){
    console.log('recordPaymentEvent at', i+1, lines[i].trim());
  }
}
