// src/hydrators/hydrationPrompts.ts
/**
 * COPILOT RULES — HYDRATOR
 *
 * - Hydrators only enqueue jobs
 * - No AI calls allowed here
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Never mutate existing content
 * example
 * await prisma.hydrationJob.upsert({
 *  where: { jobType_unique },
 *   update: {},
 *   create: {
 *     jobType: "notes",
 *     topicId,
 *     language,
 *   },
 * });
 */

import { normalizeDifficulty } from '../lib/normalize';

type SyllabusPromptArgs = {
  board: string;
  grade: string;
  subject: string;
};

type NotesPromptArgs = {
  board: string;
  grade: string;
  subject: string;
  topic: string;
  language: 'en' | 'hi';
};

type QuestionsPromptArgs = {
  board: string;
  grade: string;
  subject: string;
  topic: string;
  difficulty: ReturnType<typeof normalizeDifficulty>;
};

export const syllabusPrompt = ({ board, grade, subject }: SyllabusPromptArgs) => `
You are an expert ${board} curriculum designer.

Generate the official syllabus for:
Board: ${board}
Class: ${grade}
Subject: ${subject}

Return JSON ONLY in this exact format:
{
  "chapters": [
    {
      "title": "Chapter name",
      "topics": ["Topic 1", "Topic 2"]
    }
  ]
}
`;

export const notesPrompt = ({ board, grade, subject, topic, language }: NotesPromptArgs) => `
You are an experienced ${board} teacher with 20 years of classroom experience in Indian schools.

Teach the following topic as if standing in front of a Grade ${grade} class for the first time.

Board: ${board}
Class: ${grade}
Subject: ${subject}
Topic: ${topic}
Language: ${language}

Teaching requirements:
- Start with a real-world analogy or scenario that Grade ${grade} students relate to.
- Build understanding step by step: intuition first, formal definition second.
- Explain WHY every rule or formula works, not just what it is.
- Include 2-3 fully worked examples. For each step write: what you do AND why.
- End with 4-5 key points to remember and 2-3 common mistakes (each with: mistake + why it happens + correct approach).

Return JSON ONLY matching this schema:
{
  "title": "string - clear descriptive title",
  "concept": "string - 2-3 sentence introduction linking topic to real life",
  "explanation": "string - full classroom explanation, minimum 400 words",
  "example": "string - 2-3 worked examples with step-by-step reasoning",
  "keyPoints": ["string", "string", "string", "string"],
  "commonMistakes": ["string", "string", "string"]
}
`;

export const questionsPrompt = ({
  board,
  grade,
  subject,
  topic,
  difficulty,
}: QuestionsPromptArgs) => `
You are an expert ${board} examiner.

Generate questions based on the following context:

Board: ${board}
Class: ${grade}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}

Generate exactly 5 questions.

Return JSON ONLY:
{
  "questions": [
    {
      "prompt": "Question text",
      "answer": "Correct answer"
    }
  ]
}
`;
