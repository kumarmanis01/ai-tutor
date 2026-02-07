/**
 * FILE OBJECTIVE:
 * - Barrel export for OpenAI service module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/openai/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// Schema definitions
export {
  type EducationContext,
  type OpenAIToolDefinition,
  type ToolSchemaType,
  NOTES_OUTPUT_SCHEMA,
  PRACTICE_QUESTION_SCHEMA,
  DOUBT_RESOLUTION_SCHEMA,
  QUIZ_GENERATION_SCHEMA,
  TOOL_SCHEMAS,
  getToolSchema,
  getAllToolSchemas,
} from './schemas';

// Payload builders
export {
  type MessageRole,
  type OpenAIMessage,
  type OpenAIPayload,
  type NotesRequest,
  type PracticeRequest,
  type DoubtRequest,
  type QuizRequest,
  buildNotesPayload,
  buildPracticePayload,
  buildDoubtPayload,
  buildQuizPayload,
  validateResponse,
} from './payloadBuilder';
