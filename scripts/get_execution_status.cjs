// Load .env.production without dotenv to avoid loading dev-only helpers in production
const fs = require('fs');
const path = require('path');
function loadEnvFile(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=', 2);
      if (parts.length === 2) {
        const k = parts[0].trim();
        const v = parts[1].trim();
        if (!process.env[k]) process.env[k] = v;
      }
    });
  } catch {}
}
loadEnvFile(path.resolve(process.cwd(), '.env.production'));
process.env.DEBUG = '';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
(async ()=>{
  try{
    const id = process.argv[2] || 'cmkldminn000e4acsktlqwkl1'
    const ex = await prisma.executionJob.findUnique({ where: { id } })
    console.log(JSON.stringify(ex, null, 2))
  }catch(e){ console.error(e) } finally { await prisma.$disconnect() }
})();
