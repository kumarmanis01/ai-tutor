/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/mastery/topicProgress.ts -- 3-state mastery FSM service.
 *
 * LINKED UNIT TEST:
 * - tests/unit/mastery/topicProgress.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:01:00Z | claude | initial creation -- S2-1 TopicProgress mastery FSM tests
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicProgress: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { MasteryState } from '@prisma/client';
import {
  recordQuizOutcome,
  getTopicProgress,
  getProgressByState,
  getDevelopingTopics,
  getMasteredCount,
} from '@/lib/mastery/topicProgress';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS = {
  userId: 'user-001',
  topicSlug: 'quadratic-equations',
  subject: 'Mathematics',
  grade: '10',
  board: 'cbse',
};

const UNIQUE_KEY = {
  userId: BASE_PARAMS.userId,
  topicSlug: BASE_PARAMS.topicSlug,
  subject: BASE_PARAMS.subject,
  grade: BASE_PARAMS.grade,
  board: BASE_PARAMS.board,
};

function makeRecord(overrides: Partial<{
  state: MasteryState;
  score: number;
  attempts: number;
  masteredAt: Date | null;
  lastStudiedAt: Date | null;
}> = {}) {
  return {
    id: 'tp-001',
    ...BASE_PARAMS,
    state: MasteryState.NOT_STARTED,
    score: 0,
    attempts: 0,
    lastStudiedAt: null,
    masteredAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('recordQuizOutcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockImplementation(({ create }: { create: unknown }) =>
      Promise.resolve(create),
    );
  });

  it('should create NOT_STARTED->DEVELOPING on first attempt', async () => {
    mockFindUnique.mockResolvedValue(null);

    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 70 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.create.state).toBe(MasteryState.DEVELOPING);
    expect(upsertCall.update.state).toBe(MasteryState.DEVELOPING);
  });

  it('should transition DEVELOPING->MASTERED when score>=0.80 and attempts>=2', async () => {
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.DEVELOPING, score: 0.85, attempts: 1 }),
    );

    // Second attempt with high score: rolling avg stays >=0.80, attempts becomes 2
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 90 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.update.state).toBe(MasteryState.MASTERED);
  });

  it('should regress MASTERED->DEVELOPING when score<0.50', async () => {
    // With weight=min(2,2)=2: newScore=(0.55*2+0.20)/3=0.433 < 0.50 => regression
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.MASTERED, score: 0.55, attempts: 2 }),
    );

    // Score collapses below 0.50 regression threshold
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 20 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.update.state).toBe(MasteryState.DEVELOPING);
  });

  it('should not regress MASTERED if score>=0.50', async () => {
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.MASTERED, score: 0.88, attempts: 5 }),
    );

    // Score dips but stays above regression threshold
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 60 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.update.state).toBe(MasteryState.MASTERED);
  });

  it('should compute rolling score correctly across 3 attempts', async () => {
    // Attempt 1: no existing record, score=0.60
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve(create),
    );
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 60 });
    let upsert1 = mockUpsert.mock.calls[0][0];
    // weight=min(0,2)=0; newScore=(0*0+0.6)/(0+1)=0.6
    expect(upsert1.create.score).toBeCloseTo(0.6);
    expect(upsert1.create.attempts).toBe(1);

    jest.clearAllMocks();

    // Attempt 2: existing score=0.6, attempts=1
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.DEVELOPING, score: 0.6, attempts: 1 }),
    );
    mockUpsert.mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve(create),
    );
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 80 });
    let upsert2 = mockUpsert.mock.calls[0][0];
    // weight=min(1,2)=1; newScore=(0.6*1+0.8)/(1+1)=0.7
    expect(upsert2.create.score).toBeCloseTo(0.7);
    expect(upsert2.create.attempts).toBe(2);

    jest.clearAllMocks();

    // Attempt 3: existing score=0.7, attempts=2
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.DEVELOPING, score: 0.7, attempts: 2 }),
    );
    mockUpsert.mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve(create),
    );
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 90 });
    let upsert3 = mockUpsert.mock.calls[0][0];
    // weight=min(2,2)=2; newScore=(0.7*2+0.9)/(2+1)=2.3/3≈0.767
    expect(upsert3.create.score).toBeCloseTo(2.3 / 3, 5);
    expect(upsert3.create.attempts).toBe(3);
  });

  it('should set masteredAt on MASTERED transition', async () => {
    mockFindUnique.mockResolvedValue(
      makeRecord({ state: MasteryState.DEVELOPING, score: 0.85, attempts: 1 }),
    );

    const beforeCall = new Date();
    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 90 });
    const afterCall = new Date();

    const upsertCall = mockUpsert.mock.calls[0][0];
    const masteredAt = upsertCall.create.masteredAt as Date;
    expect(masteredAt).not.toBeNull();
    expect(masteredAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(masteredAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  it('should clear masteredAt on regression', async () => {
    // With weight=min(2,2)=2: newScore=(0.55*2+0.20)/3=0.433 < 0.50 => regression
    mockFindUnique.mockResolvedValue(
      makeRecord({
        state: MasteryState.MASTERED,
        score: 0.55,
        attempts: 2,
        masteredAt: new Date('2026-05-01'),
      }),
    );

    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 20 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.update.masteredAt).toBeNull();
  });

  it('should use @@unique key correctly in upsert', async () => {
    mockFindUnique.mockResolvedValue(null);

    await recordQuizOutcome({ ...BASE_PARAMS, scorePercent: 75 });

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.where.userId_topicSlug_subject_grade_board).toEqual(UNIQUE_KEY);
    expect(upsertCall.create.userId).toBe(BASE_PARAMS.userId);
    expect(upsertCall.create.topicSlug).toBe(BASE_PARAMS.topicSlug);
    expect(upsertCall.create.subject).toBe(BASE_PARAMS.subject);
    expect(upsertCall.create.grade).toBe(BASE_PARAMS.grade);
    expect(upsertCall.create.board).toBe(BASE_PARAMS.board);
  });
});

