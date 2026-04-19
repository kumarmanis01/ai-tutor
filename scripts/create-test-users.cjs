'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main(){
  try {
    const COUNT = parseInt(process.env.TEST_USER_COUNT || '10', 10);
    const emails = [];
    for (let i = 0; i < COUNT; i++){
      const email = `seed-user-${i}@example.com`;
      emails.push(email);
      const up = await prisma.user.upsert({
        where: { email },
        update: { language: 'en', board: 'CBSE', grade: '6' },
        create: { email, language: 'en', board: 'CBSE', grade: '6', name: `Seed User ${i}` }
      });
      console.log('Upserted user:', up.email, up.id);
    }
    console.log('Created/updated', emails.length, 'test users.');
    process.exit(0);
  } catch (e) {
    console.error('Error creating test users:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
