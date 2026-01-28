export interface SyllabusPromptInput {
  title: string;
  targetAudience?: string;
  skillLevel?: string;
  timeBudgetMinutes?: number;
  teachingStyle?: string;
  constraints?: string[];
}

export function buildSyllabusPrompt(input: SyllabusPromptInput): string {
  const example = {
    title: "Example Course Title",
    description: "Short one-line description of the course.",
    targetAudience: "Beginner developers",
    skillLevel: "beginner",
    timeBudgetMinutes: 180,
    teachingStyle: "hands-on",
    constraints: [],
    modules: [
      {
        title: "Module 1: Foundations",
        description: "Introductory concepts",
        lessons: [
          {
            title: "Lesson 1: Overview",
            description: "High-level overview",
            objectives: ["Understand core concepts", "Be able to explain key terms"],
            estimatedMinutes: 30
          }
        ],
        estimatedMinutes: 30
      }
    ],
    outcomes: ["Learner can explain core concepts"],
    version: "0.1.0-draft",
    approved: false,
    createdBy: "syllabus-generator",
    createdAt: "2025-01-01T00:00:00.000Z",
    aiMetadata: {},
    metadata: {}
  };

  return (
    `You are an assistant that MUST produce a valid JSON object that exactly follows the syllabus schema.\n` +
    `Requirements (IMPORTANT):\n` +
      `- Return RAW JSON ONLY — do NOT wrap the JSON in markdown code fences (\\\`\\\`\\\`), do NOT add any explanation, commentary, or prose.\n` +
    `- If you include markdown fences or any surrounding text, the consumer will strip them; however prefer to return plain JSON to avoid parsing errors.\n` +
      `- Do NOT include prose or commentary — only the JSON object (no fences, no language tags, no extra code blocks).\n` +
      `- If a value is unknown, use an empty array, empty object, false, null, or an empty string as appropriate; do not omit required fields.\n` +
    `- The JSON must use these fields exactly: title, description, targetAudience, skillLevel, timeBudgetMinutes, teachingStyle, constraints, modules, outcomes, version, approved, createdBy, createdAt, aiMetadata, metadata.\n` +
    `- modules is an array of objects with: title (string), description (string, optional), lessons (non-empty array), estimatedMinutes (integer minutes, optional).\n` +
    `- lessons is an array of objects with: title (string), description (string, optional), objectives (array of strings, non-empty), estimatedMinutes (integer minutes, optional), resources (array of {title, url?}, optional), assessmentHints (optional).\n` +
    `- Objectives MUST be an array of strings (one string per objective).\n` +
    `- Estimated time fields must be integers representing minutes.\n` +
    `- Do NOT include prose or commentary — only the JSON object.\n` +
    `- If a value is unknown, use an empty array, empty object, false, null, or an empty string as appropriate; do not omit required fields.\n\n` +
    `Input: ${JSON.stringify(input)}\n\n` +
    `EXAMPLE OUTPUT (for reference, produce similar shape):\n` +
    JSON.stringify(example, null, 2) +
    `\n\nReturn the JSON now:`
  );
}

export default buildSyllabusPrompt;
