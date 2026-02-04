/**
 * FILE OBJECTIVE:
 * - Doubts/AI Chat prompt builder.
 * - Constructs structured prompts for answering student questions.
 * - Implements anti-abuse guardrails (intent rewriting).
 * - Enforces encouraging, educational responses.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/doubts.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created doubts prompt builder with anti-abuse guardrails
 */

import type {
  DoubtsInputContract,
  DoubtsOutputSchema,
  StudentIntent,
  ConversationMessage,
} from './schemas';
import { getEffectiveIntent, shouldRewriteIntent } from './schemas';

/**
 * JSON schema definition for Doubts output
 * Shared with LLM to ensure consistent structure
 */
export const DOUBTS_OUTPUT_SCHEMA = `{
  "response": "string - The complete answer to the student's question",
  "followUpQuestion": "string - A question to check understanding or encourage further thinking",
  "confidenceLevel": "high | medium | low - Internal confidence (not shown to student)"
}`;

/**
 * Get intent-specific response guidelines
 */
function getIntentGuidelines(intent: StudentIntent): string {
  switch (intent) {
    case 'conceptual_clarity':
      return `
RESPONSE APPROACH: Conceptual Clarity
- Focus on explaining the underlying concept clearly.
- Start with what the student already knows, then build up.
- Use analogies to make abstract concepts concrete.
- Define any technical terms simply.`;

    case 'example_needed':
      return `
RESPONSE APPROACH: Example-Based Learning
- Lead with a clear, relatable example.
- Walk through the example step by step.
- Then explain the general principle.
- Provide a second example if helpful.`;

    case 'step_by_step':
      return `
RESPONSE APPROACH: Step-by-Step Walkthrough
- Break down the solution into numbered steps.
- Explain the reasoning for each step.
- Do NOT skip any steps, even obvious ones.
- Highlight the transition between steps.`;

    case 'comparison':
      return `
RESPONSE APPROACH: Comparison/Contrast
- Clearly state what is being compared.
- List similarities first, then differences.
- Use a structured format (bullet points or table description).
- Explain why the differences matter.`;

    case 'real_world_application':
      return `
RESPONSE APPROACH: Real-World Connection
- Start with the real-world example/application.
- Connect it to the academic concept.
- Explain how the concept applies in practice.
- Give additional everyday examples if helpful.`;

    case 'revision':
      return `
RESPONSE APPROACH: Quick Revision
- Be concise and to the point.
- Highlight the most important facts/formulas.
- Use bullet points for easy scanning.
- Include memory aids or mnemonics if available.`;

    default:
      return `
RESPONSE APPROACH: General Explanation
- Provide a clear, helpful explanation.
- Adapt depth based on the question complexity.
- Ensure the student can learn from your response.`;
  }
}

/**
 * Format conversation history for context
 */
function formatConversationHistory(history: ConversationMessage[] | undefined): string {
  if (!history || history.length === 0) {
    return 'No previous conversation.';
  }

  const formattedMessages = history
    .slice(-5) // Only last 5 messages for context
    .map((msg) => {
      const role = msg.role === 'student' ? 'Student' : 'Tutor';
      return `${role}: ${msg.content}`;
    })
    .join('\n');

  return `RECENT CONVERSATION:
${formattedMessages}`;
}

/**
 * Build the complete doubts/chat prompt
 * 
 * @param input - Doubts input contract from backend
 * @returns Formatted prompt string for LLM
 */
export function buildDoubtsPrompt(input: DoubtsInputContract): string {
  // Apply anti-abuse guardrail: rewrite problematic intents
  const effectiveIntent = getEffectiveIntent(input.studentIntent);
  const intentWasRewritten = shouldRewriteIntent(input.studentIntent);
  
  const intentGuidelines = getIntentGuidelines(effectiveIntent);
  const conversationContext = formatConversationHistory(input.conversationHistory);

  // Additional guideline if intent was rewritten (internal note)
  const antiAbuseNote = intentWasRewritten
    ? `
INTERNAL NOTE (do not mention to student):
The student may be seeking a direct answer. Still provide educational value
by explaining the reasoning. Make learning unavoidable while being helpful.`
    : '';

  return `A student has asked a doubt. Help them understand the concept.

STUDENT CONTEXT:
- Grade: ${input.grade}
- Board: ${input.board}
- Subject: ${input.subject}
- Chapter: ${input.chapter}
- Topic: ${input.topic}
- Language: ${input.language}

${conversationContext}

STUDENT'S QUESTION:
"${input.studentQuestion}"
${antiAbuseNote}
${intentGuidelines}

RESPONSE GUIDELINES:

1. EXPLANATION FIRST
   - Always explain the concept or reasoning.
   - Even if student asks "what is the answer", explain HOW to get there.
   - Make understanding unavoidable.

2. ENCOURAGING TONE
   - Start with acknowledgment: "Great question!" or "Let's figure this out together"
   - Use positive language throughout.
   - Never make the student feel bad for not knowing.

3. AGE-APPROPRIATE
   - Match language complexity to Grade ${input.grade}.
   - Use examples familiar to Indian students this age.
   - Avoid overly academic tone for younger grades.

4. FOLLOW-UP QUESTION
   - End with a question that:
     a) Checks if they understood the main concept, OR
     b) Encourages them to think one step further
   - Keep it simple and non-intimidating.
   - Example: "Does this make sense? Can you think of another example?"

5. STAY ON TOPIC
   - Only answer questions related to ${input.subject} and ${input.topic}.
   - If question is off-topic, gently redirect.
   - Do not engage with non-academic content.

6. CONFIDENCE LEVEL
   - Set to "high" if you're certain about the answer.
   - Set to "medium" if the question is ambiguous or has multiple interpretations.
   - Set to "low" if you're uncertain (but still provide best effort).

Return ONLY valid JSON matching this exact schema:
${DOUBTS_OUTPUT_SCHEMA}

Do NOT include any text before or after the JSON.
Do NOT wrap in markdown code blocks.`;
}

/**
 * Validate that a parsed response matches DoubtsOutputSchema
 * Basic structural validation (detailed validation in validators.ts)
 */
export function isValidDoubtsResponse(data: unknown): data is DoubtsOutputSchema {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.response === 'string' &&
    typeof obj.followUpQuestion === 'string' &&
    typeof obj.confidenceLevel === 'string' &&
    ['high', 'medium', 'low'].includes(obj.confidenceLevel as string)
  );
}

/**
 * Check if a question appears to be off-topic or inappropriate
 * Returns true if question should be filtered/redirected
 */
export function isOffTopicQuestion(question: string, _subject: string): boolean {
  const lowerQuestion = question.toLowerCase();
  
  // Personal/inappropriate patterns
  const inappropriatePatterns = [
    /\b(boyfriend|girlfriend|dating|love|crush)\b/,
    /\b(politics|election|vote|government policy)\b/,
    /\b(religion|god|pray|worship)\b/,
    /\b(violence|fight|kill|weapon)\b/,
    /\b(hack|cheat|copy|plagiarize)\b/,
  ];
  
  for (const pattern of inappropriatePatterns) {
    if (pattern.test(lowerQuestion)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a polite redirect response for off-topic questions
 */
export function getOffTopicRedirect(subject: string): DoubtsOutputSchema {
  return {
    response: `That's an interesting thought! But let's focus on ${subject} for now. Is there anything about your current topic you'd like help with? I'm here to help you learn! 📚`,
    followUpQuestion: `What part of your ${subject} studies can I help you with today?`,
    confidenceLevel: 'high',
  };
}
