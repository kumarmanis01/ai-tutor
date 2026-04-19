const { prisma } = require('../lib/prisma');
(async () => {
  const p = prisma;
  try {
    const contentCatalogCount = await p.contentCatalog.count();
    const chapterDefCount = await p.chapterDef.count();
    console.log('contentCatalog_count=' + contentCatalogCount);
    console.log('chapterDef_count=' + chapterDefCount);
  } catch (e) {
    console.error('ERROR', e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