describe('getTopicProgress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return null when no record exists', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getTopicProgress(
      BASE_PARAMS.userId,
      BASE_PARAMS.topicSlug,
      BASE_PARAMS.subject,
      BASE_PARAMS.grade,
      BASE_PARAMS.board,
    );

    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId_topicSlug_subject_grade_board: UNIQUE_KEY },
    });
  });

  it('should return the record when it exists', async () => {
    const record = makeRecord({ state: MasteryState.DEVELOPING, score: 0.7, attempts: 2 });
    mockFindUnique.mockResolvedValue(record);

    const result = await getTopicProgress(
      BASE_PARAMS.userId,
      BASE_PARAMS.topicSlug,
      BASE_PARAMS.subject,
      BASE_PARAMS.grade,
      BASE_PARAMS.board,
    );

    expect(result).toEqual(record);
  });

  it('should rethrow DB errors', async () => {
    mockFindUnique.mockRejectedValue(new Error('db connection error'));

    await expect(
      getTopicProgress(
        BASE_PARAMS.userId,
        BASE_PARAMS.topicSlug,
        BASE_PARAMS.subject,
        BASE_PARAMS.grade,
        BASE_PARAMS.board,
      ),
    ).rejects.toThrow('db connection error');
  });
});

describe('getProgressByState', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should query with correct where clause and sort', async () => {
    mockFindMany.mockResolvedValue([]);

    await getProgressByState(BASE_PARAMS.userId, MasteryState.DEVELOPING);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: BASE_PARAMS.userId, state: MasteryState.DEVELOPING },
      orderBy: { lastStudiedAt: 'asc' },
      take: 20,
    });
  });

  it('should respect a custom limit', async () => {
    mockFindMany.mockResolvedValue([]);

    await getProgressByState(BASE_PARAMS.userId, MasteryState.MASTERED, 5);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});

describe('getDevelopingTopics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should delegate to getProgressByState with DEVELOPING state', async () => {
    mockFindMany.mockResolvedValue([]);

    await getDevelopingTopics(BASE_PARAMS.userId);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: MasteryState.DEVELOPING }),
      }),
    );
  });
});

describe('getMasteredCount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should count MASTERED records for the user', async () => {
    mockCount.mockResolvedValue(7);

    const result = await getMasteredCount(BASE_PARAMS.userId);

    expect(result).toBe(7);
    expect(mockCount).toHaveBeenCalledWith({
      where: { userId: BASE_PARAMS.userId, state: MasteryState.MASTERED },
    });
  });

  it('should rethrow DB errors', async () => {
    mockCount.mockRejectedValue(new Error('count failed'));

    await expect(getMasteredCount(BASE_PARAMS.userId)).rejects.toThrow('count failed');
  });
});
