export function buildLessonPrompt(input: unknown): string {
  return `You are generating structured course lessons.\n\nRules:\n- Output ONLY valid JSON\n- Match the provided schema exactly\n- Do not add extra fields\n- Depth must match professional education quality\n\nSCHOOL & TEACHER AGNOSTICITY ENFORCEMENT\n\nYou must assume:\n- No schools will integrate\n- No teachers will participate\n- No live classes will be run\n- No human intervention is available\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nReturn an array of Lesson objects.`
}

export default buildLessonPrompt
