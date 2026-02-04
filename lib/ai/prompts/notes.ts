/**
 * FILE OBJECTIVE:
 * - Notes generation prompt builder.
 * - Constructs structured prompts for generating student notes.
 * - Enforces output schema for predictable UI rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/notes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created notes prompt builder with schema-first approach
 */

import type { NotesInputContract, NotesOutputSchema, ExplanationLevel, ContentLength } from './schemas';

/**
 * JSON schema definition for Notes output
 * Shared with LLM to ensure consistent structure
 */
export const NOTES_OUTPUT_SCHEMA = `{
  "title": "string - Clear, descriptive title for the notes",
  "learningObjectives": ["string - What student will learn (2-4 items)"],
  "coreExplanation": [
    {
      "heading": "string - Section heading",
      "content": "string - Detailed explanation (supports basic formatting)"
    }
  ],
  "workedExamples": [
    {
      "question": "string - Example problem or question",
      "explanation": "string - Step-by-step solution with reasoning"
    }
  ],
  "keyTakeaways": ["string - Important points to remember (3-5 items)"],
  "commonMistakes": ["string - Common errors students make (2-3 items)"]
}`;

/**
 * Get explanation level guidance for prompt
 */
function getExplanationGuidance(level: ExplanationLevel): string {
  switch (level) {
    case 'simple':
      return `
- Use the simplest possible language.
- One idea per paragraph.
- Heavy use of analogies and real-life examples.
- Avoid technical jargon entirely.`;
    
    case 'conceptual':
      return `
- Focus on building understanding of core concepts.
- Introduce technical terms with clear definitions.
- Connect new concepts to what student already knows.
- Balance depth with accessibility.`;
    
    case 'detailed':
      return `
- Provide comprehensive coverage of the topic.
- Include edge cases and nuances where relevant.
- Use precise technical terminology.
- Suitable for exam preparation depth.`;
  }
}

/**
 * Get content length guidance for prompt
 */
function getLengthGuidance(length: ContentLength): string {
  switch (length) {
    case 'short':
      return `
- Keep total content under 500 words.
- 2-3 core explanation sections maximum.
- 1-2 worked examples.
- Focus on essential concepts only.`;
    
    case 'medium':
      return `
- Target 500-1000 words total.
- 3-4 core explanation sections.
- 2-3 worked examples.
- Cover topic comprehensively but concisely.`;
    
    case 'long':
      return `
- Can extend to 1000-1500 words if needed.
- 4-6 core explanation sections.
- 3-4 worked examples.
- Include deeper exploration and additional context.`;
  }
}

/**
 * Build the complete notes generation prompt
 * 
 * @param input - Notes input contract from backend
 * @returns Formatted prompt string for LLM
 */
export function buildNotesPrompt(input: NotesInputContract): string {
  const explanationGuidance = getExplanationGuidance(input.explanationLevel);
  const lengthGuidance = getLengthGuidance(input.preferredLength);

  return `Generate comprehensive student notes using the inputs below.

STUDENT PROFILE:
- Board: ${input.board}
- Grade: ${input.grade}
- Subject: ${input.subject}
- Chapter: ${input.chapter}
- Topic: ${input.topic}
- Language: ${input.language}

EXPLANATION LEVEL: ${input.explanationLevel}
${explanationGuidance}

CONTENT LENGTH: ${input.preferredLength}
${lengthGuidance}

CONTENT GUIDELINES:
1. Structure content logically, building from simple to complex.
2. Introduce concepts BEFORE definitions (understanding before terminology).
3. Use real-life examples familiar to Indian students of Grade ${input.grade}.
4. Avoid exam-specific jargon unless essential for the topic.
5. Do NOT assume prior knowledge beyond Grade ${input.grade} ${input.board} syllabus.
6. Include diagrams descriptions where visual aids would help (describe what to draw).

WORKED EXAMPLES GUIDELINES:
1. Examples should progress from basic to slightly challenging.
2. Show complete working, not just final answers.
3. Explain WHY each step is taken, not just WHAT is done.
4. Include common patterns students will see in exams.

KEY TAKEAWAYS GUIDELINES:
1. Summarize the most important points for revision.
2. Use memorable phrasing when possible.
3. Include any formulas or key facts to remember.

COMMON MISTAKES GUIDELINES:
1. Identify errors students typically make on this topic.
2. Explain WHY the mistake happens.
3. Provide correct approach briefly.

Return ONLY valid JSON matching this exact schema:
${NOTES_OUTPUT_SCHEMA}

Do NOT include any text before or after the JSON.
Do NOT wrap in markdown code blocks.`;
}

/**
 * Validate that a parsed response matches NotesOutputSchema
 * Basic structural validation (detailed validation in validators.ts)
 */
export function isValidNotesResponse(data: unknown): data is NotesOutputSchema {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.title === 'string' &&
    Array.isArray(obj.learningObjectives) &&
    Array.isArray(obj.coreExplanation) &&
    Array.isArray(obj.workedExamples) &&
    Array.isArray(obj.keyTakeaways) &&
    Array.isArray(obj.commonMistakes)
  );
}
