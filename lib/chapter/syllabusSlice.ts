/**
 * FILE OBJECTIVE:
 * - Pipeline slices extracted from prompts/syllabus.ts (syllabusPrompt).
 *   Two Markdown-output functions for the chapter session:
 *   chapterSyllabusPrompt (Syllabus tab overview) and
 *   chapterTopicsListPrompt (Topics tab -- ordered topic list with descriptions).
 *
 * SOURCE PIPELINE: prompts/syllabus.ts (syllabusPrompt)
 *
 * EDIT LOG:
 * - 2026-06-09T19:30:00Z | claude | add chapterSyllabusPrompt for Syllabus tab
 * - 2026-06-09T19:00:00Z | claude | created as dedicated slice from syllabus pipeline
 */

// ─── Slice 0: Chapter syllabus overview (Syllabus tab) ────────────────────────
// Adapted from syllabusPrompt -- chapter-scoped with learning objectives

export function chapterSyllabusPrompt(ctx: SyllabusSliceCtx): { system: string; user: string } {
  const { chapterName, subject, grade, board } = ctx;
  const examHint = board.toUpperCase() === 'ICSE'
    ? 'ICSE curriculum -- include ICSE-specific exam notes.'
    : 'NCERT + CBSE syllabus -- include board exam weightage notes.';

  return {
    system: `You are a curriculum expert for ${board} board, Grade ${grade}, ${subject}.
Generate a clear chapter overview as Markdown with these sections:

## Learning Objectives
[3-5 bullet points: what students will be able to do after this chapter.]

## Key Concepts
[Ordered list of the most important concepts, one line each.]

## Topics Covered
[Ordered numbered list of topics in this chapter.]

## What to Focus On for Exams
[2-3 bullet points on high-weightage areas. ${examHint}]

Rules:
- Concise and student-friendly.
- Use Indian educational context.
- Write in clear English.`,
    user: `Generate a syllabus overview for chapter "${chapterName}" (${board} Grade ${grade} ${subject}).`,
  };
}

export interface SyllabusSliceCtx {
  chapterName: string;
  subject: string;
  grade: string;
  board: string;
}

/**
 * Adapted from syllabusPrompt -- scoped to a single chapter.
 * Produces Markdown (not JSON) for streaming to the chapter session UI.
 */
export function chapterTopicsListPrompt(ctx: SyllabusSliceCtx): { system: string; user: string } {
  const { chapterName, subject, grade, board } = ctx;
  const examHint = board.toUpperCase() === 'ICSE'
    ? 'ICSE structured syllabus -- show all working sub-topics.'
    : 'NCERT + CBSE syllabus order.';

  return {
    system: `You are a curriculum generator for ${board} board, Grade ${grade}, ${subject}.
Your task: list all topics covered in a single chapter, in curriculum order.

Format each topic as:
**[Topic Name]**
[One sentence: what the student learns in this topic. Use warm, student-friendly language.]

Rules:
- Include every major topic in the chapter (not sub-topics or activities).
- Follow ${examHint}
- Use Indian educational context and examples where relevant.
- Write in clear English.`,
    user: `List all topics in the chapter "${chapterName}" for ${board} Grade ${grade} ${subject}.`,
  };
}
