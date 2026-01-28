const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 [START] Seeding ContentCatalog from ChapterDef...');

  const chapters = await prisma.chapterDef.findMany({
    where: { lifecycle: 'active' },
    include: { subject: { select: { id: true, name: true } } },
  });

  console.log(`➡️  Found ${chapters.length} active chapters`);

  let created = 0;
  for (const c of chapters) {
    const contentId = `chapter:${c.id}`;
    const title = `Learn ${c.name}`;
    const subject = c.subject?.name || 'General';

    console.log(`   • Upserting catalog entry for chapter ${c.name} -> ${contentId}`);

    await prisma.contentCatalog.upsert({
      where: { contentId },
      update: {
        title,
        subject,
        board: '',
        grade: '',
        language: 'en',
        active: true,
        updatedAt: new Date(),
      },
      create: {
        contentId,
        title,
        description: `Auto-seeded from ChapterDef ${c.id}`,
        type: 'lesson',
        subject,
        board: '',
        grade: '',
        language: 'en',
        active: true,
      }
    });

    created++;
  }

  console.log(`🎉 [COMPLETE] Upserted ${created} ContentCatalog entries`);
}

main()
  .catch((e) => { console.error('❌ [ERROR]', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
