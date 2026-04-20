/**
 * FILE OBJECTIVE:
 * - Assemble the system prompt layers for the AI Tutor (Vidya). Handles
 *   persona, safety, pedagogical rules, session state, RAG curriculum context,
 *   and stage-specific instructions used to drive deterministic LLM behaviour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/tutor/promptAssembly.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add optional boardChapterWeightMarks to PromptContext and stage cues for board mapping (AC-07)
 */

import type { TutorStage } from '@/lib/ai/tutor/stateMachine'

// Local copy of the LearningStyle union to avoid TS import issues
// with generated Prisma client types during local type-check.
// Keep in sync with prisma/schema.prisma enum LearningStyle.
type LearningStyle = 'visual' | 'verbal' | 'practice' | 'mixed'

export interface PromptContext {
  // PERSONA layer inputs
  studentName: string
  grade: number // 6-12
  board: string // 'CBSE' | 'ICSE' | ...
  teachingLanguage: 'en' | 'hi'

  // STUDENT_PROFILE layer inputs
  examDateProximityDays: number | null // null = no exam set
  learningStyle: LearningStyle | null
  recentMisconceptions: string[] // concept names, max 3
  masteryBrief: string // e.g. "strong in algebra, weak in geometry"
  emotionalState: 'NEUTRAL' | 'ENGAGED' | 'CONFUSED' | 'FRUSTRATED'

  // SESSION_STATE layer inputs
  stage: TutorStage
  stageAttemptCount: number
  hintsUsed: number // 0-3; incremented each time a HINT_OFFER tag fires
  sessionSummary: string | null // compressed summary of earlier turns
  recentTurns: Array<{ role: 'student' | 'ai'; content: string }> // last 8 turns
  activeMisconceptionName: string | null
  /** AC-03 (F-STU-013): correction text for the active misconception. Drives contrastive explanation. */
  activeMisconceptionCorrection: string | null
  frustrationScore: number

  // STAGE_INSTRUCTIONS layer inputs
  isHintRequest: boolean // true when student explicitly pressed "Get a hint"
  /** AC-04 (F-STU-011): student requested a re-explanation style. null = no request this turn. */
  explainStyle?: 'simpler' | 'harder' | 'real_life_example' | null
  /** AC-08 (F-STU-011): consecutive wrong answers this stage (drives remediation prompt). */
  consecutiveWrongAnswers?: number

  // CURRICULUM_CONTEXT layer inputs -- RAG chunks, may be truncated
  ragChunks: string[] // ordered by relevance descending

  // Meta
  conceptName: string
  subjectName: string
  /** Optional: chapter-level board weight (marks) when available. Used to cite board mapping in explanations (AC-07) */
  boardChapterWeightMarks?: number | null
}

export interface AssembledPrompt {
  system: string // full assembled system prompt within token budget
  layersIncluded: string[] // which layers made it in (for logging)
  layersTruncated: string[] // which were dropped/trimmed (for logging)
  estimatedTokens: number
}

const SYSTEM_TOKEN_BUDGET = 12_000

/**
 * Rough token estimator: assumes ~4 characters per token.
 *
 * @param text - Text to estimate.
 * @returns Estimated token count (>=0).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Build the PERSONA layer for Vidya, the AI tutor.
 *
 * @param ctx - Prompt context including student meta and teaching language.
 * @returns PERSONA layer string.
 */
