jest.mock('@/lib/callLLM', () => ({
  callTutorLLM: jest.fn(),
}));
jest.mock('@/lib/ai/tutor/tagParser', () => ({
  stripTag: (s: string) => s.replace(/\[\w+\]\s*$/m, '').trim(),
}));

import { buildSessionInsight } from '@/lib/student/sessionInsight';
import { callTutorLLM } from '@/lib/callLLM';

const mockLLM = callTutorLLM as jest.MockedFunction<typeof callTutorLLM>;

function makeParams(overrides: Partial<Parameters<typeof buildSessionInsight>[0]> = {}) {
  return {
    correctAnswers: 8,
    totalQuestions: 10,
    conceptName: 'Quadratic Equations',
    hintsUsed: 1,
    masteryDelta: 0.15,
    studentId: 'student-1',
    sessionId: 'sess-1',
    ...overrides,
  };
}

describe('buildSessionInsight', () => {
  beforeEach(() => {
    mockLLM.mockClear();
  });

  test('should return fallback without calling LLM when totalQuestions is 0', async () => {
    const result = await buildSessionInsight(makeParams({ totalQuestions: 0, correctAnswers: 0 }));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  test('should call LLM with concept name and score data', async () => {
    mockLLM.mockResolvedValueOnce({
      content: 'You nailed quadratic equations today -- try polynomial division next.',
    } as any);
    await buildSessionInsight(makeParams());
    expect(mockLLM).toHaveBeenCalledTimes(1);
    const promptArg = mockLLM.mock.calls[0][0] as string;
    expect(promptArg).toContain('Quadratic Equations');
    expect(promptArg).toContain('8/10');
    expect(promptArg).toContain('80%');
    expect(promptArg).toContain('Hints used: 1/3');
  });

  test('should return the LLM content when call succeeds', async () => {
    mockLLM.mockResolvedValueOnce({
      content: 'Strong session on fractions -- one more practice and you will have it.',
    } as any);
    const result = await buildSessionInsight(makeParams({ conceptName: 'Fractions' }));
    expect(result).toBe('Strong session on fractions -- one more practice and you will have it.');
  });

  test('should return fallback when LLM throws', async () => {
    mockLLM.mockRejectedValueOnce(new Error('network timeout'));
    const result = await buildSessionInsight(makeParams());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should return fallback when LLM returns empty content', async () => {
    mockLLM.mockResolvedValueOnce({ content: '' } as any);
    const result = await buildSessionInsight(makeParams());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('should strip machine tags from LLM output', async () => {
    mockLLM.mockResolvedValueOnce({ content: 'Great session on geometry! [QUESTION]' } as any);
    const result = await buildSessionInsight(makeParams({ conceptName: 'Geometry' }));
    expect(result).not.toContain('[QUESTION]');
    expect(result).toContain('Great session on geometry');
  });

  test('should use callType tutor:eval', async () => {
    mockLLM.mockResolvedValueOnce({ content: 'Keep going!' } as any);
    await buildSessionInsight(makeParams());
    const metaArg = mockLLM.mock.calls[0][1] as Record<string, unknown>;
    expect(metaArg.callType).toBe('tutor:eval');
  });

  test('should pass null conceptName gracefully', async () => {
    mockLLM.mockResolvedValueOnce({ content: 'Good effort this session.' } as any);
    const result = await buildSessionInsight(makeParams({ conceptName: null }));
    expect(result).toBe('Good effort this session.');
    const promptArg = mockLLM.mock.calls[0][0] as string;
    expect(promptArg).toContain('this concept');
  });

  test('should include negative mastery delta in prompt', async () => {
    mockLLM.mockResolvedValueOnce({
      content: 'Review this concept once more and it will click.',
    } as any);
    await buildSessionInsight(
      makeParams({ masteryDelta: -0.05, correctAnswers: 3, totalQuestions: 10 })
    );
    const promptArg = mockLLM.mock.calls[0][0] as string;
    expect(promptArg).toContain('-5%');
  });
});
