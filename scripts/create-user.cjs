[10:28:26 AM] [ERROR] Content approval failed {

  "error": {

    "name": "PrismaClientKnownRequestError",

    "message": "\nInvalid `prisma.auditLog.create()` invocation:\n\n\nForeign key constraint violated on the constraint: `AuditLog_userId_fkey`",

    "stack": "PrismaClientKnownRequestError: \nInvalid `prisma.auditLog.create()` invocation:\n\n\nForeign key constraint violated on the constraint: `AuditLog_userId_fkey`\n    at ei.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7268)\n    at ei.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6593)\n    at ei.request (/app/node_modules/@prisma/client/runtime/library.js:121:6300)\n    at async a (/app/node_modules/@prisma/client/runtime/library.js:130:9551)\n    at async l (/app/.next/server/app/api/admin/content/approve/route.js:1:2582)\n    at async /app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38411\n    at async e_.execute (/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:27880)\n    at async e_.handle (/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:39943)\n    at async doRender (/app/node_modules/next/dist/server/base-server.js:1366:42)\n    at async cacheEntry.responseCache.get.routeKind (/app/node_modules/next/dist/server/base-server.js:1588:28)"

  }

}const { PrismaClient } = require('@prisma/client');

const logger = console;
const email = process.argv[2];
const name = process.argv[3] || (email ? email.split('@')[0] : undefined);

if (!email) {
  logger.error('Usage: node scripts/create-user.cjs <email> [displayName]');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info(`User already exists: ${email} (id=${existing.id})`);
    return;
  }
  const created = await prisma.user.create({
    data: {
      email,
      name,
      language: 'en',
      role: 'user'
    }
  });
  logger.info(`Created user ${email} with id ${created.id}`);
}

main()
  .catch((e) => {
    logger.error('Error creating user:', e && e.message ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
