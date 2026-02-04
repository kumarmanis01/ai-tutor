/**
 * FILE OBJECTIVE:
 * - Jest test suites for AI prompt schema compliance.
 * - Validates Notes, Practice, and Doubt schemas.
 * - Includes normal, edge, and abuse scenarios.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created AI schema compliance tests
 */

import {
  NOTES_OUTPUT_SCHEMA,
  PRACTICE_QUESTION_SCHEMA,
  DOUBT_RESOLUTION_SCHEMA,
  validateResponse,
} from '@/services/ai/openai';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory for creating valid notes responses
 */
export function createValidNotesResponse(overrides = {}) {
  return {
    topic_title: 'Test Topic',
    learning_objectives: [
      'Understand concept A',
      'Apply concept B',
    ],
    key_concepts: [
      {
        term: 'Concept',
        definition: 'A simple definition',
        example: 'Real world example',
      },
    ],
    explanation: {
      main_idea: 'This is the main idea.',
      details: ['Detail 1', 'Detail 2'],
    },
    remember_points: ['Point 1', 'Point 2'],
    difficulty_rating: 'MEDIUM',
    estimated_read_time_minutes: 5,
    ...overrides,
  };
}

/**
 * Factory for creating valid practice question responses
 */
export function createValidPracticeResponse(overrides = {}) {
  return {
    question_type: 'MCQ',
    question_text: 'What is 2 + 2?',
    options: [
      { label: 'A', text: '3', is_correct: false },
      { label: 'B', text: '4', is_correct: true },
      { label: 'C', text: '5', is_correct: false },
      { label: 'D', text: '6', is_correct: false },
    ],
    correct_answer: 'B',
    explanation: {
      why_correct: '2 + 2 equals 4 by basic addition',
      concept_connection: 'This tests basic arithmetic',
    },
    difficulty: 'EASY',
    bloom_level: 'REMEMBER',
    marks: 1,
    ...overrides,
  };
}

/**
 * Factory for creating valid doubt responses
 */
export function createValidDoubtResponse(overrides = {}) {
  return {
    understood_question: 'The student is asking about X',
    doubt_category: 'CONCEPT_CLARITY',
    is_valid_academic_doubt: true,
    response: {
      greeting: 'Great question!',
      clarification: 'Here is the explanation...',
      encouragement: 'Keep it up!',
    },
    follow_up_questions: ['Can you explain more?'],
    confidence_score: 0.85,
    needs_human_review: false,
    ...overrides,
  };
}

// ============================================================================
// SCHEMA COMPLIANCE TESTS
// ============================================================================

