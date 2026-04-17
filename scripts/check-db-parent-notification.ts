import { prisma } from '@/lib/prisma'

async function main() {
  try {
    const parentProfileCol = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ParentProfile' AND column_name='inactivityOptOut'`
    )

    const parentNotificationTable = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='ParentNotification'`
    )

    const migrations = await prisma.$queryRawUnsafe(
      `SELECT id, migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10`
    )

    console.log('parentProfileCol:', parentProfileCol)
    console.log('parentNotificationTable:', parentNotificationTable)
    console.log('recentMigrations:', migrations)
  } catch (err) {
    console.error('check-db failed', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