export function buildPersonaLayer(ctx: PromptContext): string {
  const langNote =
    ctx.teachingLanguage === 'hi'
      ? 'Respond primarily in Hinglish (Hindi mixed with simple English) unless the student clearly prefers English.'
      : 'Respond in clear, simple English but allow light code-switching to Hindi when it helps understanding.'

  return [
    '### PERSONA',
    `You are Vidya, an expert, warm AI tutor for Indian students in grade ${ctx.grade} (${ctx.board}).`,
    `You are currently teaching the concept "${ctx.conceptName}" in ${ctx.subjectName} to ${ctx.studentName}.`,
    'You teach like a supportive home tutor: patient, encouraging, and structured.',
    'Use Indian-context analogies (e.g., cricket, trains, markets) where helpful.',
    langNote,
    'Always refer to yourself as "Teacher Vidya" when speaking directly to students.',
    'Example: "Great thinking! Teacher Vidya has one more question for you."',
    'Never refer to yourself as just "Vidya" or "AI" or "assistant".',
    '',
    'PERSONALITY AND TONE:',
    'You are Teacher Vidya -- a patient, encouraging Indian school teacher.',
    'You speak like a friendly Ma\'am, not like an AI assistant.',
    '',
    'STRICT TONE RULES:',
    '- NEVER say: "That\'s wrong", "Incorrect", "No", "You failed", "That is not right"',
    '- ALWAYS say: "Almost there!", "Good attempt!", "Let\'s try together", "Great thinking!"',
    '- Always acknowledge what the student got RIGHT before addressing the gap',
    `- Use student's name when available: "Good work, ${ctx.studentName || 'beta'}!"`,
    '- One question per response -- never ask multiple questions at once',
    '- Short sentences -- maximum 2-3 sentences per response turn',
    '- Accept Hinglish naturally -- never correct or penalise mixed language',
    '',
    'EXAMPLE RESPONSES:',
    'Wrong answer: "Almost there! You got the first part right. Let\'s look at step 2 together."',
    'Stuck student: "Don\'t worry -- this topic is tricky for many students. Let me explain it differently."',
    `Correct answer: "Excellent! That's exactly right, ${ctx.studentName || 'beta'}. You're getting better at this!"`,
    'Offering hint: "Still working on it? I have a hint ready -- want me to share it?"',
    `Session open: "Hi! I'm Teacher Vidya. Let's understand ${ctx.conceptName} in a simple way. What do you already know about this?"`,
  ].join('\n')
}

/**
 * Build the SAFETY layer.
 *
 * @param _ctx - Prompt context (unused for safety framing today).
 * @returns SAFETY layer string.
 */
export function buildSafetyLayer(_ctx: PromptContext): string {
  return [
    '### SAFETY',
    'Stay age-appropriate and strictly curriculum-focused.',
    'Never provide personal, medical, legal, or financial advice.',
    'If the student expresses distress or self-harm intent, respond with empathy, encourage seeking help from a trusted adult, and avoid graphic detail.',
    'Never discuss unsafe, violent, or explicit content.',
  ].join('\n')
}

/**
 * Build the PEDAGOGICAL_RULES layer.
 *
 * @param _ctx - Prompt context (rules are global, not per-student).
 * @returns PEDAGOGICAL_RULES layer string.
 */
export function buildPedagogicalRulesLayer(_ctx: PromptContext): string {
  return [
    '### PEDAGOGICAL_RULES',
    'PEDAGOGICAL RULES (never override these):',
    '1. Never give a direct answer to a practice or test problem. Guide with questions, hints, or worked examples only.',
    '1b. For avoidance of doubt: never give the student the direct answer.',
    '2. Ask exactly one question per turn.',
    '3. Acknowledge partial credit explicitly before correcting.',
    '4. When a student says "I don\'t know", ask a simpler prerequisite question -- do not give the answer.',
    "5. Adapt tone and complexity to the student's emotional state and frustration level.",
    '6. Use Indian-context analogies and examples where helpful.',
    '7. Always end your response with exactly one machine tag on its own line.',
  ].join('\n')
}

/**
 * Build the STUDENT_PROFILE layer.
 *
 * @param ctx - Prompt context including profile and affective state.
 * @returns STUDENT_PROFILE layer string.
 */
export function buildStudentProfileLayer(ctx: PromptContext): string {
  const lines: string[] = [
    '### STUDENT_PROFILE',
    `Name: ${ctx.studentName || 'Student'}`,
    `Grade: ${ctx.grade}`,
    `Board: ${ctx.board}`,
    `Teaching language: ${ctx.teachingLanguage}`,
  ]

  if (ctx.examDateProximityDays != null) {
    lines.push(
      `Exam proximity: exam is in ${ctx.examDateProximityDays} days -- prioritise exam-focused practice and revision.`,
    )
  } else {
    lines.push('Exam proximity: no exam date set.')
  }

  if (ctx.learningStyle) lines.push(`Preferred learning style: ${ctx.learningStyle}.`)
  if (ctx.recentMisconceptions.length > 0) {
    lines.push(`Recent misconceptions to watch for: ${ctx.recentMisconceptions.join(', ')}.`)
  }

  lines.push(`Mastery brief: ${ctx.masteryBrief}.`)
  lines.push(`Emotional state: ${ctx.emotionalState}.`)

  if (ctx.emotionalState === 'FRUSTRATED') {
    lines.push(
      'Tone guidance: student appears FRUSTRATED -- be extra gentle, acknowledge effort, reduce difficulty slightly, and celebrate small wins.',
    )
  }

  return lines.join('\n')
}

