import { detectMisconceptions, logNovelMisconception } from '@/lib/ai/tutor/misconceptionDetector';
import { logger } from '@/lib/logger';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const MISCONCEPTIONS = [
  {
    id: 'mc_a',
    name: 'Quadratic roots misconception',
    triggerPatterns: ['only one solution for x^2', 'x^2 = 9 so x = 3'],
    correction: 'There are two solutions: positive and negative.',
  },
  {
    id: 'mc_b',
    name: 'Binomial square misconception',
    triggerPatterns: ['(a+b)^2 = a^2 + b^2', 'no middle term'],
    correction: 'The correct expansion includes 2ab.',
  },
];

describe('detectMisconceptions', () => {
  test('should return empty array when input is empty', () => {
    expect(detectMisconceptions('', MISCONCEPTIONS)).toEqual([]);
  });

  test('should return empty array when input is whitespace only', () => {
    expect(detectMisconceptions('   ', MISCONCEPTIONS)).toEqual([]);
  });

  test('should return empty array when misconceptions list is empty', () => {
    expect(detectMisconceptions('only one solution for x^2', [])).toEqual([]);
  });

  test('should detect a single LOW confidence match (one trigger pattern)', () => {
    const result = detectMisconceptions('I think only one solution for x^2 exists', MISCONCEPTIONS);
    expect(result).toHaveLength(1);
    expect(result[0].misconceptionId).toBe('mc_a');
    expect(result[0].confidence).toBe('LOW');
    expect(result[0].name).toBe('Quadratic roots misconception');
    expect(result[0].correction).toBeTruthy();
  });

  test('should detect HIGH confidence when two trigger patterns match', () => {
    const input = 'only one solution for x^2 because x^2 = 9 so x = 3';
    const result = detectMisconceptions(input, MISCONCEPTIONS);
    expect(result).toHaveLength(1);
    expect(result[0].misconceptionId).toBe('mc_a');
    expect(result[0].confidence).toBe('HIGH');
  });

  test('should detect multiple misconceptions when multiple match', () => {
    const input = 'only one solution for x^2 and (a+b)^2 = a^2 + b^2';
    const result = detectMisconceptions(input, MISCONCEPTIONS);
    expect(result).toHaveLength(2);
  });

  test('should order HIGH confidence before LOW confidence', () => {
    const mcs = [
      { id: 'mc_low', name: 'Low match', triggerPatterns: ['trigger_low'], correction: 'c1' },
      {
        id: 'mc_high',
        name: 'High match',
        triggerPatterns: ['trigger_high_1', 'trigger_high_2'],
        correction: 'c2',
      },
    ];
    const input = 'trigger_low and trigger_high_1 and trigger_high_2';
    const result = detectMisconceptions(input, mcs);
    expect(result[0].misconceptionId).toBe('mc_high');
    expect(result[0].confidence).toBe('HIGH');
    expect(result[1].confidence).toBe('LOW');
  });

  test('should be case-insensitive in matching', () => {
    const result = detectMisconceptions('ONLY ONE SOLUTION FOR X^2', MISCONCEPTIONS);
    expect(result).toHaveLength(1);
    expect(result[0].misconceptionId).toBe('mc_a');
  });

  test('should return empty when no patterns match', () => {
    const result = detectMisconceptions('The answer is 42', MISCONCEPTIONS);
    expect(result).toEqual([]);
  });

  test('should skip misconception entries with no trigger patterns', () => {
    const mcs = [{ id: 'mc_empty', name: 'Empty triggers', triggerPatterns: [], correction: 'c' }];
    const result = detectMisconceptions('anything', mcs);
    expect(result).toEqual([]);
  });

  test('should include correction text in returned DetectedMisconception', () => {
    const result = detectMisconceptions('only one solution for x^2', MISCONCEPTIONS);
    expect(result[0].correction).toBe('There are two solutions: positive and negative.');
  });
});

describe('logNovelMisconception', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log a structured event via logger.info', () => {
    logNovelMisconception('stu_1', 'sub_math', 'con_1', 'Student said something odd about roots');
    expect(logger.info).toHaveBeenCalledWith(
      'misconception.novel_detected',
      expect.objectContaining({
        event: 'misconception.novel_detected',
        context: { studentId: 'stu_1', subjectId: 'sub_math', conceptId: 'con_1' },
      })
    );
  });

  test('should truncate input snippet to 200 characters', () => {
    const longInput = 'x'.repeat(300);
    logNovelMisconception('stu_1', 'sub_math', 'con_1', longInput);
    const call = (logger.info as jest.Mock).mock.calls[0];
    expect(call[1].inputSnippet.length).toBe(200);
  });

  test('should never throw even if logger throws', () => {
    (logger.info as jest.Mock).mockImplementationOnce(() => {
      throw new Error('logger failure');
    });
    expect(() => logNovelMisconception('s', 'sub', 'con', 'input')).not.toThrow();
  });
});
