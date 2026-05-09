#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Seed BoardChapterWeight rows in a VPS-safe CommonJS script (no tsx dependency).
 * - Supports idempotent create-only mode, force update mode, and dry-run mode.
 *
 * LINKED UNIT TEST:
 * - None (seed script; validate via --dry-run and DB row checks).
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | claude | created
 * - 2026-05-09T10:00:00Z | copilot | converted wrapper to full CJS implementation for VPS execution
 *
 * Usage:
 *   node scripts/seed-board-chapter-weights.cjs
 *   node scripts/seed-board-chapter-weights.cjs --dry-run
 *   node scripts/seed-board-chapter-weights.cjs --force
 */
'use strict'

const path = require('path')
require('dotenv').config({
	path: path.resolve(__dirname, '../.env.production'),
})

const { prisma } = require('../lib/prisma')

const THEORY_MARKS_PER_SUBJECT = 80
const MIN_MARKS_PER_CHAPTER = 1

const isDryRun = process.argv.includes('--dry-run')
const isForce = process.argv.includes('--force')

async function seedBoardChapterWeights() {
	const mode = isDryRun
		? 'DRY RUN (no writes)'
		: isForce
			? 'FORCE (overwrite existing)'
			: 'CREATE only (skip existing)'

	console.log(`BoardChapterWeight seed -- ${mode}`)
	console.log('Fetching chapters from all active boards, grades 6-12...')

	const boards = await prisma.board.findMany({
		where: { slug: { in: ['cbse', 'icse'] }, lifecycle: 'active' },
		select: {
			slug: true,
			classes: {
				where: { grade: { gte: 6, lte: 12 } },
				select: {
					grade: true,
					subjects: {
						where: { lifecycle: 'active', isAvailable: true },
						select: {
							name: true,
							chapters: {
								where: { lifecycle: 'active' },
								select: { id: true },
							},
						},
					},
				},
			},
		},
	})

	if (!boards.length) {
		throw new Error('No active CBSE/ICSE boards found. Run scripts/seed-ai-content.cjs first.')
	}

	const existingRows = await prisma.boardChapterWeight.findMany({ select: { chapterId: true } })
	const existingSet = new Set(existingRows.map((row) => row.chapterId))

	let totalCreated = 0
	let totalUpdated = 0
	let totalSkipped = 0

	for (const board of boards) {
		for (const cls of board.classes) {
			for (const subject of cls.subjects) {
				const chapters = subject.chapters
				if (!chapters.length) continue

				const marksEach = Math.max(
					MIN_MARKS_PER_CHAPTER,
					Math.round(THEORY_MARKS_PER_SUBJECT / chapters.length),
				)

				let created = 0
				let updated = 0
				let skipped = 0

				for (const chapter of chapters) {
					const alreadyExists = existingSet.has(chapter.id)
					if (alreadyExists && !isForce) {
						skipped++
						continue
					}

					if (!isDryRun) {
						await prisma.boardChapterWeight.upsert({
							where: { chapterId: chapter.id },
							update: isForce ? { weightMarks: marksEach } : {},
							create: { chapterId: chapter.id, weightMarks: marksEach },
						})
					}

					if (alreadyExists) {
						updated++
					} else {
						created++
						existingSet.add(chapter.id)
					}
				}

				totalCreated += created
				totalUpdated += updated
				totalSkipped += skipped

				console.log(
					`${board.slug.toUpperCase()} Grade ${String(cls.grade).padStart(2, ' ')} | ` +
					`${subject.name.padEnd(24)} | chapters=${String(chapters.length).padStart(2, ' ')} | ` +
					`marksEach=${String(marksEach).padStart(2, ' ')} | ` +
					`created=${String(created).padStart(2, ' ')} updated=${String(updated).padStart(2, ' ')} skipped=${String(skipped).padStart(2, ' ')}`,
				)
			}
		}
	}

	console.log(`Total: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`)
	if (isDryRun) {
		console.log('Dry-run complete -- no rows written.')
	} else {
		console.log('Done. BoardChapterWeight rows are live.')
	}
}

seedBoardChapterWeights()
	.catch((err) => {
		console.error('Seed failed:', err)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