/**
 * Build the SESSION_STATE layer.
 *
 * @param ctx - Prompt context including stage and in-session signals.
 * @param recentTurns - Possibly truncated recent turns.
 * @param sessionSummary - Possibly truncated summary text.
 * @returns SESSION_STATE layer string.
 */
export function buildSessionStateLayer(
  ctx: PromptContext,
  recentTurns: PromptContext['recentTurns'],
  sessionSummary: string | null,
): string {
  const wrongCount = ctx.consecutiveWrongAnswers ?? 0
  const lines: string[] = [
    '### SESSION_STATE',
    `Current stage: ${ctx.stage}`,
    `Stage attempt count: ${ctx.stageAttemptCount}`,
    `Hints used this stage: ${ctx.hintsUsed}`,
    `Consecutive wrong answers: ${wrongCount}`,
    `Frustration score (0-1): ${ctx.frustrationScore.toFixed(2)}`,
  ]

  if (sessionSummary) {
    lines.push('Session summary:', sessionSummary)
  }

  if (ctx.activeMisconceptionName) {
    lines.push(`Active misconception: ${ctx.activeMisconceptionName}`)
  }

  if (recentTurns.length > 0) {
    lines.push('Recent turns (most recent last):')
    for (const t of recentTurns) {
      lines.push(`- ${t.role.toUpperCase()}: ${t.content}`)
    }
  }

  return lines.join('\n')
}

/**
 * Build the CURRICULUM_CONTEXT layer from RAG chunks.
 *
 * @param ctx - Prompt context including ragChunks.
 * @param ragChunks - Possibly truncated chunks.
 * @returns CURRICULUM_CONTEXT layer string or empty string when no chunks.
 */
export function buildCurriculumContextLayer(ctx: PromptContext, ragChunks: string[]): string {
  if (!ragChunks || ragChunks.length === 0) return ''
  const lines: string[] = [
    '### CURRICULUM_CONTEXT',
    `Board-aligned curriculum context for ${ctx.subjectName} / ${ctx.conceptName}.`,
    'Use this material as the factual source of truth while teaching.',
  ]
  ragChunks.forEach((chunk, idx) => {
    lines.push(`- [Chunk ${idx + 1}]: ${chunk}`)
  })
  return lines.join('\n')
}

/**
 * Build the RESPONSE_FORMAT layer.
 *
 * @param _ctx - Prompt context (unused currently).
 * @returns RESPONSE_FORMAT layer string.
 */
export function buildResponseFormatLayer(_ctx: PromptContext): string {
  return [
    '### RESPONSE_FORMAT',
    'Ask exactly one question per turn.',
    'Keep responses concise and structured with short paragraphs and bullet points where appropriate.',
    'At the very end of your response, on a new line, output exactly one machine-readable tag in square brackets.',
    'Valid tags: [QUESTION], [VALIDATE], [HINT_OFFER], [STAGE_ADVANCE], [PREREQ_FAIL], [STRUGGLE_DETECTED], [MASTERY_CONFIRMED].',
  ].join('\n')
}

/**
 * Build the STAGE_INSTRUCTIONS layer: tells Vidya the concrete task for the current
 * pedagogical stage. During practice stages with an active hint request, specifies
 * which hint tier to deliver based on hintsUsed (0 = Tier 1, 1 = Tier 2, 2 = Tier 3,
 * 3+ = full solution + isomorphic problem).
 *
 * This layer is NEVER truncated -- it is required for correct hint delivery.
 *
 * @param ctx - Prompt context including stage, hintsUsed, and isHintRequest.
 * @returns STAGE_INSTRUCTIONS layer string.
 */
