import {
  normalizeOnDemandOutput,
  validateOnDemandQuiz,
  assertQuizValid,
} from '@/lib/quiz/onDemandQuizValidator';

const VALID_QUESTION = {
  question: 'What is the powerhouse of the cell?',
  options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Chloroplast'],
  correctAnswer: 'Mitochondria',
  explanation: 'Mitochondria produces ATP through cellular respiration.',
  difficulty: 'easy',
  topicName: 'Cell Structure',
  grammarCategory: null,
};

const VALID_OUTPUT = {
  questions: [VALID_QUESTION],
};

describe('normalizeOnDemandOutput', () => {
  it('should pass through a valid output unchanged', () => {
    const result = normalizeOnDemandOutput(VALID_OUTPUT);
    expect((result as typeof VALID_OUTPUT).questions).toHaveLength(1);
  });

  it('should wrap a bare array into { questions: [...] }', () => {
    const result = normalizeOnDemandOutput([VALID_QUESTION]) as { questions: unknown[] };
    expect(result.questions).toHaveLength(1);
  });

  it('should resolve correctAnswer alias correct_answer', () => {
    const input = {
      questions: [
        {
          ...VALID_QUESTION,
          correctAnswer: undefined,
          correct_answer: 'Mitochondria',
        },
      ],
    };
    const result = normalizeOnDemandOutput(input) as { questions: { correctAnswer: string }[] };
    expect(result.questions[0].correctAnswer).toBe('Mitochondria');
  });

  it('should convert options object to sorted array', () => {
    const input = {
      questions: [
        {
          ...VALID_QUESTION,
          options: { b: 'Nucleus', a: 'Mitochondria', c: 'Ribosome', d: 'Chloroplast' },
        },
      ],
    };
    const result = normalizeOnDemandOutput(input) as { questions: { options: string[] }[] };
    expect(Array.isArray(result.questions[0].options)).toBe(true);
  });

  it('should normalise difficulty to lowercase', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, difficulty: 'Easy' }],
    };
    const result = normalizeOnDemandOutput(input) as { questions: { difficulty: string }[] };
    expect(result.questions[0].difficulty).toBe('easy');
  });

  it('should stub missing explanation', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, explanation: '' }],
    };
    const result = normalizeOnDemandOutput(input) as { questions: { explanation: string }[] };
    expect(result.questions[0].explanation).toBeTruthy();
    expect(result.questions[0].explanation.length).toBeGreaterThan(5);
  });

  it('should resolve correctAnswer from numeric index', () => {
    const input = {
      questions: [
        {
          ...VALID_QUESTION,
          correctAnswer: 1,
        },
      ],
    };
    const result = normalizeOnDemandOutput(input) as { questions: { correctAnswer: string }[] };
    expect(result.questions[0].correctAnswer).toBe('Mitochondria');
  });
});

describe('validateOnDemandQuiz', () => {
  it('should return valid for a correct output', () => {
    const report = validateOnDemandQuiz(VALID_OUTPUT, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(report.valid).toBe(true);
    expect(report.validCount).toBe(1);
    expect(report.issues).toHaveLength(0);
  });

  it('should flag when correctAnswer is not in options', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, correctAnswer: 'Cytoplasm' }],
    };
    const report = validateOnDemandQuiz(input, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(report.valid).toBe(false);
    expect(report.issues[0].issues).toContain('correctAnswer is not one of the options');
  });

  it('should flag difficulty mismatch', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, difficulty: 'hard' }],
    };
    const report = validateOnDemandQuiz(input, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(report.valid).toBe(false);
    expect(report.issues[0].issues.some((i) => i.includes('difficulty mismatch'))).toBe(true);
  });

  it('should flag duplicate question text', () => {
    const input = {
      questions: [VALID_QUESTION, { ...VALID_QUESTION }],
    };
    const report = validateOnDemandQuiz(input, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.issues.includes('duplicate question text'))).toBe(true);
  });

  it('should fail Zod when options has wrong count', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, options: ['A', 'B', 'C'] }],
    };
    const report = validateOnDemandQuiz(input, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(report.valid).toBe(false);
  });
});

describe('assertQuizValid', () => {
  it('should return parsed output for valid data', () => {
    const result = assertQuizValid(VALID_OUTPUT, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correctAnswer).toBe('Mitochondria');
  });

  it('should throw for invalid data', () => {
    const input = { questions: [{ ...VALID_QUESTION, correctAnswer: 'WrongAnswer' }] };
    expect(() =>
      assertQuizValid(input, { subjectName: 'Science', expectedDifficulty: 'easy' })
    ).toThrow('quiz_validation_failed');
  });

  it('should normalise before validating', () => {
    const input = {
      questions: [{ ...VALID_QUESTION, difficulty: 'Easy', correct_answer: 'Mitochondria', correctAnswer: undefined }],
    };
    const result = assertQuizValid(input, {
      subjectName: 'Science',
      expectedDifficulty: 'easy',
    });
    expect(result.questions[0].difficulty).toBe('easy');
  });
});
