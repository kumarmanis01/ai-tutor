#!/usr/bin/env node

// Ensure IVFFLAT index exists on DoubtKb for integration tests
// This script is safe to run repeatedly; it uses CREATE INDEX IF NOT EXISTS.

require('./_env-loader').loadEnv();

(async () => {
  try {
    const mod = await import('@prisma/client')
    const { PrismaClient } = mod
    const prisma = new PrismaClient()

    const sql = `CREATE INDEX IF NOT EXISTS "DoubtKb_embedding_ivfflat_idx" ON "DoubtKb" USING ivfflat (embedding public.vector_cosine_ops) WITH (lists = 100);`;
    console.log('Creating IVFFLAT index (if missing)')
    await prisma.$executeRawUnsafe(sql)
    console.log('Running ANALYZE on DoubtKb')
    await prisma.$executeRawUnsafe('ANALYZE "DoubtKb";')
    await prisma.$disconnect()
    console.log('IVFFLAT index ensure complete')
    process.exit(0)
  } catch (err) {
    console.error('ensure-doubtkb-index failed:', err)
    try { process.exit(1) } catch(e) { /* ignore */ }
  }
})()
