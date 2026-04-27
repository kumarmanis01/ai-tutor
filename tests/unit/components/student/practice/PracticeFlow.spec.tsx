/**
 * Unit tests for PracticeFlow component (S2.3).
 */

jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => children }));
jest.mock('@/hooks/usePractice', () => ({
  usePractice: jest.fn(() => ({
    currentQuestion: null,
    index: 0,
    isLoading: true,
    isSubmitting: false,
    error: null,
    selectedAnswer: null,
    setSelectedAnswer: jest.fn(),
    submitCurrent: jest.fn(),
    nextQuestion: jest.fn(),
    score: { correct: 0, total: 0, accuracy: 0 },
    isFinished: false,
    canShowFreemiumWall: false,
    remaining: { isPremium: false, limit: 5, used: 0, remaining: 5 },
    restart: jest.fn(),
    results: [],
    queuedCount: 0,
    syncStatus: 'idle',
  })),
}));
jest.mock('@/components/student/practice/FreemiumWallModal', () => ({
  __esModule: true,
  default: () => null,
}));

describe('PracticeFlow module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/practice/PracticeFlow')).not.toThrow();
  });

  it('should export default function', () => {
    const mod = require('@/components/student/practice/PracticeFlow');
    expect(typeof mod.default).toBe('function');
  });
});
