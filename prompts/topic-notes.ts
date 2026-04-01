/**
 * FILE OBJECTIVE:
 * - Template generator for topic notes prompts (grades 6-12).
 * - Produces classroom-quality notes: thorough explanations, real-world
 *   analogies, and fully worked step-by-step examples.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/topic-notes.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 * - 2026-04-01T00:00:00Z | claude        | rewrite: classroom-teacher depth,
 *     multi-example requirement, removed artificial word cap that was
 *     producing shortcut bullet notes instead of teaching content
 */

export type TopicNotesParams = {
  topicName: string
  grade: number // 6-12
  maxWords?: number
  language?: 'en' | 'hi' // single-language template
  /** Official NCERT chapter text from CurriculumChunk. When present the LLM
   *  must ground its output in this content and not introduce extra concepts. */
  ncertContext?: string
}

export function topicNotesPrompt(params: TopicNotesParams): string {
  const maxWords = params.maxWords ?? 1200
  const isHindi = params.language === 'hi'
  const lang = isHindi ? 'Hindi' : 'English'

  const ncertSection = params.ncertContext
    ? `Official NCERT Textbook Content (primary source -- base all notes on this text only):\n---\n${params.ncertContext}\n---\n\n`
    : ''

  const taskLine = params.ncertContext
    ? `Task: Based ONLY on the NCERT content above, write classroom-quality study notes for "${params.topicName}" in ${lang}. Do not introduce concepts absent from the NCERT text.`
    : `Task: Write classroom-quality study notes for "${params.topicName}" in ${lang} for Grade ${params.grade} students.`

  return `${ncertSection}You are an experienced ${params.grade <= 8 ? 'middle school' : 'senior school'} ${isHindi ? 'Hindi-medium ' : ''}teacher with 20 years of classroom experience in Indian schools.

${taskLine}

--- WHAT "CLASSROOM QUALITY" MEANS ---
Write as if you are standing in front of a class of Grade ${params.grade} students and teaching this topic for the first time. Your notes should:
- Open by connecting the topic to something students already know or encounter in daily life.
- Build understanding step by step: intuition first, formal definition second.
- Use analogies drawn from things Indian students of Grade ${params.grade} genuinely relate to (cricket, chai, local markets, school, seasons -- whatever fits naturally).
- Never state a rule without explaining why the rule is true.
- Never show an answer without explaining every step that leads to it.

--- FIELD INSTRUCTIONS ---

concept (2-4 sentences):
  Introduce the topic the way a teacher opens a lesson. Start with why this topic matters or where it appears in the real world. End with a one-sentence definition.
  Example opening style: "Have you ever noticed that when you fold a piece of paper in half, then in half again, the number of layers doubles each time? This doubling pattern is the heart of what we call..."

explanation (target 500-700 words, minimum 400 words):
  Teach the concept in full. Your explanation MUST include:
  1. A relatable real-world scenario or analogy that grounds the abstract idea.
  2. How the concept works, broken into 3-5 clear stages or sub-ideas.
  3. Any important formula, rule, or property -- stated AND explained (not just listed).
  4. At least one brief "What if...?" extension question that makes students think deeper.
  Do NOT use bullet points inside the explanation field -- write in clear paragraphs as a teacher would speak.

example (2-3 fully worked examples, minimum 200 words total):
  Format each example exactly as shown below. Each step must say both WHAT you do and WHY:

  Example 1: [Write the problem statement here]
  Step 1: [Describe the action] -- [Explain the reasoning behind this step]
  Step 2: [Describe the action] -- [Explain the reasoning behind this step]
  ...continue until complete...
  Answer: [Final answer with units where applicable]

  Example 2: [A slightly harder or different-context problem]
  Step 1: ...
  Answer: ...

  Example 3 (if the topic is numerical or procedural): [A challenging application or twist]
  Step 1: ...
  Answer: ...

  If the topic is descriptive (e.g. a historical event, a biological process), replace examples with two detailed case studies or illustrations of the concept in action, each 80-100 words.

keyPoints (5-6 items):
  Each item must be a complete, memorable sentence -- not a fragment. Include:
  - The most important rule or definition to remember.
  - Any formula or equation the student must know.
  - One or two common patterns seen in exam questions.
  - A practical tip for applying the concept.

commonMistakes (3-4 items):
  For each mistake, write: what the mistake is + why students fall into it + how to avoid it.
  Example format: "Students often confuse X with Y because both [reason]. The key difference is [distinction]. To avoid this, always [action]."

--- CONSTRAINTS ---
- Audience: Grade ${params.grade}. Use vocabulary appropriate for this age -- define any technical term the first time you use it.
- Language: ${lang} only. ${isHindi ? 'Use natural school Hindi (avoid heavy Sanskrit); technical terms may appear in English with a Hindi explanation.' : ''}
- Word budget: keep total content under ${maxWords} words but do NOT cut depth to meet the limit -- if the topic genuinely requires more, prioritise completeness.
- No empty filler phrases like "In conclusion..." or "As we have learned...".
- Do NOT use markdown headers, bold markers, or HTML inside field values -- plain text only.

Output JSON Schema (return ONLY valid JSON matching this EXACT structure):
{
  "title": string,
  "concept": string,
  "explanation": string,
  "example": string,
  "keyPoints": [string, string, string, string, string],
  "commonMistakes": [string, string, string]
}

Validation Constraints:
- Return EXACTLY the JSON object above. Do NOT include markdown, comments, extra fields, or trailing commas.
- All text fields: plain text only, no HTML or markup.
- keyPoints: array of 5-6 strings. commonMistakes: array of 3-4 strings.
- Be deterministic: do not randomize ordering or phrasing styles.
- If unable to produce valid output, return '{}' (an empty JSON object).

Strict Output Instruction: Return ONLY valid JSON that exactly matches the schema above, nothing else.`
}
