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

import { normalizeDifficulty } from "../lib/normalize";

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
  language: "en" | "hi";
};

type QuestionsPromptArgs = {
  board: string;
  grade: string;
  subject: string;
  topic: string;
  difficulty: ReturnType<typeof normalizeDifficulty>;
};

export const syllabusPrompt = ({
  board,
  grade,
  subject,
}: SyllabusPromptArgs) => `
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

export const notesPrompt = ({
  board,
  grade,
  subject,
  topic,
  language,
}: NotesPromptArgs) => `
You are an expert ${board} teacher.

Explain the following topic for students:

Board: ${board}
Class: ${grade}
Subject: ${subject}
Topic: ${topic}
Language: ${language}

Return JSON ONLY:
{
  "title": "Short title",
  "content": "Well-structured explanation"
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
