/**
 * FILE OBJECTIVE:
 * - Barrel export for Student Dashboard API contracts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/api/student/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// ============================================================================
// SCHEMAS
// ============================================================================
export type {
  // Common types
  ApiResponse,
  ApiError,
  ResponseMeta,
  CacheHints,
  PaginationParams,
  PaginationInfo,
  
  // Dashboard
  DashboardHomeRequest,
  DashboardHomeData,
  StudentSummary,
  DailyProgress,
  QuickStats,
  StreakInfo,
  PendingItems,
  RecommendationSummary,
  ActivityItem,
  
  // Notes
  ListNotesRequest,
  ListNotesData,
  NoteSummary,
  AvailableFilters,
  FilterOption,
  GetNoteRequest,
  GetNoteData,
  NoteSectionMeta,
  RelatedNote,
  UpdateNoteProgressRequest,
  UpdateNoteProgressData,
  
  // Practice
  StartPracticeRequest,
  StartPracticeData,
  GetPracticeQuestionRequest,
  GetPracticeQuestionData,
  PracticeQuestion,
  QuestionOption,
  SubmitAnswerRequest,
  SubmitAnswerData,
  RequestHintRequest,
  RequestHintData,
  GetPracticeSummaryRequest,
  GetPracticeSummaryData,
  ScoreSummary,
  QuestionResult,
  PerformanceByType,
  DifficultyAdjustmentInfo,
  
  // Doubts
  CreateDoubtRequest,
  CreateDoubtData,
  ListDoubtsRequest,
  ListDoubtsData,
  DoubtSummary,
  GetDoubtRequest,
  GetDoubtData,
  DoubtMessage,
  RelatedResource,
  AddFollowUpRequest,
  AddFollowUpData,
  
  // Profile
  GetProfileRequest,
  GetProfileData,
  StudentPreferences,
  SubscriptionInfo,
  UpdateProfileRequest,
  UpdateProfileData,
  UpdatePreferencesRequest,
  UpdatePreferencesData,
  
  // Errors
  ErrorCode,
} from './schemas';

export { ERROR_CODES } from './schemas';

// ============================================================================
// ENDPOINTS
// ============================================================================
export type {
  HttpMethod,
  EndpointDefinition,
} from './endpoints';

export {
  API_VERSION,
  API_BASE_PATH,
  ENDPOINTS,
  getEndpoint,
  buildUrl,
  getEndpointsByTag,
  getAllTags,
} from './endpoints';

// ============================================================================
// ERRORS
// ============================================================================
export {
  ApiException,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  SubscriptionRequiredError,
  buildErrorResponse,
  buildSuccessResponse,
  getStatusCode,
  handleError,
  isApiError,
  getErrorCode,
} from './errors';
