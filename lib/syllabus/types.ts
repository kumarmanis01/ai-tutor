/**
 * Types for AI Syllabus & Curriculum Engine (Phase 6)
 *
 * These are plain data interfaces (no business logic) used to represent
 * a generated syllabus and its parts. They are designed to be JSON-serializable
 * and include optional AI metadata to aid debugging, provenance and review.
 */

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | string;

export type TeachingStyle =
  | 'lecture'
  | 'project'
  | 'hands-on'
  | 'blended'
  | string;

/** Common AI metadata attached to generated artifacts */
export interface AIMetadata {
  /** Model name or provider (e.g. gpt-4, claude-2) */
  model?: string;
  /** Identifier for the prompt template or prompt run */
  promptId?: string;
  /** Sampling temperature used for generation */
  temperature?: number;
  /** Optional confidence or score reported by model/post-processor (0..1) */
  confidence?: number;
  /** Arbitrary provenance note (e.g. 'generated-dry-run', 'human-edited') */
  provenance?: string;
  /** Raw response (may be truncated) — should be JSON-serializable */
  rawResponse?: Record<string, unknown> | unknown;
  /** Additional implementation-specific metadata */
  [key: string]: unknown;
}

export interface LearningObjective {
  /** Stable identifier for the objective (optional) */
  id?: string;
  /** Human readable statement of the learning objective */
  description: string;
  /** Optional competency tag or taxonomy reference */
  competency?: string;
  /** Optional keywords to aid indexing/search */
  keywords?: string[];
  /** Optional AI metadata */
  aiMetadata?: AIMetadata;
}

export interface AssessmentHint {
  /** Optional id */
  id?: string;
  /** Type of assessment hint (quiz, project, exercise, etc.) */
  type?: 'quiz' | 'project' | 'assignment' | 'exercise' | 'placeholder' | string;
  /** Short description or prompt for assessment */
  description?: string;
  /** Suggested duration in minutes */
  suggestedDurationMinutes?: number;
  /** Relative weight (e.g. 0..1) — optional */
  weight?: number;
  aiMetadata?: AIMetadata;
}

export interface Lesson {
  id?: string;
  title: string;
  description?: string;
  /** Ordered list of learning objectives for this lesson (strings) */
  objectives: string[];
  /** References to prerequisite lesson/module ids */
  prerequisites?: string[];
  /** Estimated duration in minutes */
  estimatedMinutes?: number;
  /** Optional list of resource pointers (title + url) */
  resources?: { title: string; url?: string }[];
  assessmentHints?: AssessmentHint[];
  aiMetadata?: AIMetadata;
}

export interface Module {
  id?: string;
  title: string;
  description?: string;
  /** Ordered lessons within this module */
  lessons: Lesson[];
  /** Estimated duration for the entire module (minutes) */
  estimatedMinutes?: number;
  /** Module-level prerequisites (ids of other modules/lessons) */
  prerequisites?: string[];
  aiMetadata?: AIMetadata;
}

export interface CourseSyllabus {
  /** Unique identifier for the syllabus (optional). Use a versioned id when approved. */
  id?: string;
  title: string;
  description?: string;
  targetAudience?: string;
  skillLevel?: SkillLevel;
  /** Total time budget in minutes */
  timeBudgetMinutes?: number;
  teachingStyle?: TeachingStyle;
  constraints?: string[];
  /** Ordered list of modules */
  modules: Module[];
  /** High-level prerequisites (free-text or ids) */
  prerequisites?: string[];
  /** Expected learning outcomes (summary) */
  outcomes?: string[];
  /** Version string (semantic or date-based) */
  version?: string;
  /** Approval metadata — filled when a syllabus is approved */
  approved?: boolean;
  approvalMetadata?: {
    approvedBy?: string;
    approvedAt?: string; // ISO 8601 timestamp
    versionId?: string;
  };
  /** Optional creation metadata */
  createdBy?: string;
  createdAt?: string; // ISO 8601 timestamp
  aiMetadata?: AIMetadata;
  /** Flexible bag for extension data — still JSON-serializable */
  metadata?: Record<string, unknown>;
}

export default CourseSyllabus;
