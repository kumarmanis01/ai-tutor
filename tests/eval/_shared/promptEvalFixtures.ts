import { assembleSystemPrompt, type PromptContext } from '@/lib/ai/tutor/promptAssembly';
import { checkInputSafety } from '@/lib/ai/tutor/inputSafety';

export interface PromptEvalFixture {
  name: string;
  input: PromptContext;
  assertions: PromptAssertion[];
}

export interface PromptAssertion {
  description: string;
  assert: (prompt: string) => boolean;
}

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    studentName: 'Aarav',
    grade: 10,
    board: 'CBSE',
    teachingLanguage: 'en',
    examDateProximityDays: 30,
    learningStyle: 'visual',
    recentMisconceptions: ['Quadratic roots', 'Circle theorems'],
    masteryBrief: 'strong in algebra, weak in geometry',
    emotionalState: 'NEUTRAL',
    stage: 'CORE_EXPLANATION',
    stageAttemptCount: 1,
    hintsUsed: 0,
    sessionSummary: 'Student recently revised algebra topics.',
    recentTurns: [
      { role: 'student', content: 'I am okay with algebra.' },
      { role: 'ai', content: 'Great, let us start geometry.' },
    ],
    activeMisconceptionName: null,
    frustrationScore: 0.2,
    ragChunks: ['Chunk 1', 'Chunk 2'],
    conceptName: 'Similar Triangles',
    subjectName: 'Mathematics',
    ...overrides,
  };
}

export const PROMPT_EVAL_FIXTURES: PromptEvalFixture[] = [
  {
    name: 'pedagogical-no-direct-answer',
    input: makeCtx(),
    assertions: [
      {
        description: 'Prompt must contain the no-direct-answer rule verbatim',
        assert: (p) => p.includes('never give the student the direct answer'),
      },
    ],
  },
  {
    name: 'vidya-persona-present',
    input: makeCtx(),
    assertions: [
      {
        description: 'Prompt must reference Vidya persona',
        assert: (p) => p.toLowerCase().includes('vidya'),
      },
    ],
  },
  {
    name: 'concept-name-injected',
    input: makeCtx({ conceptName: 'Quadratic Equations' }),
    assertions: [
      {
        description: 'Prompt must contain the concept name',
        assert: (p) => p.includes('Quadratic Equations'),
      },
    ],
  },
  {
    name: 'token-budget-not-exceeded',
    input: makeCtx(),
    assertions: [
      {
        description: 'Assembled prompt must be under 12000 tokens (approx 48000 chars)',
        assert: (p) => p.length < 48000,
      },
    ],
  },
  {
    name: 'frustration-context-injected',
    input: makeCtx({ frustrationScore: 0.85 }),
    assertions: [
      {
        description: 'Prompt must contain frustration context when score >= 0.8',
        assert: (p) => p.toLowerCase().includes('frustrat'),
      },
    ],
  },
  {
    name: 'distress-layer-absent-when-flag-off',
    input: makeCtx(),
    assertions: [
      {
        description: 'Prompt must not contain distress detection instructions when flag is off',
        assert: (p) => !p.toLowerCase().includes('distress detection enabled'),
      },
    ],
  },
  {
    name: 'no-pii-in-prompt',
    input: (() => {
      const raw = 'My phone is 9876543210 please call me.';
      const safety = checkInputSafety(raw, { studentId: 's1', sessionId: 'sess1', turnId: 't1' });
      return makeCtx({
        studentName: 'Riya Sharma',
        recentTurns: [
          { role: 'student', content: safety.redacted },
          { role: 'ai', content: 'Okay, let us focus on the concept.' },
        ],
      });
    })(),
    assertions: [
      {
        description: 'Raw phone number must not appear in assembled prompt',
        assert: (p) => !p.includes('9876543210'),
      },
      {
        description: 'Student name should appear (name is allowed)',
        assert: (p) => p.includes('Riya'),
      },
    ],
  },
];

export function assembleFixturePrompt(f: PromptEvalFixture): string {
  return assembleSystemPrompt(f.input).system;
}
