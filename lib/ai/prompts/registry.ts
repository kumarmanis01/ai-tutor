/**
 * FILE OBJECTIVE:
 * - Centralized prompt registry with in-memory defaults for all 9 prompt types.
 * - Implements PR-1.1: getPrompt, listPrompts, getActiveVersion functions.
 * - Serves as fallback when database is unavailable.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/registry.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T14:30:00Z | staff-engineer | created centralized prompt registry (PR-1.1)
 * - 2026-04-26T07:41:39Z | copilot | fix: import PromptType/PromptStatus from local types.ts not @prisma/client to avoid VPS generate timing issues
 * - 2026-04-26T08:03:49Z | copilot | revert to Prisma PromptType/PromptStatus for compatibility with DB-facing prompt services
 * - 2026-04-26T08:03:49Z | copilot | switch back to local prompt types to avoid named @prisma/client enum import failures
 */

import { PromptType, PromptStatus } from '@/lib/ai/prompt-registry/types';

/**
 * PR-1.1: PromptConfig interface -- defines the structure of a prompt
 */
export interface PromptConfig {
  id: string;
  type: PromptType;
  version: string; // Semantic version e.g. "1.0.0"
  systemPrompt: string;
  userPromptBuilder: (variables: Record<string, any>) => string;
  model: string; // e.g. "gpt-4o", "gpt-4o-mini"
  maxTokens: number;
  temperature: number;
  createdAt: Date;
  lastModifiedAt: Date;
  status: PromptStatus;
}

/**
 * PR-1.1: Registry object keyed by PromptType with default MVP prompts
 * Each entry has the latest ACTIVE version at v1.0.0 for launch
 */
