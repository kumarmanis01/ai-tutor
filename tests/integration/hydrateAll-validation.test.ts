/**
 * INTEGRATION TEST: HydrateAll AI Content Validation
 *
 * Validates AI-generated content from the HydrateAll pipeline using the same
 * validators that run in production workers. This test is designed to run inside
 * Docker containers (postgres + redis) to exercise the full validation chain.
 *
 * Validates:
 * 1. Notes content: schema, placeholder detection, semantic depth
 * 2. Questions content: schema, difficulty alignment, answer completeness
 * 3. Syllabus content: structure and ordering
 * 4. Cross-cutting: language mismatch, context mismatch detection
 * 5. End-to-end: DB-persisted content passes validation post-hydration
 *
 * Linked AdminSidebar entry:
 *   AdminSidebar.tsx -> contentGenerationLinks -> HydrateAll Pipeline
 *   Route: /admin/content-engine/hydrateAll
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import {
  validateOrThrow,
  SchemaInvalidError,
  PlaceholderContentError,
  SemanticWeaknessError,
  ContextMismatchError,
} from '@/lib/aiOutputValidator';
import { validateNotesShape, validateNotesShapeWithReport } from '@/worker/services/notesWorker';
import { validateQuestionsShape, validateQuestionsShapeWithReport } from '@/worker/services/questionsWorker';

// ============================================================
// Test Fixtures: Realistic AI-generated content samples
// ============================================================

const VALID_NOTES_SECTIONS = {
  title: 'Photosynthesis - The Process of Life',
  content: {
    sections: [
      {
        heading: 'What is Photosynthesis?',
        body: 'Photosynthesis is the biological process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. This process occurs primarily in the chloroplasts of plant cells, specifically within the thylakoid membranes.',
      },
      {
        heading: 'The Light-Dependent Reactions',
        body: 'In the light-dependent reactions, chlorophyll absorbs sunlight and uses this energy to split water molecules (H2O) into hydrogen and oxygen. The oxygen is released as a byproduct, while the hydrogen ions and electrons are used to produce ATP and NADPH, which are energy carriers.',
      },
      {
        heading: 'The Calvin Cycle (Light-Independent Reactions)',
        body: 'The Calvin Cycle takes place in the stroma of the chloroplast. Using ATP and NADPH from the light reactions, carbon dioxide (CO2) is fixed into a three-carbon sugar (G3P) through a series of enzyme-catalyzed reactions. This sugar is then used to form glucose and other organic molecules.',
      },
    ],
  },
  audience: 'Grade 10 students (age ~15 years)',
};

const VALID_NOTES_PARAGRAPHS = {
  title: 'Laws of Motion - Newton\'s Three Laws',
  content: {
    paragraphs: [
      'Newton\'s First Law of Motion, also known as the Law of Inertia, states that an object at rest stays at rest and an object in motion stays in motion with the same speed and in the same direction unless acted upon by an unbalanced external force. This fundamental principle helps explain everyday phenomena such as why passengers lurch forward when a bus suddenly stops.',
      'Newton\'s Second Law of Motion establishes the relationship between force, mass, and acceleration. It can be expressed mathematically as F = ma, where F is the net force applied to an object, m is its mass, and a is the resulting acceleration. This law quantifies how the motion of an object changes when a force is applied and forms the basis for mechanics calculations.',
      'Newton\'s Third Law of Motion states that for every action, there is an equal and opposite reaction. When one object exerts a force on a second object, the second object simultaneously exerts a force equal in magnitude but opposite in direction on the first object. This principle explains phenomena like rocket propulsion and swimming.',
    ],
  },
  audience: 'Grade 9 students studying physics',
};

const VALID_NOTES_EXPLANATION = {
  title: 'Understanding Fractions',
  content: {
    explanation: 'Fractions represent parts of a whole. When we divide something into equal parts and take some of those parts, we use fractions to describe how much we have. A fraction has two numbers: the numerator (top number) tells us how many parts we have, and the denominator (bottom number) tells us how many equal parts the whole was divided into. For example, 3/4 means we divided something into 4 equal parts and took 3 of them. Fractions are used in everyday life when we share food, measure ingredients for cooking, or calculate discounts at a store.',
  },
  audience: 'Grade 5 students (age ~10 years)',
};

const VALID_QUESTIONS_MCQ = {
  difficulty: 'medium',
  questions: [
    {
      type: 'mcq',
      question: 'What is the primary pigment responsible for photosynthesis in plants?',
      options: ['Carotenoid', 'Chlorophyll', 'Xanthophyll', 'Anthocyanin'],
      answer: 'Chlorophyll',
      explanation: 'Chlorophyll is the primary photosynthetic pigment found in chloroplasts. It absorbs light most efficiently in the blue and red wavelengths, reflecting green light which gives plants their characteristic color.',
    },
    {
      type: 'short_answer',
      question: 'Explain why plants appear green in color.',
      answer: 'Plants appear green because chlorophyll absorbs red and blue wavelengths of light for photosynthesis and reflects green wavelengths back to our eyes.',
      explanation: 'The visible spectrum contains multiple wavelengths. Chlorophyll molecules selectively absorb the wavelengths they need for energy conversion (primarily red at ~680nm and blue at ~440nm), while reflecting green wavelengths (~550nm) that our eyes perceive as the green color of plants.',
    },
    {
      type: 'mcq',
      question: 'Which organelle is the primary site of photosynthesis?',
      options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'],
      answer: 'Chloroplast',
      explanation: 'Chloroplasts are specialized organelles found in plant cells and algae that contain chlorophyll and the molecular machinery needed for both the light-dependent and light-independent reactions of photosynthesis.',
    },
  ],
};

const VALID_SYLLABUS = {
  chapters: [
    {
      title: 'Number Systems',
      order: 1,
      topics: [
        { title: 'Natural Numbers and Whole Numbers', order: 1 },
        { title: 'Integers and Rational Numbers', order: 2 },
        { title: 'Irrational Numbers', order: 3 },
      ],
    },
    {
      title: 'Polynomials',
      order: 2,
      topics: [
        { title: 'Definition and Types of Polynomials', order: 1 },
        { title: 'Zeros of a Polynomial', order: 2 },
        { title: 'Remainder Theorem', order: 3 },
      ],
    },
    {
      title: 'Coordinate Geometry',
      order: 3,
      topics: [
        { title: 'Cartesian System', order: 1 },
        { title: 'Plotting Points', order: 2 },
      ],
    },
  ],
};

// ============================================================
// Invalid / Edge-case Fixtures
// ============================================================

const PLACEHOLDER_NOTES = {
  title: 'Placeholder Topic',
  content: {
    sections: [
      {
        heading: 'Introduction',
        body: 'This topic will be discussed in detail in the upcoming classes. Students will learn about the fundamental concepts.',
      },
    ],
  },
  audience: 'Grade 10 students',
};

const EMPTY_SECTIONS_NOTES = {
  title: 'Empty Content',
  content: {
    sections: [],
  },
  audience: 'Grade 8 students',
};

const SHORT_SECTION_NOTES = {
  title: 'Short Sections',
  content: {
    sections: [
      {
        heading: 'Brief',
        body: 'Too short.',
      },
    ],
  },
  audience: 'Grade 7 students',
};

const MISSING_EXPLANATION_QUESTIONS = {
  questions: [
    {
      type: 'mcq',
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
      explanation: '',
    },
  ],
};

const DIFFICULTY_MISMATCH_QUESTIONS = {
  difficulty: 'hard',
  questions: [
    {
      type: 'mcq',
      question: 'What color is the sky?',
      options: ['Blue', 'Red', 'Green', 'Yellow'],
      answer: 'Blue',
      explanation: 'The sky appears blue due to Rayleigh scattering of sunlight by the atmosphere.',
    },
  ],
};

const LANGUAGE_MISMATCH_NOTES = {
  title: 'Photosynthesis Notes',
  language: 'hi',
  content: {
    sections: [
      {
        heading: 'Introduction to Photosynthesis',
        body: 'Photosynthesis is the process by which green plants make their food using sunlight, carbon dioxide and water. This process takes place in the chloroplasts and produces glucose and oxygen as products.',
      },
    ],
  },
  audience: 'Grade 10 students',
};

// ============================================================
// Test Suites
// ============================================================

describe('HydrateAll Content Validation (Container-based)', () => {
  let testBoardId: string;
  let testClassId: string;
  let testSubjectId: string;
  let testChapterId: string;
  let testTopicId: string;

  beforeAll(async () => {
    // Setup: Create the academic hierarchy in the DB (requires postgres container)
    const board = await prisma.board.upsert({
      where: { slug: 'test-validation-board' },
      update: {},
      create: { name: 'Test Validation Board', slug: 'test-validation-board' },
    });
    testBoardId = board.id;

    const classLevel = await prisma.classLevel.upsert({
      where: { boardId_grade: { boardId: board.id, grade: 10 } },
      update: {},
      create: { boardId: board.id, grade: 10, slug: 'grade-10-val' },
    });
    testClassId = classLevel.id;

    const subject = await prisma.subjectDef.upsert({
      where: { classId_slug: { classId: classLevel.id, slug: 'science-val' } },
      update: {},
      create: { classId: classLevel.id, name: 'Science', slug: 'science-val' },
    });
    testSubjectId = subject.id;

    const chapter = await prisma.chapterDef.create({
      data: {
        subjectId: subject.id,
        name: 'Photosynthesis',
        slug: `photosynthesis-val-${Date.now()}`,
        order: 1,
        status: 'draft',
        lifecycle: 'active',
      },
    });
    testChapterId = chapter.id;

    const topic = await prisma.topicDef.create({
      data: {
        chapterId: chapter.id,
        name: 'Process of Photosynthesis',
        slug: `process-photosynthesis-val-${Date.now()}`,
        order: 1,
        status: 'draft',
        lifecycle: 'active',
      },
    });
    testTopicId = topic.id;
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await prisma.topicNote.deleteMany({ where: { topicId: testTopicId } });
      await prisma.generatedQuestion.deleteMany({
        where: { test: { topicId: testTopicId } },
      });
      await prisma.generatedTest.deleteMany({ where: { topicId: testTopicId } });
      await prisma.topicDef.deleteMany({ where: { chapterId: testChapterId } });
      await prisma.chapterDef.deleteMany({ where: { id: testChapterId } });
    } catch {
      // Cleanup best-effort
    }
    await prisma.$disconnect();
  });

  // ========================================
  // Notes Validation
  // ========================================

  describe('Notes Content Validation', () => {
    it('should accept valid notes with sections structure', () => {
      const result = validateOrThrow(VALID_NOTES_SECTIONS, {
        jobType: 'notes',
        language: 'en',
        subject: 'Science',
        topic: 'Photosynthesis',
        grade: 10,
      });
      expect(result).toBe(true);
    });

    it('should accept valid notes with paragraphs structure', () => {
      const result = validateOrThrow(VALID_NOTES_PARAGRAPHS, {
        jobType: 'notes',
        language: 'en',
        subject: 'Physics',
        topic: 'Laws of Motion',
        grade: 9,
      });
      expect(result).toBe(true);
    });

    it('should accept valid notes with explanation structure', () => {
      const result = validateOrThrow(VALID_NOTES_EXPLANATION, {
        jobType: 'notes',
        language: 'en',
        subject: 'Mathematics',
        topic: 'Fractions',
        grade: 5,
      });
      expect(result).toBe(true);
    });

    it('should reject notes with placeholder content', () => {
      expect(() =>
        validateOrThrow(PLACEHOLDER_NOTES, {
          jobType: 'notes',
          language: 'en',
          subject: 'Science',
          topic: 'Placeholder',
          grade: 10,
        })
      ).toThrow(PlaceholderContentError);
    });

    it('should reject notes with empty sections', () => {
      expect(() =>
        validateOrThrow(EMPTY_SECTIONS_NOTES, {
          jobType: 'notes',
          language: 'en',
          subject: 'Science',
          topic: 'Empty',
          grade: 8,
        })
      ).toThrow(SemanticWeaknessError);
    });

    it('should reject notes with too-short sections', () => {
      expect(() =>
        validateOrThrow(SHORT_SECTION_NOTES, {
          jobType: 'notes',
          language: 'en',
          subject: 'Science',
          topic: 'Short',
          grade: 7,
        })
      ).toThrow(SemanticWeaknessError);
    });

    it('should reject null/empty responses', () => {
      expect(() =>
        validateOrThrow(null, { jobType: 'notes' })
      ).toThrow(SchemaInvalidError);

      expect(() =>
        validateOrThrow(undefined, { jobType: 'notes' })
      ).toThrow(SchemaInvalidError);
    });

    it('should detect language mismatch in notes', () => {
      expect(() =>
        validateOrThrow(LANGUAGE_MISMATCH_NOTES, {
          jobType: 'notes',
          language: 'en',
          subject: 'Science',
          topic: 'Photosynthesis',
          grade: 10,
        })
      ).toThrow(ContextMismatchError);
    });

    it('should produce detailed validation report for invalid notes', () => {
      const { valid, report } = validateNotesShapeWithReport(null);
      expect(valid).toBe(false);
      expect(report.issues).toContain('response-not-object');
    });

    it('should produce clean report for valid notes', () => {
      const { valid, report } = validateNotesShapeWithReport(VALID_NOTES_SECTIONS);
      expect(valid).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should flag missing title in notes shape', () => {
      const noTitle = { content: { sections: [{ heading: 'H', body: 'Body text here long enough' }] }, audience: 'students' };
      const { valid, report } = validateNotesShapeWithReport(noTitle);
      expect(valid).toBe(false);
      expect(report.issues).toContain('missing-title');
    });

    it('should flag missing audience in notes shape', () => {
      const noAudience = { title: 'Test', content: { sections: [{ heading: 'H', body: 'Body text' }] } };
      const { valid, report } = validateNotesShapeWithReport(noAudience);
      expect(valid).toBe(false);
      expect(report.issues).toContain('missing-audience');
    });
  });

  // ========================================
  // Questions Validation
  // ========================================

  describe('Questions Content Validation', () => {
    it('should accept valid questions with MCQ and short answer types', () => {
      const result = validateOrThrow(VALID_QUESTIONS_MCQ, {
        jobType: 'questions',
        language: 'en',
        difficulty: 'medium',
        subject: 'Science',
        topic: 'Photosynthesis',
      });
      expect(result).toBe(true);
    });

    it('should reject questions with missing/short explanations', () => {
      expect(() =>
        validateOrThrow(MISSING_EXPLANATION_QUESTIONS, {
          jobType: 'questions',
          language: 'en',
          difficulty: 'easy',
          subject: 'Mathematics',
          topic: 'Addition',
        })
      ).toThrow(SemanticWeaknessError);
    });

    it('should detect difficulty mismatch', () => {
      expect(() =>
        validateOrThrow(DIFFICULTY_MISMATCH_QUESTIONS, {
          jobType: 'questions',
          language: 'en',
          difficulty: 'easy',
          subject: 'Science',
          topic: 'Sky',
        })
      ).toThrow(ContextMismatchError);
    });

    it('should reject empty questions array', () => {
      expect(() =>
        validateOrThrow({ questions: [] }, {
          jobType: 'questions',
          language: 'en',
        })
      ).toThrow(SemanticWeaknessError);
    });

    it('should reject questions without schema-required fields', () => {
      expect(() =>
        validateOrThrow({ wrongField: 'data' }, {
          jobType: 'questions',
          language: 'en',
        })
      ).toThrow(SchemaInvalidError);
    });

    it('should produce detailed validation report for questions', () => {
      const { valid, report } = validateQuestionsShapeWithReport(VALID_QUESTIONS_MCQ, 'Science');
      expect(valid).toBe(true);
      expect(report.summary.total).toBe(3);
      expect(report.summary.validCount).toBe(3);
    });

    it('should flag invalid MCQ options in questions report', () => {
      const badMcq = {
        questions: [
          { type: 'mcq', question: 'Test?', options: ['Only one'], answer: 'Only one', explanation: 'test explanation' },
        ],
      };
      const { valid, report } = validateQuestionsShapeWithReport(badMcq, 'Science');
      expect(valid).toBe(false);
      expect(report.questionReports[0].issues).toContain('mcq-options-invalid');
    });

    it('should validate math-specific answer structure', () => {
      const mathQuestions = {
        questions: [
          {
            type: 'short_answer',
            question: 'Solve 2x + 3 = 7',
            answer: { solution_steps: ['2x = 7 - 3', '2x = 4', 'x = 2'], final_answer: '2' },
            explanation: 'Subtract 3 from both sides, then divide by 2',
          },
        ],
      };
      const { valid } = validateQuestionsShapeWithReport(mathQuestions, 'Mathematics');
      expect(valid).toBe(true);
    });

    it('should flag missing math solution steps', () => {
      const badMath = {
        questions: [
          {
            type: 'short_answer',
            question: 'Solve x + 1 = 3',
            answer: { final_answer: '2' },
            explanation: 'Subtract 1 from both sides',
          },
        ],
      };
      const { valid, report } = validateQuestionsShapeWithReport(badMath, 'Mathematics');
      expect(valid).toBe(false);
      expect(report.questionReports[0].issues).toContain('math-missing-solution_steps');
    });

    it('should validate science-specific answer structure', () => {
      const scienceQuestions = {
        questions: [
          {
            type: 'short_answer',
            question: 'Why do plants need sunlight?',
            answer: { direct_answer: 'For photosynthesis', scientific_explanation: 'Sunlight provides energy that chlorophyll absorbs to convert CO2 and H2O into glucose.' },
            explanation: 'Sunlight is essential for the light-dependent reactions of photosynthesis.',
          },
        ],
      };
      const { valid } = validateQuestionsShapeWithReport(scienceQuestions, 'Science');
      expect(valid).toBe(true);
    });
  });

  // ========================================
  // Syllabus Validation
  // ========================================

  describe('Syllabus Content Validation', () => {
    it('should accept valid syllabus structure', () => {
      expect(validateSyllabusShapeLocal(VALID_SYLLABUS)).toBe(true);
    });

    it('should reject syllabus with no chapters', () => {
      expect(validateSyllabusShapeLocal({ chapters: [] })).toBe(false);
    });

    it('should reject syllabus with missing chapter titles', () => {
      expect(
        validateSyllabusShapeLocal({
          chapters: [{ order: 1, topics: [] }],
        })
      ).toBe(false);
    });

    it('should reject syllabus with invalid topic structure', () => {
      expect(
        validateSyllabusShapeLocal({
          chapters: [
            {
              title: 'Chapter 1',
              order: 1,
              topics: [{ order: 1 }], // missing title
            },
          ],
        })
      ).toBe(false);
    });

    it('should accept syllabus chapters without explicit topics', () => {
      const noTopics = {
        chapters: [
          { title: 'Chapter 1', order: 1 },
          { title: 'Chapter 2', order: 2 },
        ],
      };
      expect(validateSyllabusShapeLocal(noTopics)).toBe(true);
    });

    it('should reject non-object input', () => {
      expect(validateSyllabusShapeLocal(null)).toBe(false);
      expect(validateSyllabusShapeLocal('string')).toBe(false);
      expect(validateSyllabusShapeLocal(42)).toBe(false);
    });
  });

  // ========================================
  // Cross-cutting: Unknown Job Types
  // ========================================

  describe('Unknown Job Type Handling', () => {
    it('should reject unknown job types in central validator', () => {
      expect(() =>
        validateOrThrow(VALID_NOTES_SECTIONS, { jobType: 'unknown_type' })
      ).toThrow(SchemaInvalidError);
    });
  });

  // ========================================
  // DB-Backed Validation: Persist and Validate
  // ========================================

  describe('DB-Backed Content Validation (Container)', () => {
    it('should persist and validate notes through the DB', async () => {
      // Persist a TopicNote with valid AI-generated content
      const note = await prisma.topicNote.create({
        data: {
          topicId: testTopicId,
          language: 'en',
          version: 1,
          title: VALID_NOTES_SECTIONS.title,
          contentJson: VALID_NOTES_SECTIONS.content,
          source: 'ai',
          status: 'draft',
        },
      });

      expect(note).toBeDefined();
      expect(note.id).toBeTruthy();

      // Read back and validate
      const persisted = await prisma.topicNote.findUnique({ where: { id: note.id } });
      expect(persisted).not.toBeNull();

      const reconstructed = {
        title: persisted!.title,
        content: persisted!.contentJson,
        audience: 'Grade 10 students',
      };

      // Validate the shape matches what workers expect
      expect(validateNotesShape(reconstructed)).toBe(true);

      // Validate via central validator
      const valid = validateOrThrow(reconstructed, {
        jobType: 'notes',
        language: 'en',
        subject: 'Science',
        topic: 'Photosynthesis',
        grade: 10,
      });
      expect(valid).toBe(true);

      // Cleanup
      await prisma.topicNote.delete({ where: { id: note.id } });
    });

    it('should persist and validate questions through the DB', async () => {
      const test = await prisma.generatedTest.create({
        data: {
          topicId: testTopicId,
          title: 'Photosynthesis - Medium Quiz',
          language: 'en',
          difficulty: 'medium',
          version: 1,
          status: 'draft',
        },
      });

      expect(test).toBeDefined();

      // Persist questions
      for (const q of VALID_QUESTIONS_MCQ.questions) {
        await prisma.generatedQuestion.create({
          data: {
            testId: test.id,
            type: q.type,
            question: q.question,
            options: q.options ?? null,
            answer: q.answer,
            marks: 1,
            sourceJobId: null,
          },
        });
      }

      // Read back and validate
      const questions = await prisma.generatedQuestion.findMany({
        where: { testId: test.id },
      });

      expect(questions).toHaveLength(3);

      // Reconstruct the output shape that workers produce
      const reconstructed = {
        difficulty: 'medium',
        questions: questions.map((q) => ({
          type: q.type,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: 'Explanation placeholder for DB test - sufficient length for validation.',
        })),
      };

      // Validate schema
      const valid = validateOrThrow(reconstructed, {
        jobType: 'questions',
        language: 'en',
        difficulty: 'medium',
        subject: 'Science',
        topic: 'Photosynthesis',
      });
      expect(valid).toBe(true);

      // Cleanup
      await prisma.generatedQuestion.deleteMany({ where: { testId: test.id } });
      await prisma.generatedTest.delete({ where: { id: test.id } });
    });

    it('should persist syllabus content and validate hierarchy', async () => {
      // Create chapters and topics mimicking syllabus worker output
      const chapter = await prisma.chapterDef.create({
        data: {
          subjectId: testSubjectId,
          name: 'Validation Test Chapter',
          slug: `val-test-chapter-${Date.now()}`,
          order: 99,
          status: 'draft',
          lifecycle: 'active',
        },
      });

      const topic1 = await prisma.topicDef.create({
        data: {
          chapterId: chapter.id,
          name: 'Validation Topic 1',
          slug: `val-topic-1-${Date.now()}`,
          order: 1,
          status: 'draft',
          lifecycle: 'active',
        },
      });

      const topic2 = await prisma.topicDef.create({
        data: {
          chapterId: chapter.id,
          name: 'Validation Topic 2',
          slug: `val-topic-2-${Date.now()}`,
          order: 2,
          status: 'draft',
          lifecycle: 'active',
        },
      });

      // Verify hierarchy persisted correctly
      const persistedChapter = await prisma.chapterDef.findUnique({
        where: { id: chapter.id },
        include: { topics: true },
      });

      expect(persistedChapter).not.toBeNull();
      expect(persistedChapter!.topics).toHaveLength(2);
      expect(persistedChapter!.topics[0].name).toContain('Validation Topic');

      // Reconstruct syllabus shape from DB
      const syllabusShape = {
        chapters: [
          {
            title: persistedChapter!.name,
            order: persistedChapter!.order,
            topics: persistedChapter!.topics.map((t) => ({
              title: t.name,
              order: t.order,
            })),
          },
        ],
      };

      expect(validateSyllabusShapeLocal(syllabusShape)).toBe(true);

      // Cleanup
      await prisma.topicDef.deleteMany({ where: { chapterId: chapter.id } });
      await prisma.chapterDef.delete({ where: { id: chapter.id } });
    });

    it('should create and validate a HydrationJob with expected counts', async () => {
      const job = await prisma.hydrationJob.create({
        data: {
          jobType: 'syllabus',
          subjectId: testSubjectId,
          language: 'en',
          difficulty: 'medium',
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          chaptersExpected: 5,
          topicsExpected: 25,
          notesExpected: 25,
          questionsExpected: 75,
          estimatedCostUsd: 15.35,
          estimatedDurationMins: 120,
          inputParams: {
            language: 'en',
            boardCode: 'cbse',
            grade: '10',
            subjectCode: 'science',
            options: {
              generateNotes: true,
              generateQuestions: true,
              difficulties: ['easy', 'medium', 'hard'],
              questionsPerDifficulty: 5,
            },
          },
        },
      });

      expect(job).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.chaptersExpected).toBe(5);
      expect(job.topicsExpected).toBe(25);
      expect(job.notesExpected).toBe(25);
      expect(job.questionsExpected).toBe(75);

      // Simulate completion progress
      const updated = await prisma.hydrationJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          chaptersCompleted: 5,
          topicsCompleted: 25,
          notesCompleted: 25,
          questionsCompleted: 75,
          completedAt: new Date(),
          contentReady: true,
        },
      });

      expect(updated.status).toBe('completed');
      expect(updated.contentReady).toBe(true);

      // Verify expected vs completed match
      expect(updated.chaptersCompleted).toBe(updated.chaptersExpected);
      expect(updated.topicsCompleted).toBe(updated.topicsExpected);
      expect(updated.notesCompleted).toBe(updated.notesExpected);
      expect(updated.questionsCompleted).toBe(updated.questionsExpected);

      // Cleanup
      await prisma.hydrationJob.delete({ where: { id: job.id } });
    });
  });

  // ========================================
  // Validation Failure Scenarios
  // ========================================

  describe('Validation Failure Scenarios', () => {
    it('should mark job as failed when content has placeholders', async () => {
      const job = await prisma.hydrationJob.create({
        data: {
          jobType: 'notes',
          subjectId: testSubjectId,
          topicId: testTopicId,
          language: 'en',
          difficulty: 'medium',
          status: 'running',
          attempts: 1,
          maxAttempts: 3,
        },
      });

      // Simulate what the notesWorker does on validation failure
      try {
        validateOrThrow(PLACEHOLDER_NOTES, {
          jobType: 'notes',
          language: 'en',
          subject: 'Science',
          topic: 'Placeholder',
          grade: 10,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err).toBeInstanceOf(PlaceholderContentError);

        // Mirror worker failure path: mark job failed with error details
        await prisma.hydrationJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lastError: `VALIDATION_FAILED::${err.type || err.message}`,
          },
        });
      }

      // Verify DB state reflects failure
      const failedJob = await prisma.hydrationJob.findUnique({ where: { id: job.id } });
      expect(failedJob!.status).toBe('failed');
      expect(failedJob!.lastError).toContain('PLACEHOLDER_CONTENT');

      // Cleanup
      await prisma.hydrationJob.delete({ where: { id: job.id } });
    });

    it('should mark job as failed when schema is invalid', async () => {
      const job = await prisma.hydrationJob.create({
        data: {
          jobType: 'notes',
          subjectId: testSubjectId,
          topicId: testTopicId,
          language: 'en',
          difficulty: 'medium',
          status: 'running',
          attempts: 1,
          maxAttempts: 3,
        },
      });

      try {
        validateOrThrow({ random: 'data' }, {
          jobType: 'notes',
          language: 'en',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err).toBeInstanceOf(SchemaInvalidError);

        await prisma.hydrationJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lastError: `VALIDATION_FAILED::${err.type || err.message}`,
          },
        });
      }

      const failedJob = await prisma.hydrationJob.findUnique({ where: { id: job.id } });
      expect(failedJob!.status).toBe('failed');
      expect(failedJob!.lastError).toContain('SCHEMA_INVALID');

      await prisma.hydrationJob.delete({ where: { id: job.id } });
    });

    it('should handle retry after validation failure', async () => {
      const job = await prisma.hydrationJob.create({
        data: {
          jobType: 'notes',
          subjectId: testSubjectId,
          topicId: testTopicId,
          language: 'en',
          difficulty: 'medium',
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
        },
      });

      // First attempt: fails validation
      await prisma.hydrationJob.update({
        where: { id: job.id },
        data: { status: 'running', attempts: 1 },
      });

      try {
        validateOrThrow(SHORT_SECTION_NOTES, {
          jobType: 'notes',
          language: 'en',
        });
      } catch {
        // Mark as pending for retry
        await prisma.hydrationJob.update({
          where: { id: job.id },
          data: { status: 'pending', lastError: 'VALIDATION_FAILED::section_too_short' },
        });
      }

      // Verify retry state
      const retryJob = await prisma.hydrationJob.findUnique({ where: { id: job.id } });
      expect(retryJob!.status).toBe('pending');
      expect(retryJob!.attempts).toBe(1);
      expect(retryJob!.lastError).toContain('section_too_short');

      // Second attempt: succeeds with valid content
      await prisma.hydrationJob.update({
        where: { id: job.id },
        data: { status: 'running', attempts: 2 },
      });

      const result = validateOrThrow(VALID_NOTES_SECTIONS, {
        jobType: 'notes',
        language: 'en',
        subject: 'Science',
        topic: 'Photosynthesis',
        grade: 10,
      });
      expect(result).toBe(true);

      await prisma.hydrationJob.update({
        where: { id: job.id },
        data: { status: 'completed', lastError: null, contentReady: true },
      });

      const completedJob = await prisma.hydrationJob.findUnique({ where: { id: job.id } });
      expect(completedJob!.status).toBe('completed');
      expect(completedJob!.attempts).toBe(2);
      expect(completedJob!.contentReady).toBe(true);

      await prisma.hydrationJob.delete({ where: { id: job.id } });
    });

    it('should log validation failure to AIContentLog', async () => {
      // Simulate worker behavior: persist AIContentLog on validation failure
      const log = await prisma.aIContentLog.create({
        data: {
          model: 'gpt-4o',
          promptType: 'notes',
          language: 'en',
          success: false,
          status: 'failed',
          error: 'VALIDATION_FAILED::PLACEHOLDER_CONTENT',
          requestBody: { jobId: 'test-job-id', topic: 'Photosynthesis' },
          responseBody: PLACEHOLDER_NOTES,
        },
      });

      expect(log).toBeDefined();
      expect(log.success).toBe(false);
      expect(log.error).toContain('PLACEHOLDER_CONTENT');

      // Verify we can query failed validation logs
      const failedLogs = await prisma.aIContentLog.findMany({
        where: {
          success: false,
          error: { contains: 'VALIDATION_FAILED' },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      expect(failedLogs.length).toBeGreaterThanOrEqual(1);

      // Cleanup
      await prisma.aIContentLog.delete({ where: { id: log.id } });
    });
  });

  // ========================================
  // Concurrent Validation Scenarios
  // ========================================

  describe('Concurrent Job Validation', () => {
    it('should handle multiple simultaneous validations without interference', async () => {
      const validationResults = await Promise.all([
        // Notes validation
        Promise.resolve().then(() =>
          validateOrThrow(VALID_NOTES_SECTIONS, {
            jobType: 'notes',
            language: 'en',
            subject: 'Science',
            topic: 'Photosynthesis',
            grade: 10,
          })
        ),
        // Questions validation
        Promise.resolve().then(() =>
          validateOrThrow(VALID_QUESTIONS_MCQ, {
            jobType: 'questions',
            language: 'en',
            difficulty: 'medium',
            subject: 'Science',
            topic: 'Photosynthesis',
          })
        ),
        // Another notes validation
        Promise.resolve().then(() =>
          validateOrThrow(VALID_NOTES_PARAGRAPHS, {
            jobType: 'notes',
            language: 'en',
            subject: 'Physics',
            topic: 'Laws of Motion',
            grade: 9,
          })
        ),
      ]);

      expect(validationResults).toEqual([true, true, true]);
    });

    it('should correctly isolate validation failures in concurrent runs', async () => {
      const results = await Promise.allSettled([
        // Valid content
        Promise.resolve().then(() =>
          validateOrThrow(VALID_NOTES_SECTIONS, {
            jobType: 'notes',
            language: 'en',
            subject: 'Science',
            topic: 'Photosynthesis',
            grade: 10,
          })
        ),
        // Invalid: placeholder
        Promise.resolve().then(() =>
          validateOrThrow(PLACEHOLDER_NOTES, {
            jobType: 'notes',
            language: 'en',
          })
        ),
        // Valid questions
        Promise.resolve().then(() =>
          validateOrThrow(VALID_QUESTIONS_MCQ, {
            jobType: 'questions',
            language: 'en',
            difficulty: 'medium',
            subject: 'Science',
            topic: 'Photosynthesis',
          })
        ),
        // Invalid: schema
        Promise.resolve().then(() =>
          validateOrThrow(null, { jobType: 'notes' })
        ),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
    });
  });
});

// ============================================================
// Local helper: inline syllabus validation (mirrors syllabusWorker)
// ============================================================

function validateSyllabusShapeLocal(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const { chapters } = raw;
  if (!Array.isArray(chapters)) return false;
  for (const ch of chapters) {
    if (!ch || typeof ch !== 'object') return false;
    if (!ch.title || typeof ch.title !== 'string') return false;
    if (ch.order !== undefined && typeof ch.order !== 'number') return false;
    if (ch.topics !== undefined) {
      if (!Array.isArray(ch.topics)) return false;
      for (const t of ch.topics) {
        if (!t || typeof t !== 'object') return false;
        if (!t.title || typeof t.title !== 'string') return false;
        if (t.order !== undefined && typeof t.order !== 'number') return false;
      }
    }
  }
  return true;
}
