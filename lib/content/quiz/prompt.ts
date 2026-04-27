export function buildQuizPrompt(input: unknown): string {
  return `You are generating multiple-choice quizzes for a single lesson.\n\nRules:\n- Output ONLY valid JSON\n- Each question must have exactly 4 options\n- ` +
    `correctIndex must be 0..3\n- Do not output markdown or any text outside JSON\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nReturn a Quiz object matching the schema.`
}

export default buildQuizPrompt
