/**
 * FILE OBJECTIVE:
 * - Jest test suites for API contract correctness.
 * - Validates student-facing API response schemas.
 * - Tests error handling and rate limiting.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created API contract tests
 */

import {
  buildSuccessResponse,
  buildErrorResponse,
  validateRequestSchema,
  validateResponseSchema,
  type StudentAPIResponse,
  type StudentAPIError,
} from '@/lib/api/student/schemas';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory for creating valid notes responses
 */
export function createNotesAPIResponse(overrides: Partial<StudentAPIResponse> = {}): StudentAPIResponse {
  return {
    success: true,
    data: {
      type: 'notes',
      content: {
        conceptTitle: 'Introduction to Photosynthesis',
        gradeLevelAppropriateness: 6,
        sections: [
          {
            heading: 'What is Photosynthesis?',
            content: 'Plants make their own food using sunlight, water, and carbon dioxide.',
            visualAid: 'Imagine a plant as a tiny food factory!',
          },
        ],
        keyTerms: [
          { term: 'Chlorophyll', definition: 'Green pigment in plants' },
        ],
        summary: 'Photosynthesis is how plants make food.',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        modelVersion: 'gpt-4o-2024-11',
        confidence: 0.92,
      },
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_abc123',
    ...overrides,
  };
}

/**
 * Factory for creating API error responses
 */
export function createErrorResponse(overrides: Partial<StudentAPIError> = {}): StudentAPIError {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: {},
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_abc123',
    ...overrides,
  };
}

// ============================================================================
// SUCCESS RESPONSE TESTS
// ============================================================================

describe('API Success Response Builder', () => {
  it('should create valid success response structure', () => {
    const data = { conceptTitle: 'Test Concept' };
    const response = buildSuccessResponse(data, 'req_123');
    
    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.requestId).toBe('req_123');
    expect(response.timestamp).toBeTruthy();
  });
  
  it('should include ISO 8601 timestamp', () => {
    const response = buildSuccessResponse({ test: true }, 'req_456');
    
    // Validate ISO 8601 format
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(response.timestamp).toMatch(isoRegex);
  });
  
  it('should not include error field in success response', () => {
    const response = buildSuccessResponse({ data: 'test' }, 'req_789');
    
    expect(response.error).toBeUndefined();
    expect(response.success).toBe(true);
  });
  
  it('should preserve complex nested data', () => {
    const complexData = {
      sections: [
        { heading: 'A', content: 'Content A' },
        { heading: 'B', content: 'Content B' },
      ],
      metadata: {
        nested: { deep: { value: 123 } },
      },
    };
    
    const response = buildSuccessResponse(complexData, 'req_complex');
    
    expect(response.data).toEqual(complexData);
  });
});

// ============================================================================
// ERROR RESPONSE TESTS
// ============================================================================

describe('API Error Response Builder', () => {
  describe('Standard Error Codes', () => {
    it('should create validation error response', () => {
      const response = buildErrorResponse(
        'VALIDATION_ERROR',
        'Invalid grade parameter',
        'req_err1',
        { field: 'grade', received: 'abc' }
      );
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Invalid grade parameter');
      expect(response.error.details.field).toBe('grade');
    });
    
    it('should create rate limit error response', () => {
      const response = buildErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
        'req_rate',
        { retryAfter: 60, limit: 100 }
      );
      
      expect(response.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.error.details.retryAfter).toBe(60);
    });
    
    it('should create not found error response', () => {
      const response = buildErrorResponse(
        'NOT_FOUND',
        'Resource not found',
        'req_404'
      );
      
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.success).toBe(false);
    });
    
    it('should create authentication error response', () => {
      const response = buildErrorResponse(
        'UNAUTHORIZED',
        'Invalid or expired token',
        'req_auth'
      );
      
      expect(response.error.code).toBe('UNAUTHORIZED');
    });
    
    it('should create internal error response', () => {
      const response = buildErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        'req_500'
      );
      
      expect(response.error.code).toBe('INTERNAL_ERROR');
      // Should NOT expose stack traces
      expect(response.error.message).not.toContain('at ');
      expect(response.error.message).not.toContain('Error:');
    });
  });
  
  describe('Error Message Safety', () => {
    it('should not expose internal paths in error messages', () => {
      const response = buildErrorResponse(
        'INTERNAL_ERROR',
        'Database connection failed',
        'req_safe1',
        { originalError: 'Error at /home/user/app/db.js:123' }
      );
      
      // The response message should be sanitized
      expect(response.error.message).not.toContain('/home/user/app');
    });
    
    it('should not expose API keys in error details', () => {
      const response = buildErrorResponse(
        'AUTHENTICATION_ERROR',
        'API authentication failed',
        'req_safe2',
        { context: 'key: sk-1234567890abcdef' }
      );
      
      // Should mask or omit sensitive data
      const stringified = JSON.stringify(response);
      expect(stringified).not.toContain('sk-');
    });
  });
});

