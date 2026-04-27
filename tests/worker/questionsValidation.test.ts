import { validateQuestionsShapeWithReport, validateQuestionsShape } from '@/worker/services/questionsWorker';

describe('questions validation', () => {
  test('valid math question object passes', () => {
    const sample = {
      questions: [
        {
          type: 'numeric',
          question: 'Solve 2x+3=11',
          answer: { solution_steps: ['2x+3=11','2x=8','x=4'], final_answer: '4' }
        }
      ]
    };
    const { valid, report } = validateQuestionsShapeWithReport(sample as any, 'Mathematics');
    expect(valid).toBe(true);
    expect(report.summary.validCount).toBe(1);
    expect(validateQuestionsShape(sample, 'Mathematics')).toBe(true);
  });

  test('mcq without options fails', () => {
    const sample = { questions: [{ type: 'mcq', question: 'Why?', answer: 'Because' }] };
    const { valid, report } = validateQuestionsShapeWithReport(sample as any, 'General');
    expect(valid).toBe(false);
    expect(report.summary.issues.length).toBeGreaterThan(0);
    expect(validateQuestionsShape(sample, 'General')).toBe(false);
  });
});
