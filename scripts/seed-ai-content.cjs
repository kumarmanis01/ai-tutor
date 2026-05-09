#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Seed academic taxonomy (Board, ClassLevel, SubjectDef) in an idempotent manner.
 * - Provide a VPS-safe CommonJS entrypoint for board/grade/subject baseline data.
 *
 * LINKED UNIT TEST:
 * - None (seed script; validated via dry-run execution and DB checks).
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-09T10:00:00Z | copilot | created CJS version of seed-ai-content.ts for VPS execution
 */
'use strict'

const path = require('path')
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.production'),
})

const { prisma } = require('../lib/prisma')

const BOARDS = [
  {
    name: 'CBSE',
    slug: 'cbse',
    classes: [
      {
        grade: 1,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'Art Education', slug: 'art-education' },
          { name: 'Health & Physical Education', slug: 'physical-education' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 2, subjects: [] },
      {
        grade: 3,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'General Knowledge', slug: 'general-knowledge' },
          { name: 'Art Education', slug: 'art-education' },
          { name: 'Health & Physical Education', slug: 'physical-education' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 6,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Science', slug: 'science' },
          { name: 'Social Science', slug: 'social-science' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 7, subjects: [] },
      { grade: 8, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Biology', slug: 'biology' },
          { name: 'History', slug: 'history' },
          { name: 'Geography', slug: 'geography' },
          { name: 'Economics', slug: 'economics' },
          { name: 'Computer Applications', slug: 'computer-applications' },
        ],
      },
      { grade: 10, subjects: [] },
      {
        grade: 11,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Biology', slug: 'biology' },
          { name: 'Accountancy', slug: 'accountancy' },
          { name: 'Business Studies', slug: 'business-studies' },
          { name: 'Economics', slug: 'economics' },
          { name: 'History', slug: 'history' },
          { name: 'Political Science', slug: 'political-science' },
        ],
      },
      { grade: 12, subjects: [] },
    ],
  },
  {
    name: 'ICSE',
    slug: 'icse',
    classes: [
      {
        grade: 1,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Second Language', slug: 'second-language' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'Computer Applications', slug: 'computer-applications' },
          { name: 'Art & Music', slug: 'art-music' },
          { name: 'Physical Education', slug: 'physical-education' },
        ],
      },
      { grade: 2, subjects: [] },
      { grade: 3, subjects: [] },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Biology', slug: 'biology' },
          { name: 'History Civics & Geography', slug: 'history-civics-geography' },
          { name: 'Computer Applications', slug: 'computer-applications' },
        ],
      },
      { grade: 10, subjects: [] },
    ],
  },
]

async function main() {
  console.log('START seed-ai-content.cjs')

  for (const boardSeed of BOARDS) {
    console.log(`Processing board ${boardSeed.name} (${boardSeed.slug})`)

    const board = await prisma.board.upsert({
      where: { slug: boardSeed.slug },
      update: {},
      create: {
        name: boardSeed.name,
        slug: boardSeed.slug,
      },
    })

    const classMap = new Map()
    for (const cs of boardSeed.classes) {
      if (!cs || typeof cs.grade !== 'number') continue
      if (!classMap.has(cs.grade)) classMap.set(cs.grade, cs.subjects || [])
    }

    const normalizedClasses = []
    let previousSubjects = []

    for (let grade = 1; grade <= 12; grade++) {
      const raw = classMap.get(grade) || []
      const use = raw.length > 0 ? raw : previousSubjects

      const seen = new Set()
      const cleaned = []
      for (const s of use) {
        if (!s || !s.slug) continue
        if (seen.has(s.slug)) continue
        seen.add(s.slug)
        cleaned.push({ name: s.name, slug: s.slug })
      }

      normalizedClasses.push({ grade, subjects: cleaned })
      if (cleaned.length > 0) previousSubjects = cleaned
    }

    for (const classSeed of normalizedClasses) {
      const classLevel = await prisma.classLevel.upsert({
        where: {
          boardId_grade: {
            boardId: board.id,
            grade: classSeed.grade,
          },
        },
        update: {},
        create: {
          boardId: board.id,
          grade: classSeed.grade,
          slug: `class-${classSeed.grade}`,
        },
      })

      for (const subject of classSeed.subjects) {
        await prisma.subjectDef.upsert({
          where: {
            classId_slug: {
              classId: classLevel.id,
              slug: subject.slug,
            },
          },
          update: {},
          create: {
            classId: classLevel.id,
            name: subject.name,
            slug: subject.slug,
          },
        })
      }
    }
  }

  console.log('DONE seed-ai-content.cjs')
}

main()
  .catch((err) => {
    console.error('Seed failed', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
