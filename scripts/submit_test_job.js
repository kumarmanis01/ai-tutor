#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const subject = await prisma.subjectDef.findFirst()
  if (!subject) {
    console.error('No SubjectDef found in database. Create one first.')
    process.exit(2)
  }

  const payload = { language: 'en', requester: 'dev-test' }
  const job = await prisma.executionJob.create({ data: {
    jobType: 'syllabus',
    entityType: 'SUBJECT',
    entityId: subject.id,
    payload,
    status: 'pending',
    maxAttempts: 3,
  }})

  console.log('Created test job', job.id, 'for subject', subject.id)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(2) })