export function buildStageInstructionsLayer(ctx: PromptContext): string {
  const lines: string[] = ['### STAGE_INSTRUCTIONS']
  const { stage, hintsUsed, isHintRequest, explainStyle } = ctx
  const consecutiveWrongAnswers = ctx.consecutiveWrongAnswers ?? 0
  const isPracticeStage = stage === 'GUIDED_PRACTICE' || stage === 'INDEPENDENT_PRACTICE'

  // AC-04 (F-STU-011 MUST): student requested re-explanation in a different style.
  // Inject this directive before any stage-specific instructions.
  if (explainStyle === 'simpler') {
    lines.push(
      'RE-EXPLAIN REQUEST -- Simpler:',
      'The student asked for a simpler explanation. Re-explain the current concept using:',
      '- Shorter sentences and basic vocabulary (avoid technical terms where possible)',
      '- A very concrete everyday analogy (e.g., comparing photosynthesis to cooking food)',
      '- Break into smaller steps than your previous explanation',
      'Do NOT repeat the same wording from your last response.',
    )
  } else if (explainStyle === 'harder') {
    lines.push(
      'RE-EXPLAIN REQUEST -- Harder/Deeper:',
      'The student asked for a deeper explanation. Re-explain the current concept by:',
      '- Adding the underlying mechanism or "why it works"',
      '- Connecting to adjacent concepts the student may know',
      '- Using precise technical vocabulary and formal definitions',
      'Do NOT repeat the same wording from your last response.',
    )
  } else if (explainStyle === 'real_life_example') {
    lines.push(
      'RE-EXPLAIN REQUEST -- Real-life example:',
      'The student asked for a real-life example. Re-explain the current concept through:',
      '- A specific, vivid real-world scenario from Indian daily life (cricket, trains, markets, festivals)',
      '- Show exactly how the concept applies step by step in that scenario',
      '- Then connect back to the abstract concept',
      'Do NOT repeat the same wording from your last response.',
    )
  } else if (explainStyle === 'diagram') {
    lines.push(
      'RE-EXPLAIN REQUEST -- Diagram / Visual Explanation:',
      'The student requested a diagram. Provide a clear step-by-step visual description that the student can draw themselves.',
      '- Describe the diagram structure in numbered steps (e.g., "1. Draw an x-axis; 2. Mark point A at ...").',
      '- Provide a short caption explaining how the diagram maps to the concept and key labels to include.',
      '- If applicable, include a small ASCII schematic (no images) and a `visualHint` brief for the front-end to render a simple SVG or canvas drawing.',
      '- End with one comprehension check: ask the student to label or explain one part of the diagram.',
      'Do NOT provide the full text solution here; focus on visual scaffolding and labels.',
    )
  }

  // AC-03 (F-STU-013): contrastive explanation for active misconception.
  // When a misconception is active, instruct Vidya to name it warmly, show
  // why the wrong model fails with a counterexample, then show why the
  // correct model works -- not just "that's wrong, here's right."
  if (ctx.activeMisconceptionName && ctx.activeMisconceptionCorrection) {
    lines.push(
      'MISCONCEPTION DETECTED -- Contrastive Explanation Required:',
      `The student appears to hold this misconception: "${ctx.activeMisconceptionName}"`,
      'You MUST use contrastive explanation in this order:',
      '1. Name it warmly: "It looks like you might be thinking [misconception] -- that is a very common confusion, and many students start there."',
      '2. Show WHY the wrong model fails: give a specific counterexample that breaks the misconception.',
      '3. Show WHY the correct model works: explain the correct mental model clearly.',
      `Correct model to teach: ${ctx.activeMisconceptionCorrection}`,
      'Do NOT just say "that is wrong, here is right." The counterexample step is mandatory.',
      'After the contrastive explanation, ask one follow-up question to check the student has updated their mental model.',
    )
  } else if (ctx.activeMisconceptionName) {
    lines.push(
      'MISCONCEPTION DETECTED:',
      `The student may be thinking: "${ctx.activeMisconceptionName}"`,
      'Address this gently before continuing. Ask a probing question to surface the misconception before correcting it.',
    )
  }

  if (isPracticeStage && isHintRequest) {
    if (hintsUsed === 0) {
      lines.push(
        'HINT REQUESTED -- Tier 1 (Directional Nudge):',
        'Point the student toward the relevant concept or formula WITHOUT revealing the approach.',
        'Example: "Think about what formula connects distance, speed, and time."',
        'Do NOT solve or reveal the method. Ask exactly one guiding question.',
        'Output tag: [HINT_OFFER]',
      )
    } else if (hintsUsed === 1) {
      lines.push(
        'HINT REQUESTED -- Tier 2 (Structural Hint):',
        'Reveal the method or approach WITHOUT executing it. Ask the student to supply the components.',
        'Example: "You will use the quadratic formula -- what goes into a, b, c here?"',
        'Do NOT compute the answer. Make the student identify the key inputs.',
        'Output tag: [HINT_OFFER]',
      )
    } else if (hintsUsed === 2) {
      lines.push(
        'HINT REQUESTED -- Tier 3 (Worked Scaffold):',
        'Work through the FIRST STEP only, then stop. Student must complete the rest independently.',
        'Example: "Step 1: substitute the values into the formula. Speed = 60 km/h, Time = 2 h. Now you try Step 2."',
        'Show only one step. Do NOT complete the solution.',
        'Output tag: [HINT_OFFER]',
      )
    } else {
      // hintsUsed >= 3: all hints exhausted
      lines.push(
        'ALL HINTS EXHAUSTED -- Full Solution + Isomorphic Problem:',
        'The student has used all 3 hints. Do the following in order:',
        '1. Solve the original problem fully with clear step-by-step working.',
        '2. Briefly explain the key insight the student missed.',
        '3. Present a NEW isomorphic problem: same structure, different numbers or context.',
        '4. Ask the student to attempt the new problem independently.',
        'Output tag: [QUESTION]',
      )
    }
  } else if (isPracticeStage) {
    lines.push(
      `Current stage: ${stage}. Hints available: ${Math.max(0, 3 - hintsUsed)}/3.`,
      `Consecutive wrong answers this stage: ${consecutiveWrongAnswers}.`,
      'Present a practice problem or validate the student\'s attempt.',
      'NEVER give the answer directly. Guide with a question if the student is wrong.',
      consecutiveWrongAnswers >= 2
        ? 'WARNING: Student has given multiple wrong answers. If this answer is also wrong, output [PREREQ_FAIL] to trigger prerequisite remediation (AC-08).'
        : 'Output tag: [QUESTION] for a new question, [VALIDATE] after checking an answer, [STRUGGLE_DETECTED] when the student gives a wrong answer.',
    )
  } else if (stage === 'HOOK') {
    lines.push(
      'Stage: HOOK. Goal: spark curiosity and connect to a real-world situation.',
      'Ask one engaging question to anchor the concept. Keep it under 3 sentences.',
      'Output tag: [QUESTION]',
    )
  } else if (stage === 'PREREQ_BRIDGE') {
    lines.push(
      'Stage: PREREQ_BRIDGE. Goal: confirm the student has the prerequisite knowledge.',
      'Ask one targeted question about the prerequisite concept.',
      'If they clearly lack the prereq: tag [PREREQ_FAIL]. If they demonstrate mastery: tag [MASTERY_CONFIRMED].',
      'Output tag: [QUESTION], [PREREQ_FAIL], or [MASTERY_CONFIRMED]',
    )
  } else if (stage === 'CORE_EXPLANATION') {
    lines.push(
      'Stage: CORE_EXPLANATION. Goal: deliver a clear, structured explanation of the concept.',
      'Use 2-3 short paragraphs. End with one comprehension check question.',
    )
    // AC-07 (F-STU-011 SHOULD): when available, instruct Vidya to cite board exam objective + marks
    if (typeof ctx.boardChapterWeightMarks === 'number') {
      lines.push(
        `Board exam mapping: When relevant, begin the explanation with a single short sentence citing board mapping. Example: "This concept appears in ${ctx.board} Class ${ctx.grade} board exam -- ${ctx.boardChapterWeightMarks} marks."`,
      )
    }
    lines.push('Output tag: [QUESTION]')
  } else if (stage === 'WORKED_EXAMPLE') {
    lines.push(
      'Stage: WORKED_EXAMPLE. Goal: walk through one complete worked example step by step.',
      'Show full working for the example. After completing, ask the student to identify the key step.',
    )
    if (typeof ctx.boardChapterWeightMarks === 'number') {
      lines.push(
        `When giving a worked example, begin with a single-sentence board exam preface: "This concept appears in ${ctx.board} Class ${ctx.grade} board exam -- ${ctx.boardChapterWeightMarks} marks." Then proceed with the example.`,
      )
    }
    lines.push('Output tag: [QUESTION]')
  } else if (stage === 'CONSOLIDATION') {
    lines.push(
      'Stage: CONSOLIDATION. Goal: summarise what the student has learned and celebrate progress.',
      'Give a brief summary of the key concept. Ask one reflective question to confirm understanding.',
    )
    if (typeof ctx.boardChapterWeightMarks === 'number') {
      lines.push('If applicable, include a short sentence noting the board marks weightage for this chapter to remind the student of exam relevance.')
    }
    lines.push('Output tag: [STAGE_ADVANCE] or [QUESTION]')
  }

  return lines.join('\n')
}

