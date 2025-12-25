#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')
;(async () => {
  const prisma = new PrismaClient()
  try {
    const res = await prisma.jobLock.deleteMany({ where: { jobName: 'analytics_jobs' } })
    console.log('cleared job lock', res)
  } catch (err) {
    console.error('failed to clear job lock', err)
    process.exit(2)
  } finally {
    await prisma.$disconnect()
  }
})()