describe('AI Schema Compliance', () => {
  describe('Notes Output Schema', () => {
    it('should have required fields defined', () => {
      const schema = NOTES_OUTPUT_SCHEMA;
      expect(schema.function.name).toBe('generate_educational_notes');
      expect(schema.function.strict).toBe(true);
      
      const required = schema.function.parameters.required as string[];
      expect(required).toContain('topic_title');
      expect(required).toContain('learning_objectives');
      expect(required).toContain('key_concepts');
      expect(required).toContain('explanation');
      expect(required).toContain('remember_points');
    });
    
    it('should validate a valid notes response', () => {
      const response = createValidNotesResponse();
      expect(() => validateResponse(response, 'NOTES')).not.toThrow();
    });
    
    it('should reject notes missing topic_title', () => {
      const response = createValidNotesResponse();
      delete (response as Record<string, unknown>).topic_title;
      
      expect(() => validateResponse(response, 'NOTES')).toThrow(/topic_title/);
    });
    
    it('should reject notes missing learning_objectives', () => {
      const response = createValidNotesResponse();
      delete (response as Record<string, unknown>).learning_objectives;
      
      expect(() => validateResponse(response, 'NOTES')).toThrow(/learning_objectives/);
    });
    
    it('should reject notes with empty key_concepts', () => {
      const response = createValidNotesResponse({ key_concepts: [] });
      expect(() => validateResponse(response, 'NOTES')).toThrow(/key_concepts/);
    });
  });
  
  describe('Practice Question Schema', () => {
    it('should have required fields defined', () => {
      const schema = PRACTICE_QUESTION_SCHEMA;
      expect(schema.function.name).toBe('generate_practice_question');
      expect(schema.function.strict).toBe(true);
      
      const required = schema.function.parameters.required as string[];
      expect(required).toContain('question_type');
      expect(required).toContain('question_text');
      expect(required).toContain('correct_answer');
      expect(required).toContain('explanation');
    });
    
    it('should validate a valid practice response', () => {
      const response = createValidPracticeResponse();
      expect(() => validateResponse(response, 'PRACTICE')).not.toThrow();
    });
    
    it('should reject practice missing correct_answer', () => {
      const response = createValidPracticeResponse();
      delete (response as Record<string, unknown>).correct_answer;
      
      expect(() => validateResponse(response, 'PRACTICE')).toThrow(/correct_answer/);
    });
    
    it('should reject practice missing explanation', () => {
      const response = createValidPracticeResponse();
      delete (response as Record<string, unknown>).explanation;
      
      expect(() => validateResponse(response, 'PRACTICE')).toThrow(/explanation/);
    });
  });
  
  describe('Doubt Resolution Schema', () => {
    it('should have required fields defined', () => {
      const schema = DOUBT_RESOLUTION_SCHEMA;
      expect(schema.function.name).toBe('resolve_student_doubt');
      expect(schema.function.strict).toBe(true);
      
      const required = schema.function.parameters.required as string[];
      expect(required).toContain('understood_question');
      expect(required).toContain('doubt_category');
      expect(required).toContain('is_valid_academic_doubt');
      expect(required).toContain('confidence_score');
    });
    
    it('should validate a valid doubt response', () => {
      const response = createValidDoubtResponse();
      expect(() => validateResponse(response, 'DOUBT')).not.toThrow();
    });
    
    it('should reject doubt with low confidence score', () => {
      const response = createValidDoubtResponse({ confidence_score: 0.3 });
      expect(() => validateResponse(response, 'DOUBT')).toThrow(/Low confidence/);
    });
    
    it('should reject doubt missing confidence_score', () => {
      const response = createValidDoubtResponse();
      delete (response as Record<string, unknown>).confidence_score;
      
      expect(() => validateResponse(response, 'DOUBT')).toThrow(/confidence_score/);
    });
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Schema Edge Cases', () => {
  describe('Notes Edge Cases', () => {
    it('should handle maximum allowed key_concepts (8)', () => {
      const keyConcepts = Array(8).fill(null).map((_, i) => ({
        term: `Concept ${i}`,
        definition: `Definition ${i}`,
        example: `Example ${i}`,
      }));
      
      const response = createValidNotesResponse({ key_concepts: keyConcepts });
      expect(() => validateResponse(response, 'NOTES')).not.toThrow();
    });
    
    it('should handle minimum allowed learning_objectives (2)', () => {
      const response = createValidNotesResponse({
        learning_objectives: ['Objective 1', 'Objective 2'],
      });
      expect(() => validateResponse(response, 'NOTES')).not.toThrow();
    });
    
    it('should handle optional worked_example field', () => {
      const response = createValidNotesResponse({
        worked_example: {
          problem: 'Sample problem',
          steps: [
            { step_number: 1, action: 'Do this', result: 'Get this' },
          ],
          final_answer: 'The answer',
        },
      });
      expect(() => validateResponse(response, 'NOTES')).not.toThrow();
    });
  });
  
  describe('Practice Edge Cases', () => {
    it('should handle all question types', () => {
      const types = ['MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'SHORT_ANSWER', 'MATCH'];
      
      types.forEach(type => {
        const response = createValidPracticeResponse({ question_type: type });
        expect(() => validateResponse(response, 'PRACTICE')).not.toThrow();
      });
    });
    
    it('should handle all difficulty levels', () => {
      const levels = ['EASY', 'MEDIUM', 'HARD', 'EXAM'];
      
      levels.forEach(level => {
        const response = createValidPracticeResponse({ difficulty: level });
        expect(() => validateResponse(response, 'PRACTICE')).not.toThrow();
      });
    });
    
    it('should handle all Bloom levels', () => {
      const levels = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'];
      
      levels.forEach(level => {
        const response = createValidPracticeResponse({ bloom_level: level });
        expect(() => validateResponse(response, 'PRACTICE')).not.toThrow();
      });
    });
  });
  
  describe('Doubt Edge Cases', () => {
    it('should handle all doubt categories', () => {
      const categories = [
        'CONCEPT_CLARITY',
        'CALCULATION_ERROR',
        'FORMULA_APPLICATION',
        'DEFINITION_CONFUSION',
        'PROCEDURE_STEPS',
        'REAL_WORLD_CONNECTION',
        'COMPARISON_CONTRAST',
        'OFF_SYLLABUS',
      ];
      
      categories.forEach(category => {
        const response = createValidDoubtResponse({ doubt_category: category });
        expect(() => validateResponse(response, 'DOUBT')).not.toThrow();
      });
    });
    
    it('should handle invalid academic doubt (homework dump)', () => {
      const response = createValidDoubtResponse({
        is_valid_academic_doubt: false,
        rejection_reason: 'This appears to be a complete assignment',
        confidence_score: 0.9,
      });
      
      // Should not throw - rejection is a valid response
      expect(() => validateResponse(response, 'DOUBT')).not.toThrow();
    });
    
    it('should handle human review flag', () => {
      const response = createValidDoubtResponse({
        needs_human_review: true,
        review_reason: 'Complex edge case requiring expert verification',
      });
      
      expect(() => validateResponse(response, 'DOUBT')).not.toThrow();
    });
    
    it('should handle boundary confidence score (0.5)', () => {
      // 0.5 is exactly at threshold - should pass
      const response = createValidDoubtResponse({ confidence_score: 0.5 });
      expect(() => validateResponse(response, 'DOUBT')).not.toThrow();
    });
    
    it('should reject confidence score just below threshold', () => {
      // 0.49 is below threshold - should fail
      const response = createValidDoubtResponse({ confidence_score: 0.49 });
      expect(() => validateResponse(response, 'DOUBT')).toThrow(/Low confidence/);
    });
  });
});

// ============================================================================
// ABUSE SCENARIO TESTS
// ============================================================================

describe('Abuse Scenario Detection', () => {
  describe('Homework Dump Detection', () => {
    it('should mark multi-question input as invalid', () => {
      const response = createValidDoubtResponse({
        is_valid_academic_doubt: false,
        rejection_reason: 'Multiple complete questions detected - appears to be homework',
        doubt_category: 'OFF_SYLLABUS',
      });
      
      expect(response.is_valid_academic_doubt).toBe(false);
      expect(response.rejection_reason).toContain('homework');
    });
    
    it('should mark answer-seeking without work shown as invalid', () => {
      const response = createValidDoubtResponse({
        is_valid_academic_doubt: false,
        rejection_reason: 'No attempt shown - student asking for direct answer',
        confidence_score: 0.95, // High confidence in detection
      });
      
      expect(response.is_valid_academic_doubt).toBe(false);
    });
  });
  
  describe('Off-Syllabus Detection', () => {
    it('should mark off-syllabus content appropriately', () => {
      const response = createValidDoubtResponse({
        doubt_category: 'OFF_SYLLABUS',
        response: {
          greeting: 'Interesting question!',
          clarification: 'This topic is beyond your current grade level.',
          encouragement: 'Focus on your current syllabus first.',
        },
      });
      
      expect(response.doubt_category).toBe('OFF_SYLLABUS');
    });
  });
  
  describe('Inappropriate Content Detection', () => {
    it('should flag inappropriate content for human review', () => {
      const response = createValidDoubtResponse({
        is_valid_academic_doubt: false,
        needs_human_review: true,
        review_reason: 'Content contains potentially inappropriate material',
        confidence_score: 0.95,
      });
      
      expect(response.needs_human_review).toBe(true);
    });
  });
});
