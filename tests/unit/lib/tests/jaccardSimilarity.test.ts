/**
 * Unit tests for Jaccard similarity and semantic deduplication.
 * F-STU-020 AC-01: No two chapter test attempts within 90 days are semantically equivalent.
 *
 * Tests: lib/tests.ts (computeJaccardSimilarity, isSemanticallyDuplicate).
 */

import { computeJaccardSimilarity, isSemanticallyDuplicate } from '@/lib/tests';

describe('computeJaccardSimilarity', () => {
  it('should return 1.0 for identical strings', () => {
    const s = 'What is the speed of light in vacuum?';
    expect(computeJaccardSimilarity(s, s)).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    const a = 'photosynthesis chlorophyll sunlight glucose';
    const b = 'momentum velocity acceleration force';
    expect(computeJaccardSimilarity(a, b)).toBe(0);
  });

  it('should return a high value for near-duplicate questions', () => {
    const a = 'Calculate the area of a circle with radius 5 cm';
    const b = 'Find the area of a circle with radius 5 cm';
    const sim = computeJaccardSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.7);
  });

  it('should return a low value for questions on different topics', () => {
    const a = 'What is the formula for kinetic energy?';
    const b = 'Explain the process of cell division in plants.';
    const sim = computeJaccardSimilarity(a, b);
    expect(sim).toBeLessThan(0.3);
  });

  it('should return 1 for two empty strings', () => {
    expect(computeJaccardSimilarity('', '')).toBe(1);
  });

  it('should return 0 when one string is empty', () => {
    expect(computeJaccardSimilarity('hello world test', '')).toBe(0);
  });
});

describe('isSemanticallyDuplicate', () => {
  it('should return true when candidate is identical to a used prompt', () => {
    const prompt = 'What is the atomic number of carbon?';
    expect(isSemanticallyDuplicate(prompt, [prompt])).toBe(true);
  });

  it('should return false when no used prompts exist', () => {
    expect(isSemanticallyDuplicate('What is photosynthesis?', [])).toBe(false);
  });

  it('should return false when candidate is clearly different from all used prompts', () => {
    const used = [
      'Calculate the circumference of a circle with diameter 10 cm.',
      'What is the value of pi to 3 decimal places?',
    ];
    const candidate = 'Explain the process of osmosis in plant cells.';
    expect(isSemanticallyDuplicate(candidate, used)).toBe(false);
  });

  it('should return true when candidate is near-duplicate of a used prompt', () => {
    const used = ['Calculate the area of a rectangle with length 8 cm and breadth 5 cm.'];
    const candidate = 'Find the area of a rectangle with length 8 cm and breadth 5 cm.';
    expect(isSemanticallyDuplicate(candidate, used)).toBe(true);
  });
});