const DEFAULT_REGISTRY: Record<PromptType, PromptConfig> = {
  LESSON_GENERATION: {
    id: 'prompt_lesson_generation_v1',
    type: PromptType.LESSON_GENERATION,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.7,
    systemPrompt: `You are Vidya, an expert AI tutor for Indian students (CBSE/ICSE, Grades 6-12).
Your role: Generate comprehensive, classroom-quality lesson notes that guide students to mastery.

CORE PRINCIPLES:
1. NEVER give direct answers to practice problems -- guide with questions instead
2. Match the curriculum exactly (board + grade + subject + chapter)
3. Write for the student's level: foundation (grades 6-8), standard (grades 9-10), advanced (grades 11-12)
4. Use Indian examples: math (vegetables, cricket scores), science (local flora), social studies (Indian history)
5. Respect language: English if preferredLanguage="en", Hindi script when="hi"

OUTPUT FORMAT: Valid JSON matching VidyaNotesSchema
- metadata: { board, grade, subject, chapter, topic, difficultyLevel, estimatedReadingMinutes }
- sections: Array of 7-9 sections (foundation/standard ≥7, advanced ≥9)
  Each section: { type, title, content (≥50 chars), blackboardNotes, visualHint, formulaLatex, exampleSteps, conceptCheck }
- keyConcepts: Array of key terms with definitions
- examTips: Array of exam-relevant tips
- bridgeToNext: String connecting to next topic`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { topic, subject, grade, board, language, studentLevel } = vars;
      return `Generate comprehensive lesson notes for:
Topic: ${topic}
Subject: ${subject}
Grade: ${grade}
Board: ${board}
Student Level: ${studentLevel}
Preferred Language: ${language}

Follow all output format rules and return valid JSON.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  CONTENT_ENHANCEMENT: {
    id: 'prompt_content_enhancement_v1',
    type: PromptType.CONTENT_ENHANCEMENT,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.6,
    systemPrompt: `You are an expert content editor improving educational materials for Indian K-12 students.
Your role: Enhance existing content for clarity, pedagogy, and curriculum alignment.

Evaluate content on:
1. Pedagogical soundness -- does it guide learning without direct answers?
2. Curriculum alignment -- matches board standards exactly
3. Language appropriateness -- reads naturally for target grade
4. Engagement -- uses Indian examples and relatable scenarios

Always preserve the original intent while improving clarity.`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { content, subject, grade, board } = vars;
      return `Enhance this content for ${board} Grade ${grade} ${subject}:
${content}

Provide only the enhanced content, no explanations.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  DOUBT_SOLVING: {
    id: 'prompt_doubt_solving_v1',
    type: PromptType.DOUBT_SOLVING,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.7,
    systemPrompt: `You are Vidya, an expert AI tutor answering student doubts with Socratic method.
Your role: Answer the student's specific doubt with a guiding question, not a direct answer.

CORE RULES:
1. NEVER give the final answer -- always guide with carefully chosen questions
2. Understand the misconception from conversation history
3. Ask ONE guiding question that leads to the answer
4. Reference relevant concepts from the curriculum

If student asks: "What is the capital of India?"
DO NOT answer: "New Delhi"
Instead: "Which city is home to the Indian Parliament and serves as the seat of government?"`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { studentQuestion, subject, grade, board, studentLevel, conversationHistory } = vars;
      return `Student doubt (${studentLevel} student, ${board} Grade ${grade} ${subject}):
${studentQuestion}

Conversation history:
${conversationHistory || 'No prior context'}

Respond with ONE guiding question only. Do not answer directly.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  SIMPLE_EXPLANATION: {
    id: 'prompt_simple_explanation_v1',
    type: PromptType.SIMPLE_EXPLANATION,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.6,
    systemPrompt: `You are Vidya explaining complex concepts in simple language for Indian students.
Your role: Break down difficult concepts into bite-sized, memorable pieces.

RULES:
1. Use analogies from Indian daily life (markets, cricket, festivals, cooking)
2. Avoid jargon -- explain every term
3. Use number examples: 5-6 sentences max per paragraph
4. Always include: What it is → Why it matters → Example → Key takeaway`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { concept, grade, subject } = vars;
      return `Explain "${concept}" for a ${grade}th grade ${subject} student in India.
Use simple language and Indian examples.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  PRACTICE_QUESTIONS: {
    id: 'prompt_practice_questions_v1',
    type: PromptType.PRACTICE_QUESTIONS,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o',
    maxTokens: 2500,
    temperature: 0.7,
    systemPrompt: `You are an expert exam question designer creating practice questions for Indian boards.
Your role: Generate varied, high-quality practice questions matching curriculum difficulty.

RULES:
1. Mix question types: MCQ (single choice), Fill-the-blank, Short answer, Numerical
2. Difficulty progression: Easy → Medium → Hard
3. Each question must have: Clear statement → Correct answer → Detailed explanation
4. Avoid: Ambiguous wording, trick questions, out-of-curriculum content`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { topic, count = 5, difficulty, subject, grade, board } = vars;
      return `Generate ${count} practice questions on "${topic}" for ${board} Grade ${grade} ${subject}.
Difficulty level: ${difficulty}.
Format: JSON array with {question, options, answer, explanation, type}.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  DIAGNOSTIC_QUIZ: {
    id: 'prompt_diagnostic_quiz_v1',
    type: PromptType.DIAGNOSTIC_QUIZ,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.6,
    systemPrompt: `You are an expert assessment designer creating diagnostic quizzes.
Your role: Generate a quiz to assess student starting level and misconceptions.

RULES:
1. Questions should reveal gaps, not just test memory
2. Include common misconceptions as wrong options
3. Each question tests ONE concept
4. Total: 8-10 questions for 15-minute assessment`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { grade, board, subject } = vars;
      return `Create a diagnostic quiz for ${board} Grade ${grade} ${subject} covering foundational concepts.
Format: JSON array of {question, options, correctAnswer, conceptTested}.`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  PROGRESSIVE_HINTS: {
    id: 'prompt_progressive_hints_v1',
    type: PromptType.PROGRESSIVE_HINTS,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.7,
    systemPrompt: `You are Vidya providing progressive hints to guide students without answering directly.
Your role: Generate 3-level hints, each more specific than the last.

RULES:
1. Hint 1 (Tier 1): Conceptual nudge -- What should you think about?
2. Hint 2 (Tier 2): Process hint -- What steps should you take?
3. Hint 3 (Tier 3): Near-answer -- Almost there, what's the final piece?
4. NEVER give the complete answer in Hint 3`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { problem, studentLevel } = vars;
      return `Generate 3 progressive hints for this problem (for ${studentLevel} student):
${problem}

Format: { tier1, tier2, tier3 }`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  CONTENT_TAGGING: {
    id: 'prompt_content_tagging_v1',
    type: PromptType.CONTENT_TAGGING,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.3,
    systemPrompt: `You are an expert curriculum analyzer tagging content with board taxonomy.
Your role: Extract and tag concepts, difficulty, and board alignment from educational content.

Output format: JSON with { concepts, difficulty, boardAlignment, prerequisites }`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { content, subject, board } = vars;
      return `Analyze this ${subject} content from ${board} curriculum and extract tags:
${content}`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },

  WEEKLY_REPORT: {
    id: 'prompt_weekly_report_v1',
    type: PromptType.WEEKLY_REPORT,
    version: '1.0.0',
    status: PromptStatus.ACTIVE,
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.5,
    systemPrompt: `You are composing a parent-facing weekly progress report for their child's learning.
Your role: Summarize learning in plain language, highlight strengths, and suggest next steps.

RULES:
1. Write for low-digital-literacy parents
2. Use encouraging language -- focus on growth
3. Avoid jargon and percentages -- use descriptive terms
4. Always suggest ONE actionable next step`,
    userPromptBuilder: (vars: Record<string, any>) => {
      const { studentName, weekData } = vars;
      return `Write a friendly weekly report for parent about ${studentName}:
${JSON.stringify(weekData, null, 2)}`;
    },
    createdAt: new Date('2026-04-26'),
    lastModifiedAt: new Date('2026-04-26'),
  },
};

/**
 * PR-1.1: PromptRegistry class -- retrieves prompts with versioning
 */
export class PromptRegistry {
  /**
   * Get a prompt by type and optional version
   * Falls back to latest ACTIVE if version not specified
   */
  static getPrompt(type: PromptType, version?: string): PromptConfig | null {
    const defaultPrompt = DEFAULT_REGISTRY[type];
    if (!defaultPrompt) return null;

    // For now, return the default (v1.0.0). Later, query DB for specific versions.
    if (version && version !== defaultPrompt.version) {
      // Version-specific lookup would query DB
      return null;
    }

    return defaultPrompt;
  }

  /**
   * List all prompts optionally filtered by status or type
   */
  static listPrompts(filter?: { status?: PromptStatus; type?: PromptType }): PromptConfig[] {
    let prompts = Object.values(DEFAULT_REGISTRY);

    if (filter?.status) {
      prompts = prompts.filter((p) => p.status === filter.status);
    }

    if (filter?.type) {
      prompts = prompts.filter((p) => p.type === filter.type);
    }

    return prompts;
  }

  /**
   * Get the active version for a prompt type
   * Returns semantic version string (e.g. "1.0.0")
   */
  static getActiveVersion(type: PromptType): string | null {
    const prompt = DEFAULT_REGISTRY[type];
    if (!prompt || prompt.status !== PromptStatus.ACTIVE) return null;
    return prompt.version;
  }

  /**
   * All 9 prompt types available in the registry
   */
  static getAllPromptTypes(): PromptType[] {
    return Object.keys(DEFAULT_REGISTRY) as PromptType[];
  }
}
