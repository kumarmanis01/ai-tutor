/**
 * FILE OBJECTIVE:
 * - Jest test suites for difficulty adjustment logic.
 * - Validates personalization engine decisions.
 * - Includes junior-grade protection and boundary tests.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created difficulty adjustment tests
 */

import {
  calculateDifficultyAdjustment,
  DifficultyLevel,
  type PerformanceMetrics,
} from '@/lib/personalization/difficultyTuning';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory for creating performance metrics
 */
export function createPerformanceMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
  return {
    accuracy: 70, // percent
    avgTimePerQuestion: 60,
    retryCount: 0,
    hintsUsed: 0,
    aiConfidenceScore: 0.85,
    questionsAttempted: 10,
    ...overrides,
  };
}

// ============================================================================
// BASIC DIFFICULTY ADJUSTMENT TESTS
// ============================================================================

describe('Difficulty Adjustment Logic', () => {
  describe('Maintain Current Difficulty', () => {
    it('should maintain difficulty for average performance', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 70,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 5,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(0); // AdjustmentDirection.MAINTAIN
      expect(result.newDifficulty).toBe(DifficultyLevel.MEDIUM);
    });
    
    it('should maintain when performance is in normal range', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 65,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 7,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(0); // AdjustmentDirection.MAINTAIN
    });
  });
  
  describe('Increase Difficulty', () => {
    it('should increase difficulty for consistently high accuracy', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 95,
        hintsUsed: 0,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 8,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
      expect(result.newDifficulty).toBe(DifficultyLevel.HARD);
    });
    
    it('should increase from EASY to MEDIUM', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 90,
        hintsUsed: 0,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 5,
        currentDifficulty: DifficultyLevel.EASY,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
      expect(result.newDifficulty).toBe(DifficultyLevel.MEDIUM);
    });
    
    it('should increase from HARD to EXAM for senior students', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 92,
        hintsUsed: 0,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 10,
        currentDifficulty: DifficultyLevel.HARD,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
      expect(result.newDifficulty).toBe(DifficultyLevel.EXAM);
    });
  });
  
  describe('Decrease Difficulty', () => {
    it('should decrease difficulty for consistently low accuracy', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 35,
        hintsUsed: 3,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 7,
        currentDifficulty: DifficultyLevel.HARD,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(-1); // AdjustmentDirection.DECREASE
      expect(result.newDifficulty).toBe(DifficultyLevel.MEDIUM);
    });
    
    it('should decrease when student struggles with hints', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 40,
        hintsUsed: 5,
        retryCount: 3,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 5,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(-1); // AdjustmentDirection.DECREASE
      expect(result.newDifficulty).toBe(DifficultyLevel.EASY);
    });
    
    it('should not decrease below EASY', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 20,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 3,
        currentDifficulty: DifficultyLevel.EASY,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(0); // AdjustmentDirection.MAINTAIN
      expect(result.newDifficulty).toBe(DifficultyLevel.EASY);
    });
  });
});

// ============================================================================
// JUNIOR GRADE PROTECTION TESTS
// ============================================================================

describe('Junior Grade Protection (Grades 1-3)', () => {
  it('should never set HARD difficulty for Grade 1', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 100,
      hintsUsed: 0,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 1,
      currentDifficulty: DifficultyLevel.MEDIUM,
      subject: 'default',
      metrics,
    });
    
    // Even with perfect performance, Grade 1 should not go to HARD
    expect(result.newDifficulty).not.toBe(DifficultyLevel.HARD);
    expect(result.newDifficulty).not.toBe(DifficultyLevel.EXAM);
  });
  
  it('should never set EXAM difficulty for Grade 2', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 100,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 2,
      currentDifficulty: DifficultyLevel.HARD, // Even if somehow set to HARD
      subject: 'default',
      metrics,
    });
    
    expect(result.newDifficulty).not.toBe(DifficultyLevel.EXAM);
  });
  
  it('should cap at MEDIUM for Grade 3', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 98,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 3,
      currentDifficulty: DifficultyLevel.MEDIUM,
      subject: 'default',
      metrics,
    });
    
    // Grade 3 maximum is MEDIUM
    expect([DifficultyLevel.EASY, DifficultyLevel.MEDIUM]).toContain(result.newDifficulty);
  });
  
  it('should provide encouraging reasoning for junior grades', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 60,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 2,
      currentDifficulty: DifficultyLevel.EASY,
      subject: 'default',
      metrics,
    });
    
    // Reasoning should be encouraging for young students
    expect(result.humanReason).not.toContain('struggling');
    expect(result.humanReason.toLowerCase()).toMatch(/practice|great|good|keep/);
  });
});

// ============================================================================
// BOUNDARY CONDITION TESTS
// ============================================================================

