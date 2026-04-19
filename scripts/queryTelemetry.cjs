const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient();
  try{
    const rows = await prisma.telemetrySample.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    console.log('Last TelemetrySample rows:');
    for(const r of rows) console.log(r.key, r.value, r.timestamp.toISOString(), r.dimensionHash);
  }catch(e){
    console.error(e);
  }finally{ await prisma.$disconnect(); }
})();
