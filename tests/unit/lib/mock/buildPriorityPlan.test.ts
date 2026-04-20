/**
 * Unit tests for lib/mock/buildPriorityPlan.ts
 * Covers AC-05: AI-generated "Next 2 Weeks Priority Plan" post-mock.
 */

jest.mock('@/lib/callLLM', () => ({ callTutorLLM: jest.fn() }));

import { buildPriorityPlan, SectionScore } from '@/lib/mock/buildPriorityPlan';
import { callTutorLLM } from '@/lib/callLLM';

const mockCallLLM = callTutorLLM as jest.Mock;

const SECTIONS: SectionScore[] = [
  { title: 'Section A', scorePercent: 45, marksEarned: 9, totalMarks: 20 },
  { title: 'Section B', scorePercent: 80, marksEarned: 24, totalMarks: 30 },
  { title: 'Section C', scorePercent: 20, marksEarned: 6, totalMarks: 30 },
];

describe('buildPriorityPlan (AC-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return AI-generated plan when LLM succeeds', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: '## Week 1\n- Revise Section C\n' });

    const plan = await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Mathematics',
      overallScore: 49,
      sectionScores: SECTIONS,
    });

    expect(plan).toBe('## Week 1\n- Revise Section C');
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
  });

  it('should call callTutorLLM with correct callType and ids', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: 'plan text' });

    await buildPriorityPlan({
      studentId: 'stu-abc',
      attemptId: 'att-xyz',
      subjectName: 'Physics',
      overallScore: 60,
      sectionScores: SECTIONS,
    });

    const [prompt, meta] = mockCallLLM.mock.calls[0];
    expect(meta).toMatchObject({ callType: 'tutor:eval', studentId: 'stu-abc', sessionId: 'att-xyz' });
    expect(prompt).toContain('Physics');
    expect(prompt).toContain('60%');
  });

  it('should include weakest sections (score < 60%) in the prompt', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: 'some plan' });

    await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Chemistry',
      overallScore: 48,
      sectionScores: SECTIONS,
    });

    const [prompt] = mockCallLLM.mock.calls[0];
    // The "Weakest sections:" line must list Section C (20%) and Section A (45%)
    expect(prompt).toContain('Weakest sections:');
    expect(prompt).toMatch(/Weakest sections:.*Section C/);
    expect(prompt).toMatch(/Weakest sections:.*Section A/);
    // Section B (80%) must NOT appear in the weakest sections listing
    expect(prompt).not.toMatch(/Weakest sections:.*Section B/);
  });

  it('should note "all sections performed well" when no section is below 60%', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: 'great job plan' });

    const strongSections: SectionScore[] = [
      { title: 'Section A', scorePercent: 75, marksEarned: 15, totalMarks: 20 },
      { title: 'Section B', scorePercent: 90, marksEarned: 27, totalMarks: 30 },
      { title: 'Section C', scorePercent: 80, marksEarned: 24, totalMarks: 30 },
    ];

    await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Biology',
      overallScore: 82,
      sectionScores: strongSections,
    });

    const [prompt] = mockCallLLM.mock.calls[0];
    expect(prompt).toContain('all sections performed well');
  });

  it('should return fallback plan when LLM throws', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('network timeout'));

    const plan = await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Mathematics',
      overallScore: 50,
      sectionScores: SECTIONS,
    });

    expect(plan).toContain('Next 2 Weeks');
    expect(plan).toContain('Week 1');
    expect(plan).toContain('Week 2');
  });

  it('should return fallback plan when LLM returns empty content', async () => {
    mockCallLLM.mockResolvedValueOnce({ content: '   ' });

    const plan = await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Mathematics',
      overallScore: 50,
      sectionScores: SECTIONS,
    });

    expect(plan).toContain('Next 2 Weeks');
  });

  it('should return fallback plan when LLM returns null result', async () => {
    mockCallLLM.mockResolvedValueOnce(null);

    const plan = await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Mathematics',
      overallScore: 50,
      sectionScores: SECTIONS,
    });

    expect(plan).toContain('Next 2 Weeks');
  });

  it('should never throw -- always resolves to a string', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('fatal error'));

    await expect(
      buildPriorityPlan({
        studentId: 'stu-1',
        attemptId: 'att-1',
        subjectName: 'Mathematics',
        overallScore: 0,
        sectionScores: [],
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('fallback plan must not contain forbidden words', async () => {
    mockCallLLM.mockRejectedValueOnce(new Error('fail'));

    const plan = await buildPriorityPlan({
      studentId: 'stu-1',
      attemptId: 'att-1',
      subjectName: 'Mathematics',
      overallScore: 30,
      sectionScores: SECTIONS,
    });

    const lower = plan.toLowerCase();
    expect(lower).not.toContain('failed');
    expect(lower).not.toContain('wrong');
    expect(lower).not.toContain('bad');
    expect(lower).not.toContain('missed');
  });
});
