#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

async function main(){
  const id = process.argv[2];
  if(!id){ console.error('Usage: node scripts/mark-execution-complete.js <executionJobId>'); process.exit(2) }
  const prisma = new PrismaClient();
  try{
    const exec = await prisma.executionJob.findUnique({ where: { id } });
    if(!exec){ console.error('ExecutionJob not found', id); process.exit(1)}
    await prisma.executionJob.update({ where: { id }, data: { status: 'completed', updatedAt: new Date() } });
    await prisma.jobExecutionLog.create({ data: { jobId: id, event: 'COMPLETED', prevStatus: exec.status ?? 'pending', newStatus: 'completed', meta: { note: 'manually_marked_completed' } } })
    console.log('Marked execution job completed:', id)
  }catch(e){ console.error('err', e); process.exitCode=1 }
  finally{ await prisma.$disconnect() }
}

main();