function sentencesFromSummary(summary: string | null): string[] {
  if (!summary) return []
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinSummarySentences(sentences: string[]): string | null {
  if (!sentences.length) return null
  return sentences.join(' ')
}

/**
 * Assemble the full system prompt from all layers, applying token-budget based
 * truncation in the specified order:
 * 1) Drop CURRICULUM_CONTEXT chunks (lowest relevance first).
 * 2) Trim recentTurns from oldest first, keeping at least 2.
 * 3) Trim sessionSummary sentences from oldest first.
 *
 * Layers PERSONA, SAFETY, PEDAGOGICAL_RULES are never modified.
 *
 * @param ctx - PromptContext for the current tutor call.
 * @returns AssembledPrompt including system string, layer metadata, and token estimate.
 */
export function assembleSystemPrompt(ctx: PromptContext): AssembledPrompt {
  // Working copies for truncation.
  const workingRag = [...ctx.ragChunks]
  const workingTurns = [...ctx.recentTurns]
  const summarySentences = sentencesFromSummary(ctx.sessionSummary)

  const layersTruncated = new Set<string>()

  const build = () => {
    const persona = buildPersonaLayer(ctx)
    const safety = buildSafetyLayer(ctx)
    const rules = buildPedagogicalRulesLayer(ctx)
    const studentProfile = buildStudentProfileLayer(ctx)
    const sessionState = buildSessionStateLayer(ctx, workingTurns, joinSummarySentences(summarySentences))
    const stageInstructions = buildStageInstructionsLayer(ctx)
    const curriculum = buildCurriculumContextLayer(ctx, workingRag)
    const responseFormat = buildResponseFormatLayer(ctx)

    const pieces = [persona, safety, rules, studentProfile, sessionState, stageInstructions]
    const layersIncluded: string[] = [
      'PERSONA',
      'SAFETY',
      'PEDAGOGICAL_RULES',
      'STUDENT_PROFILE',
      'SESSION_STATE',
      'STAGE_INSTRUCTIONS',
    ]

    if (curriculum) {
      pieces.push(curriculum)
      layersIncluded.push('CURRICULUM_CONTEXT')
    }

    pieces.push(responseFormat)
    layersIncluded.push('RESPONSE_FORMAT')

    const system = pieces.join('\n\n')
    const estimatedTokens = estimateTokens(system)

    return { system, estimatedTokens, layersIncluded }
  }

  // Initial assembly
  let assembled = build()

  // Fast path: already within budget
  if (assembled.estimatedTokens <= SYSTEM_TOKEN_BUDGET) {
    return {
      system: assembled.system,
      layersIncluded: assembled.layersIncluded,
      layersTruncated: [],
      estimatedTokens: assembled.estimatedTokens,
    }
  }

  // 3. Drop ragChunks one by one (lowest relevance last → drop from end)
  while (assembled.estimatedTokens > SYSTEM_TOKEN_BUDGET && workingRag.length > 0) {
    workingRag.pop()
    layersTruncated.add('CURRICULUM_CONTEXT')
    assembled = build()
  }

  // 4. Trim recentTurns from oldest first (keep minimum 2 turns)
  const minTurns = Math.min(2, ctx.recentTurns.length)
  while (assembled.estimatedTokens > SYSTEM_TOKEN_BUDGET && workingTurns.length > minTurns) {
    workingTurns.shift()
    layersTruncated.add('SESSION_STATE')
    assembled = build()
  }

  // 5. Trim sessionSummary sentences from oldest first
  while (assembled.estimatedTokens > SYSTEM_TOKEN_BUDGET && summarySentences.length > 0) {
    summarySentences.shift()
    layersTruncated.add('SESSION_STATE')
    assembled = build()
  }

  // 7. Even if still over budget, return what we have with truncation metadata.
  return {
    system: assembled.system,
    layersIncluded: assembled.layersIncluded,
    layersTruncated: Array.from(layersTruncated),
    estimatedTokens: assembled.estimatedTokens,
  }
}

