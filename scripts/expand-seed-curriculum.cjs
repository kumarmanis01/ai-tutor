#!/usr/bin/env node
require('./bootstrap-env.cjs');
/**
 * scripts/expand-seed-curriculum.cjs
 *
 * Ensure at least:
 *  - 3 subjects
 *  - 3 chapters per subject
 *  - 10 topics per subject
 *  - 5+ questions per topic
 *  - GeneratedTest exists for every topic
 *
 * Behavior:
 *  - If data exists, skip (idempotent)
 *  - Deterministic naming: "Chapter 1", "Topic 1" etc.
 *  - Minimal MCQs created for questions and GeneratedTest
 *
 * Usage:
 *  node scripts/expand-seed-curriculum.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main() {
  try {
    // Choose deterministic board/class
    const BOARD_SLUG = 'seed-board';
    const BOARD_NAME = 'Seed Board';
    const GRADE = 6;

    let board = await prisma.board.findUnique({ where: { slug: BOARD_SLUG } });
    if (!board) {
      board = await prisma.board.create({ data: { name: BOARD_NAME, slug: BOARD_SLUG } });
      console.log('Created board:', BOARD_SLUG);
    } else {
      console.log('Board exists:', BOARD_SLUG);
    }

    // Ensure ClassLevel for this grade
    let classLevel = await prisma.classLevel.findFirst({ where: { boardId: board.id, grade: GRADE } });
    if (!classLevel) {
      classLevel = await prisma.classLevel.create({ data: { grade: GRADE, slug: `grade-${GRADE}`, boardId: board.id } });
      console.log('Created class level grade', GRADE);
    } else {
      console.log('Class level exists for grade', GRADE);
    }

    // Ensure at least 3 subjects
    const SUBJECT_COUNT = 3;
    for (let s = 1; s <= SUBJECT_COUNT; s++) {
      const subjSlug = `subject-${s}`;
      let subject = await prisma.subjectDef.findFirst({ where: { classId: classLevel.id, slug: subjSlug } });
      if (!subject) {
        subject = await prisma.subjectDef.create({ data: { name: `Subject ${s}`, slug: subjSlug, classId: classLevel.id } });
        console.log('Created subject:', subject.slug);
      } else {
        console.log('Subject exists:', subject.slug);
      }

      // Ensure 3 chapters per subject
      const CHAPTERS_PER_SUBJECT = 3;
      const chapters = [];
      for (let c = 1; c <= CHAPTERS_PER_SUBJECT; c++) {
        const chapSlug = `subject-${s}-chapter-${c}`;
        // chapters are scoped to a subject (use subjectId)
        let chapter = await prisma.chapterDef.findFirst({ where: { subjectId: subject.id, slug: chapSlug } });
        if (!chapter) {
          chapter = await prisma.chapterDef.create({ data: { name: `Chapter ${c}`, slug: chapSlug, order: c, subjectId: subject.id } });
          console.log('Created chapter:', chapSlug);
        } else {
          console.log('Chapter exists:', chapSlug);
        }
        chapters.push(chapter);
      }

      // Ensure 10 topics per subject -- distribute across chapters
      const TOPICS_PER_SUBJECT = 10;
      const topicsPerChapter = [4, 3, 3]; // sums to 10
      let topicGlobalIndex = 1;
      for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci];
        const count = topicsPerChapter[ci] || 0;
        for (let t = 1; t <= count; t++) {
          const topicSlug = `subject-${s}-topic-${topicGlobalIndex}`;
          let topic = await prisma.topicDef.findFirst({ where: { chapterId: chapter.id, slug: topicSlug } });
          if (!topic) {
            topic = await prisma.topicDef.create({ data: { name: `Topic ${topicGlobalIndex}`, slug: topicSlug, order: topicGlobalIndex, chapterId: chapter.id } });
            console.log('Created topic:', topic.slug, 'in chapter', chapter.slug);
          }

          // Ensure at least 5 questions for topic
          // Questions model fields: subject, chapter, grade, board, prompt, choices, correctAnswer, type
          const existingQuestions = await prisma.question.findMany({ where: { subject: subject.name, chapter: chapter.name } , take: 1 });
          // We'll count by topic via content conventions: questions do not have topicId; so to avoid creating duplicates across runs, store a unique prompt marker including topic id

          const existingCount = await prisma.question.count({ where: { prompt: { contains: `__seed:${topic.slug}:` } } });
          const needed = Math.max(0, 5 - existingCount);
          for (let qn = 1; qn <= needed; qn++) {
            const prompt = `__seed:${topic.slug}:Q${qn} -- What is ${topic.name} question ${qn}?`;
            const options = ['A', 'B', 'C', 'D'].map((o, idx) => ({ key: o, text: `Option ${o}` }));
            await prisma.question.create({ data: { subject: subject.name, chapter: chapter.name, grade: String(GRADE), board: board.name, type: 'mcq', prompt, choices: JSON.stringify(options), correctAnswer: 'A' } });
          }

          // Ensure GeneratedTest exists for this topic
          const existingTest = await prisma.generatedTest.findFirst({ where: { topicId: topic.id, difficulty: 'easy', language: 'en' } });
          if (!existingTest) {
            const title = `Generated Test - ${topic.slug}`;
            const createdTest = await prisma.generatedTest.create({ data: { topicId: topic.id, title, difficulty: 'easy', language: 'en', version: 1, status: 'draft' } });
            // create one GeneratedQuestion linking to one of the seed questions
            const genQ = await prisma.generatedQuestion.create({ data: { testId: createdTest.id, type: 'mcq', question: `__seed-gen:${topic.slug}: What is ${topic.name}?`, options: JSON.stringify([{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' }]), answer: JSON.stringify({ key: 'A' }), explanation: 'Seeded question', marks: 1 } });
            console.log('Created GeneratedTest and GeneratedQuestion for topic:', topic.slug);
          }

          topicGlobalIndex++;
          if (topicGlobalIndex > TOPICS_PER_SUBJECT) break;
        }
        if (topicGlobalIndex > TOPICS_PER_SUBJECT) break;
      }
    }

    console.log('Curriculum seeding complete.');
    process.exit(0);
  } catch (e) {
    console.error('Error seeding curriculum:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
})();
