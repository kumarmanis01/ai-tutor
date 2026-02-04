/**
 * FILE OBJECTIVE:
 * - Endpoint definitions for Student Dashboard APIs.
 * - REST endpoint configuration with versioning.
 * - Centralized route management.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/api/student/endpoints.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created endpoint definitions
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * HTTP methods supported
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Endpoint definition
 */
export interface EndpointDefinition {
  /** HTTP method */
  readonly method: HttpMethod;
  /** Path pattern (with parameters) */
  readonly path: string;
  /** Description for documentation */
  readonly description: string;
  /** Authentication required */
  readonly authRequired: boolean;
  /** Required subscription level */
  readonly minSubscription?: 'free' | 'basic' | 'premium';
  /** Rate limit (requests per minute) */
  readonly rateLimit: number;
  /** Cache TTL in seconds (0 = no cache) */
  readonly cacheTtl: number;
  /** Request schema name */
  readonly requestSchema?: string;
  /** Response schema name */
  readonly responseSchema: string;
  /** Tags for OpenAPI grouping */
  readonly tags: string[];
}

// ============================================================================
// API VERSION
// ============================================================================

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}/student`;

// ============================================================================
// ENDPOINT DEFINITIONS
// ============================================================================

/**
 * All student dashboard endpoints
 */
export const ENDPOINTS: Record<string, EndpointDefinition> = {
  // -------------------------------------------------------------------------
  // DASHBOARD
  // -------------------------------------------------------------------------
  getDashboard: {
    method: 'GET',
    path: `${API_BASE_PATH}/dashboard`,
    description: 'Get student dashboard home data',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 30,
    requestSchema: 'DashboardHomeRequest',
    responseSchema: 'DashboardHomeData',
    tags: ['Dashboard'],
  },

  // -------------------------------------------------------------------------
  // NOTES
  // -------------------------------------------------------------------------
  listNotes: {
    method: 'GET',
    path: `${API_BASE_PATH}/notes`,
    description: 'List notes with filtering and pagination',
    authRequired: true,
    rateLimit: 120,
    cacheTtl: 60,
    requestSchema: 'ListNotesRequest',
    responseSchema: 'ListNotesData',
    tags: ['Notes'],
  },

  getNote: {
    method: 'GET',
    path: `${API_BASE_PATH}/notes/:noteId`,
    description: 'Get single note metadata',
    authRequired: true,
    rateLimit: 120,
    cacheTtl: 120,
    requestSchema: 'GetNoteRequest',
    responseSchema: 'GetNoteData',
    tags: ['Notes'],
  },

  updateNoteProgress: {
    method: 'POST',
    path: `${API_BASE_PATH}/notes/:noteId/progress`,
    description: 'Update note reading progress',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 0,
    requestSchema: 'UpdateNoteProgressRequest',
    responseSchema: 'UpdateNoteProgressData',
    tags: ['Notes'],
  },

  // -------------------------------------------------------------------------
  // PRACTICE
  // -------------------------------------------------------------------------
  startPractice: {
    method: 'POST',
    path: `${API_BASE_PATH}/practice/start`,
    description: 'Start a new practice session',
    authRequired: true,
    minSubscription: 'free',
    rateLimit: 30,
    cacheTtl: 0,
    requestSchema: 'StartPracticeRequest',
    responseSchema: 'StartPracticeData',
    tags: ['Practice'],
  },

  getPracticeQuestion: {
    method: 'GET',
    path: `${API_BASE_PATH}/practice/:sessionId/question`,
    description: 'Get current question in practice session',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 0,
    requestSchema: 'GetPracticeQuestionRequest',
    responseSchema: 'GetPracticeQuestionData',
    tags: ['Practice'],
  },

  submitAnswer: {
    method: 'POST',
    path: `${API_BASE_PATH}/practice/:sessionId/answer`,
    description: 'Submit answer for current question',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 0,
    requestSchema: 'SubmitAnswerRequest',
    responseSchema: 'SubmitAnswerData',
    tags: ['Practice'],
  },

  requestHint: {
    method: 'POST',
    path: `${API_BASE_PATH}/practice/:sessionId/hint`,
    description: 'Request hint for current question',
    authRequired: true,
    minSubscription: 'basic',
    rateLimit: 30,
    cacheTtl: 0,
    requestSchema: 'RequestHintRequest',
    responseSchema: 'RequestHintData',
    tags: ['Practice'],
  },

  getPracticeSummary: {
    method: 'GET',
    path: `${API_BASE_PATH}/practice/:sessionId/summary`,
    description: 'Get practice session summary',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 300,
    requestSchema: 'GetPracticeSummaryRequest',
    responseSchema: 'GetPracticeSummaryData',
    tags: ['Practice'],
  },

  // -------------------------------------------------------------------------
  // DOUBTS
  // -------------------------------------------------------------------------
  createDoubt: {
    method: 'POST',
    path: `${API_BASE_PATH}/doubts`,
    description: 'Create a new doubt/question',
    authRequired: true,
    minSubscription: 'free',
    rateLimit: 20,
    cacheTtl: 0,
    requestSchema: 'CreateDoubtRequest',
    responseSchema: 'CreateDoubtData',
    tags: ['Doubts'],
  },

  listDoubts: {
    method: 'GET',
    path: `${API_BASE_PATH}/doubts`,
    description: 'List student doubts with filtering',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 30,
    requestSchema: 'ListDoubtsRequest',
    responseSchema: 'ListDoubtsData',
    tags: ['Doubts'],
  },

  getDoubt: {
    method: 'GET',
    path: `${API_BASE_PATH}/doubts/:doubtId`,
    description: 'Get doubt conversation',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 30,
    requestSchema: 'GetDoubtRequest',
    responseSchema: 'GetDoubtData',
    tags: ['Doubts'],
  },

  addFollowUp: {
    method: 'POST',
    path: `${API_BASE_PATH}/doubts/:doubtId/followup`,
    description: 'Add follow-up question to doubt',
    authRequired: true,
    rateLimit: 20,
    cacheTtl: 0,
    requestSchema: 'AddFollowUpRequest',
    responseSchema: 'AddFollowUpData',
    tags: ['Doubts'],
  },

  // -------------------------------------------------------------------------
  // PROFILE
  // -------------------------------------------------------------------------
  getProfile: {
    method: 'GET',
    path: `${API_BASE_PATH}/profile`,
    description: 'Get student profile',
    authRequired: true,
    rateLimit: 60,
    cacheTtl: 60,
    requestSchema: 'GetProfileRequest',
    responseSchema: 'GetProfileData',
    tags: ['Profile'],
  },

  updateProfile: {
    method: 'PATCH',
    path: `${API_BASE_PATH}/profile`,
    description: 'Update student profile',
    authRequired: true,
    rateLimit: 30,
    cacheTtl: 0,
    requestSchema: 'UpdateProfileRequest',
    responseSchema: 'UpdateProfileData',
    tags: ['Profile'],
  },

  updatePreferences: {
    method: 'PATCH',
    path: `${API_BASE_PATH}/preferences`,
    description: 'Update student preferences',
    authRequired: true,
    rateLimit: 30,
    cacheTtl: 0,
    requestSchema: 'UpdatePreferencesRequest',
    responseSchema: 'UpdatePreferencesData',
    tags: ['Profile'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get endpoint by name
 */
export function getEndpoint(name: keyof typeof ENDPOINTS): EndpointDefinition {
  return ENDPOINTS[name];
}

/**
 * Build URL with parameters
 */
export function buildUrl(
  endpoint: EndpointDefinition,
  params?: Record<string, string>
): string {
  let url = endpoint.path;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });
  }
  
  return url;
}

/**
 * Get all endpoints by tag
 */
export function getEndpointsByTag(tag: string): EndpointDefinition[] {
  return Object.values(ENDPOINTS).filter(e => e.tags.includes(tag));
}

/**
 * Get all tags
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  Object.values(ENDPOINTS).forEach(e => {
    e.tags.forEach(t => tags.add(t));
  });
  return Array.from(tags);
}
