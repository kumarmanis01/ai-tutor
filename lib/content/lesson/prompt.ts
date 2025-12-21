export function buildLessonPrompt(input: unknown): string {
  return `You are generating structured course lessons.\n\nRules:\n- Output ONLY valid JSON\n- Match the provided schema exactly\n- Do not add extra fields\n- Depth must match professional education quality\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nReturn an array of Lesson objects.`
}

export default buildLessonPrompt