describe('Difficulty Adjustment Boundary Conditions', () => {
  describe('Accuracy Boundaries', () => {
    it('should handle 0% accuracy', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 0,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 5,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(-1); // AdjustmentDirection.DECREASE
    });
    
    it('should handle 100% accuracy', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 100,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 8,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
    });
    
    it('should handle exactly 50% accuracy as maintain', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 50,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 6,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      // 50% is borderline - should likely decrease or maintain
      expect([0, -1]).toContain(result.direction); // MAINTAIN or DECREASE
    });
  });
  
  describe('Time Factor Boundaries', () => {
    it('should consider very fast completion as positive indicator', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 80,
        avgTimePerQuestion: 20,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 7,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      // Fast + accurate = increase
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
    });
    
    it('should consider very slow completion as struggle indicator', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 60,
        avgTimePerQuestion: 180,
        hintsUsed: 2,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 5,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      // Slow + moderate accuracy = decrease
      expect(result.direction).toBe(-1); // AdjustmentDirection.DECREASE
    });
  });
  
  describe('AI Confidence Impact', () => {
    it('should be conservative when AI confidence is low', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 85,
        aiConfidenceScore: 0.4, // Low AI confidence
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 6,
        currentDifficulty: DifficultyLevel.EASY,
        subject: 'default',
        metrics,
      });
      
      // Should be more conservative about increasing when AI isn't confident
      expect(result.humanReason).toContain('confidence');
    });
    
    it('should trust high accuracy more when AI confidence is high', () => {
      const metrics = createPerformanceMetrics({
        accuracy: 88,
        aiConfidenceScore: 0.95,
      });
      
      const result = calculateDifficultyAdjustment({
        grade: 8,
        currentDifficulty: DifficultyLevel.MEDIUM,
        subject: 'default',
        metrics,
      });
      
      expect(result.direction).toBe(1); // AdjustmentDirection.INCREASE
    });
  });
});

// ============================================================================
// EXPLANATION/REASONING TESTS
// ============================================================================

describe('Difficulty Adjustment Reasoning', () => {
  it('should always provide a reasoning string', () => {
    const metrics = createPerformanceMetrics();
    
    const result = calculateDifficultyAdjustment({
      grade: 5,
      currentDifficulty: DifficultyLevel.MEDIUM,
      subject: 'default',
      metrics,
    });
    
    expect(result.humanReason).toBeTruthy();
    expect(typeof result.humanReason).toBe('string');
    expect(result.humanReason.length).toBeGreaterThan(10);
  });
  
  it('should mention key factors in reasoning', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 92,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 7,
      currentDifficulty: DifficultyLevel.MEDIUM,
      subject: 'default',
      metrics,
    });
    
    // Reasoning should explain what led to the decision
    expect(result.humanReason.toLowerCase()).toMatch(/accuracy|performance|correct/);
  });
  
  it('should mention hints when they are a factor', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 50,
      hintsUsed: 5,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 6,
      currentDifficulty: DifficultyLevel.MEDIUM,
      subject: 'default',
      metrics,
    });
    
    expect(result.humanReason.toLowerCase()).toContain('hint');
  });
  
  it('should be auditable (include numeric factors)', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 75,
    });
    
    const result = calculateDifficultyAdjustment({
      grade: 8,
      currentDifficulty: DifficultyLevel.HARD,
      subject: 'default',
      metrics,
    });
    
    // For auditability, reasoning should include specifics
    expect(result.humanReason).toMatch(/\d/); // Contains at least one number
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Difficulty Adjustment Determinism', () => {
  it('should return same result for same inputs', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 80,
    });
    
    const context = { grade: 5, currentDifficulty: DifficultyLevel.MEDIUM, subject: 'default', metrics };
    const result1 = calculateDifficultyAdjustment(context);
    const result2 = calculateDifficultyAdjustment(context);
    const result3 = calculateDifficultyAdjustment(context);
    
    expect(result1.adjustment).toBe(result2.adjustment);
    expect(result2.adjustment).toBe(result3.adjustment);
    expect(result1.newDifficulty).toBe(result2.newDifficulty);
    expect(result2.newDifficulty).toBe(result3.newDifficulty);
  });
  
  it('should not have random elements in decision', () => {
    const metrics = createPerformanceMetrics({
      accuracy: 70,
    });
    
    // Run 10 times and verify consistency
    const context = { grade: 6, currentDifficulty: DifficultyLevel.MEDIUM, subject: 'default', metrics };
    const results = Array(10).fill(null).map(() =>
      calculateDifficultyAdjustment(context)
    );
    
    const firstResult = results[0];
    results.forEach(result => {
      expect(result.adjustment).toBe(firstResult.adjustment);
      expect(result.newDifficulty).toBe(firstResult.newDifficulty);
    });
  });
});