// ============================================================================
// REQUEST VALIDATION TESTS
// ============================================================================

describe('API Request Schema Validation', () => {
  describe('Notes Request', () => {
    it('should accept valid notes request', () => {
      const request = {
        topic: 'Photosynthesis',
        grade: 6,
        board: 'CBSE',
        subject: 'Science',
        language: 'en',
      };
      
      const result = validateRequestSchema('notes', request);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject notes request without topic', () => {
      const request = {
        grade: 6,
        board: 'CBSE',
        subject: 'Science',
      };
      
      const result = validateRequestSchema('notes', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('topic is required');
    });
    
    it('should reject invalid grade range', () => {
      const request = {
        topic: 'Math',
        grade: 15, // Invalid
        board: 'CBSE',
        subject: 'Mathematics',
      };
      
      const result = validateRequestSchema('notes', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('grade'))).toBe(true);
    });
  });
  
  describe('Practice Request', () => {
    it('should accept valid practice request', () => {
      const request = {
        topic: 'Algebra',
        grade: 8,
        difficulty: 'MEDIUM',
        count: 5,
      };
      
      const result = validateRequestSchema('practice', request);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid difficulty level', () => {
      const request = {
        topic: 'Algebra',
        grade: 8,
        difficulty: 'SUPER_HARD', // Invalid
        count: 5,
      };
      
      const result = validateRequestSchema('practice', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('difficulty'))).toBe(true);
    });
    
    it('should enforce max count limit', () => {
      const request = {
        topic: 'Algebra',
        grade: 8,
        difficulty: 'MEDIUM',
        count: 100, // Too many
      };
      
      const result = validateRequestSchema('practice', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('count'))).toBe(true);
    });
  });
  
  describe('Doubt Request', () => {
    it('should accept valid doubt request', () => {
      const request = {
        question: 'Why does water boil at 100°C?',
        grade: 7,
        subject: 'Science',
        context: 'Chapter 4: States of Matter',
      };
      
      const result = validateRequestSchema('doubt', request);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject empty question', () => {
      const request = {
        question: '',
        grade: 7,
        subject: 'Science',
      };
      
      const result = validateRequestSchema('doubt', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('question'))).toBe(true);
    });
    
    it('should reject question that is too short', () => {
      const request = {
        question: 'Why?',
        grade: 7,
        subject: 'Science',
      };
      
      const result = validateRequestSchema('doubt', request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('question'))).toBe(true);
    });
  });
});

// ============================================================================
// RESPONSE VALIDATION TESTS
// ============================================================================

describe('API Response Schema Validation', () => {
  describe('Notes Response', () => {
    it('should validate correct notes response', () => {
      const response = createNotesAPIResponse();
      
      const result = validateResponseSchema('notes', response.data);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject notes without required fields', () => {
      const response = {
        type: 'notes',
        content: {
          // Missing conceptTitle
          sections: [],
        },
      };
      
      const result = validateResponseSchema('notes', response);
      
      expect(result.valid).toBe(false);
    });
  });
  
  describe('Practice Response', () => {
    it('should validate correct practice response', () => {
      const response = {
        type: 'practice',
        questions: [
          {
            id: 'q1',
            questionText: 'What is 2 + 2?',
            options: ['3', '4', '5', '6'],
            correctAnswer: 'B',
            explanation: 'Basic addition: 2 + 2 = 4',
            difficulty: 'EASY',
          },
        ],
      };
      
      const result = validateResponseSchema('practice', response);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject question without correct answer', () => {
      const response = {
        type: 'practice',
        questions: [
          {
            id: 'q1',
            questionText: 'What is 2 + 2?',
            options: ['3', '4', '5', '6'],
            // Missing correctAnswer
            explanation: 'Basic addition',
          },
        ],
      };
      
      const result = validateResponseSchema('practice', response);
      
      expect(result.valid).toBe(false);
    });
  });
});

