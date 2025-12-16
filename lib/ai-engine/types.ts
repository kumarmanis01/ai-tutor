export type JobStatus = 'queued' | 'running' | 'failed' | 'completed' | 'cancelled';
export type JobType =
  | 'GENERATE_SYLLABUS'
  | 'GENERATE_NOTES'
  | 'GENERATE_TEST'
  | 'GENERATE_QUESTIONS';

export type EntityType = 'BOARD' | 'CLASS' | 'SUBJECT' | 'TOPIC';
export type Language = 'English' | 'Hindi';
