export function buildProjectPrompt(input: unknown): string {
  return `You are generating a Project/Assignment for a course module.\n\nRules:\n- Output ONLY valid JSON\n- No markdown\n- No explanations outside JSON\n- Professional education quality and clarity\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nReturn a single ProjectAssignment object matching the schema.`
}

export default buildProjectPrompt
