#!/usr/bin/env node
const pkg = require('@prisma/client')
const { PrismaClient } = pkg
const prisma = new PrismaClient()

;(async ()=>{
  try{
    const lock = await prisma.jobLock.findUnique({ where: { jobName: 'hydration_reconciler' } })
    console.log('JobLock:', JSON.stringify(lock, null, 2))
    await prisma.$disconnect()
  }catch(err){
    console.error('ERROR:', err)
    process.exitCode = 1
  }
})()