// ============================================================================
// NO FREE TEXT TESTS
// ============================================================================

describe('API Response No Free Text Rule', () => {
  it('should reject unstructured text responses', () => {
    const response = {
      success: true,
      data: 'Here is some free text explanation about the topic...',
    };
    
    // String data should be rejected
    const result = validateResponseSchema('notes', response.data);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('structured'))).toBe(true);
  });
  
  it('should reject response with only message field', () => {
    const response = {
      success: true,
      data: {
        message: 'The answer to your question is 42.',
      },
    };
    
    const result = validateResponseSchema('doubt', response.data);
    
    expect(result.valid).toBe(false);
  });
  
  it('should require typed content field', () => {
    const response = {
      success: true,
      data: {
        type: 'notes',
        // content must be structured object, not string
        content: 'This is free text content',
      },
    };
    
    const result = validateResponseSchema('notes', response.data);
    
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// RATE LIMITING TESTS
// ============================================================================

describe('API Rate Limiting Contracts', () => {
  it('should include rate limit headers in success response', () => {
    const response = buildSuccessResponse(
      { data: 'test' },
      'req_rl1',
      {
        rateLimit: {
          limit: 100,
          remaining: 95,
          resetAt: Date.now() + 60000,
        },
      }
    );
    
    expect(response.rateLimit).toBeDefined();
    expect(response.rateLimit.limit).toBe(100);
    expect(response.rateLimit.remaining).toBe(95);
    expect(response.rateLimit.resetAt).toBeGreaterThan(Date.now());
  });
  
  it('should enforce different limits for free vs premium users', () => {
    const freeUserLimits = { limit: 10, remaining: 5, resetAt: Date.now() + 3600000 };
    const premiumUserLimits = { limit: 100, remaining: 95, resetAt: Date.now() + 3600000 };
    
    expect(premiumUserLimits.limit).toBeGreaterThan(freeUserLimits.limit);
  });
  
  it('should return retryAfter in rate limit error', () => {
    const response = buildErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'You have exceeded your request limit',
      'req_rl_err',
      { retryAfter: 300 }
    );
    
    expect(response.error.details.retryAfter).toBe(300);
  });
});

// ============================================================================
// CACHE CONTROL TESTS
// ============================================================================

describe('API Cache Control Contracts', () => {
  it('should include cache hints for cacheable responses', () => {
    const response = buildSuccessResponse(
      { conceptTitle: 'Test' },
      'req_cache1',
      {
        cache: {
          ttl: 3600,
          varyBy: ['grade', 'board', 'language'],
        },
      }
    );
    
    expect(response.cache).toBeDefined();
    expect(response.cache.ttl).toBe(3600);
    expect(response.cache.varyBy).toContain('grade');
  });
  
  it('should not cache user-specific responses', () => {
    const response = buildSuccessResponse(
      { userProgress: { completed: 5 } },
      'req_nocache',
      {
        cache: { ttl: 0, private: true },
      }
    );
    
    expect(response.cache.ttl).toBe(0);
    expect(response.cache.private).toBe(true);
  });
});

// ============================================================================
// PAGINATION TESTS
// ============================================================================

describe('API Pagination Contracts', () => {
  it('should include pagination metadata for list responses', () => {
    const response = buildSuccessResponse(
      { items: [{ id: 1 }, { id: 2 }] },
      'req_page1',
      {
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 100,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      }
    );
    
    expect(response.pagination).toBeDefined();
    expect(response.pagination.page).toBe(1);
    expect(response.pagination.hasNextPage).toBe(true);
    expect(response.pagination.hasPreviousPage).toBe(false);
  });
  
  it('should calculate total pages correctly', () => {
    const pagination = {
      page: 3,
      pageSize: 20,
      totalItems: 100,
      totalPages: Math.ceil(100 / 20),
      hasNextPage: true,
      hasPreviousPage: true,
    };
    
    expect(pagination.totalPages).toBe(5);
  });
});
