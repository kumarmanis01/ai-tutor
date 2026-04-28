import { detectCopyPaste } from '@/lib/ai/tutor/copyPasteDetector';

describe('copyPasteDetector', () => {
  test('flags exact match', () => {
    const student = 'This is the canonical solution with step 1, step 2, step 3.';
    const chunks = [{ chunkId: 'c1', content: student }];
    const res = detectCopyPaste(student, chunks);
    expect(res.flagged).toBe(true);
    expect(res.score).toBe(1);
    expect(res.chunkId).toBe('c1');
  });

  test('flags high overlap long answer', () => {
    const chunk =
      'Start by writing the equation. Then substitute values. Finally simplify to get the result.';
    const student = `Start by writing the equation. Then substitute values. Finally simplify to get the result. Extra note.`;
    const res = detectCopyPaste(student, [{ chunkId: 'c2', content: chunk }], {
      minTokens: 5,
      threshold: 0.8,
    });
    expect(res.flagged).toBe(true);
    expect(res.chunkId).toBe('c2');
  });

  test('does not flag low overlap', () => {
    const chunk = 'A completely different explanation that does not match the student answer.';
    const student = 'I tried a short approach but got stuck on step 2.';
    const res = detectCopyPaste(student, [{ chunkId: 'c3', content: chunk }]);
    expect(res.flagged).toBe(false);
  });
});
