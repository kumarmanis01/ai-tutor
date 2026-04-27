import { validateNotesShapeWithReport, validateNotesShape } from '@/worker/services/notesWorker';

describe('notes validation', () => {
  test('valid notes with sections passes', () => {
    const sample = {
      title: 'Intro to Gravity',
      content: { sections: [{ heading: 'What is gravity?', body: 'Gravity is...' }] },
      audience: 'Class 6 students'
    };
    const { valid, report } = validateNotesShapeWithReport(sample as any);
    expect(valid).toBe(true);
    expect(report.issues.length).toBe(0);
    expect(validateNotesShape(sample)).toBe(true);
  });

  test('missing audience fails', () => {
    const sample = { title: 'T', content: { explanation: 'x' } };
    const { valid, report } = validateNotesShapeWithReport(sample as any);
    expect(valid).toBe(false);
    expect(report.issues).toContain('missing-audience');
    expect(validateNotesShape(sample)).toBe(false);
  });
});
