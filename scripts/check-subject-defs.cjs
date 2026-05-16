#!/usr/bin/env node
/*
 * scripts/check-subject-defs.cjs
 * - Check for a SubjectDef by slug scoped to a board+grade
 * - If missing, optionally create Board / ClassLevel / SubjectDef (use --fix)
 * Usage:
 *   node scripts/check-subject-defs.cjs --slug environmental-studies --grade 6 --board cbse [--fix]
 */

'use strict'

const fs = require('fs')
const path = require('path')

function loadEnv() {
  const root = path.resolve(__dirname, '..')
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/)
      if (!m) continue
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = val
    }
    console.log(`[env] loaded ${p}`)
    break
  }
}
loadEnv()

const argv = require('minimist')(process.argv.slice(2))
const SLUG = argv.slug || 'environmental-studies'
const GRADE = argv.grade ? Number(argv.grade) : 6
const BOARD_SLUG = argv.board || 'cbse'
const NAME = argv.name || 'Environmental Studies'
const DRY = !argv.fix

const { prisma } = require('../lib/prisma')

async function main() {
  try {
    console.log('Checking SubjectDef for', SLUG, 'grade', GRADE, 'board', BOARD_SLUG)

    const existing = await prisma.subjectDef.findFirst({
      where: { slug: SLUG, class: { grade: GRADE, board: { slug: BOARD_SLUG } } },
      include: { class: { include: { board: true } } },
    })

    if (existing) {
      console.log('Found SubjectDef:', existing.slug, 'id=', existing.id, 'classId=', existing.classId)
      process.exit(0)
    }

    console.warn('SubjectDef not found for scoped slug. Will probe board/class existence.')

    let board = await prisma.board.findUnique({ where: { slug: BOARD_SLUG } })
    if (!board) {
      console.warn('Board not found:', BOARD_SLUG)
      if (DRY) {
        console.log('[dry-run] Would create board with slug=', BOARD_SLUG)
      } else {
        board = await prisma.board.create({ data: { name: BOARD_SLUG.toUpperCase(), slug: BOARD_SLUG } })
        console.log('Created board id=', board.id)
      }
    } else {
      console.log('Board exists id=', board.id)
    }

    let classLevel = null
    if (board) {
      classLevel = await prisma.classLevel.findFirst({ where: { boardId: board.id, grade: GRADE } })
      if (!classLevel) {
        console.warn('ClassLevel not found for grade', GRADE, 'on board', BOARD_SLUG)
        if (DRY) {
          console.log('[dry-run] Would create classLevel grade=', GRADE)
        } else {
          classLevel = await prisma.classLevel.create({ data: { grade: GRADE, slug: `grade-${GRADE}`, boardId: board.id } })
          console.log('Created classLevel id=', classLevel.id)
        }
      } else {
        console.log('ClassLevel exists id=', classLevel.id)
      }
    }

    if (!classLevel) {
      console.error('Cannot create SubjectDef without a ClassLevel. Aborting.')
      process.exit(2)
    }

    if (DRY) {
      console.log('[dry-run] Would create SubjectDef with', { name: NAME, slug: SLUG, classId: classLevel.id })
      console.log('Rerun with --fix to apply changes (will create board/class/subject as needed).')
      process.exit(0)
    }

    const created = await prisma.subjectDef.create({ data: { name: NAME, slug: SLUG, classId: classLevel.id } })
    console.log('Created SubjectDef id=', created.id, 'slug=', created.slug)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err)
    process.exit(1)
  } finally {
    try { await prisma.$disconnect() } catch (_) {}
  }
}

main()
