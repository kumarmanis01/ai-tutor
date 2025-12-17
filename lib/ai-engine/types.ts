/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */
export const JobStatus = {
  Pending: 'pending',
  Running: 'running',
  Failed: 'failed',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type JobStatus = typeof JobStatus[keyof typeof JobStatus];
export type JobType =
  | 'GENERATE_SYLLABUS'
  | 'GENERATE_NOTES'
  | 'GENERATE_TEST'
  | 'GENERATE_QUESTIONS';

export type EntityType = 'BOARD' | 'CLASS' | 'SUBJECT' | 'TOPIC';
export type Language = 'English' | 'Hindi';

export const ApprovalStatus = {
  Draft: 'draft',
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Archived: 'archived',
} as const;
export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus];
