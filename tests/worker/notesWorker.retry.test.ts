jest.mock('@/lib/prisma.js', () => {
  const mockPrisma = {
    hydrationJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'job1', topicId: 'topic1', language: 'en' }),
      update: jest.fn().mockResolvedValue({}),
    },
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    topicDef: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 'topic1',
          name: 'Topic',
          chapter: {
            name: 'Chapter',
            subject: { name: 'Mathematics', class: { grade: 6, board: { name: 'CBSE' } } },
          },
        }),
    },
    topicNote: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    aIContentLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (work: any) => work(mockPrisma)),
    executionJob: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'exec1', payload: { hydrationJobId: 'job1' }, status: 'pending' }),
      update: jest.fn().mockResolvedValue({}),
    },
    jobExecutionLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma: mockPrisma };
});

// callLLM: first call returns invalid schema, second call returns valid VidyaNotes
jest.mock('@/lib/callLLM.js', () => {
  let calls = 0;
  return {
    callLLM: jest.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        // Invalid: sections missing / too short
        return {
          content: JSON.stringify({
            metadata: {
              board: 'CBSE',
              grade: 6,
              subject: 'Mathematics',
              chapter: 'Chapter',
              topic: 'Topic',
              estimatedReadingMinutes: 5,
              difficultyLevel: 'foundation',
              conceptsIntroduced: [],
            },
            sections: [
              { type: 'concept', title: 'Concept', content: 'short', blackboardNotes: [] },
            ],
            keyConcepts: [],
            examTips: [],
            bridgeToNext: '',
          }),
        };
      }
      // Valid VidyaNotes minimal
      const valid = {
        metadata: {
          board: 'CBSE',
          grade: 6,
          subject: 'Mathematics',
          chapter: 'Chapter',
          topic: 'Topic',
          estimatedReadingMinutes: 10,
          difficultyLevel: 'foundation',
          conceptsIntroduced: ['concept1'],
        },
        sections: [
          {
            type: 'hook',
            title: 'Hook',
            content: 'A '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [],
            conceptCheck: null,
          },
          {
            type: 'concept',
            title: 'Concept 1',
            content: 'B '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [],
            conceptCheck: null,
          },
          {
            type: 'concept',
            title: 'Concept 2',
            content: 'C '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [],
            conceptCheck: null,
          },
          {
            type: 'worked_example',
            title: 'Worked 1',
            content: 'D '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [
              {
                stepNumber: 1,
                expression: '1+1',
                teacherComment: 'Step 1',
                isCommonMistakePoint: false,
              },
            ],
            conceptCheck: null,
          },
          {
            type: 'worked_example',
            title: 'Worked 2',
            content: 'E '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [
              {
                stepNumber: 1,
                expression: '2+2',
                teacherComment: 'Step 1',
                isCommonMistakePoint: false,
              },
            ],
            conceptCheck: null,
          },
          {
            type: 'common_mistake',
            title: 'Common Mistakes',
            content: 'F '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [],
            conceptCheck: null,
          },
          {
            type: 'summary',
            title: 'Summary',
            content: 'G '.repeat(140),
            blackboardNotes: ['note'],
            visualHint: null,
            formulaLatex: null,
            exampleSteps: [],
            conceptCheck: null,
          },
        ],
        keyConcepts: [
          { term: 't1', definition: 'd1', formula: null },
          { term: 't2', definition: 'd2', formula: null },
        ],
        examTips: ['tip1', 'tip2', 'tip3'],
        bridgeToNext: 'This leads to the next topic and is sufficiently long.',
      };
      return { content: JSON.stringify(valid) };
    }),
  };
});

import { handleNotesJob } from '@/worker/services/notesWorker';
import { prisma } from '@/lib/prisma.js';

describe('notesWorker retry behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retries once on schema invalid and succeeds on retry', async () => {
    await expect(handleNotesJob('job1')).resolves.toBeUndefined();

    // Expect the aIContentLog to have recorded a success in the transaction
    expect((prisma as any).aIContentLog.create).toHaveBeenCalled();

    // hydrationJob update to completed should have been called (inside transaction)
    expect((prisma as any).hydrationJob.update).toHaveBeenCalled();
  });
});
