const { PrismaClient } = require('@prisma/client');
async function main(){
  const p = new PrismaClient();
  try{
    console.log(Object.keys(p).filter(k=>typeof p[k] !== 'function'));
    console.log('--- full keys ---');
    console.log(Object.keys(p));
  }catch(err){
    console.error('ERR', err && err.message ? err.message : err);
  }finally{ await p.$disconnect(); }
}
main();
