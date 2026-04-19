#!/usr/bin/env node
const jobId = process.argv[2]
if (!jobId) {
  console.error('Usage: node scripts/tmp-list-children.cjs <rootHydrationJobId>')
  process.exit(2)
}

;(async ()=>{
  try{
    const pkg = require('@prisma/client')
    const { PrismaClient } = pkg
    const prisma = new PrismaClient()

    const children = await prisma.hydrationJob.findMany({ where: { rootJobId: jobId }, orderBy: { createdAt: 'asc' } })
    console.log('CHILD_HYDRATION_JOBS count=', children.length)
    for (const c of children) {
      console.log('---')
      console.log('id:', c.id)
      console.log('jobType:', c.jobType)
      console.log('hierarchyLevel:', c.hierarchyLevel)
      console.log('status:', c.status)
      console.log('lastError:', c.lastError)
      console.log('createdAt:', c.createdAt)
      console.log('updatedAt:', c.updatedAt)
    }
    await prisma.$disconnect()
  }catch(err){
    console.error('ERROR:', err)
    process.exitCode=1
  }
})()
