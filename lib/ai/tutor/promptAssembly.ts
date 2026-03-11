import type { TutorStage } from '@/lib/ai/tutor/stateMachine'

export interface PromptContext {
  // PERSONA layer inputs
  studentName: string
  grade: number // 6–12
  board: string // 'CBSE' | 'ICSE' | ...
  teachingLanguage: 'en' | 'hi'

  // STUDENT_PROFILE layer inputs
  examDateProximityDays: number | null // null = no exam set
  learningStyle: string | null
  recentMisconceptions: string[] // concept names, max 3
  masteryBrief: string // e.g. "strong in algebra, weak in geometry"
  emotionalState: 'NEUTRAL' | 'ENGAGED' | 'CONFUSED' | 'FRUSTRATED'

  // SESSION_STATE layer inputs
  stage: TutorStage
  stageAttemptCount: number
  hintsUsed: number
  sessionSummary: string | null // compressed summary of earlier turns
  recentTurns: Array<{ role: 'student' | 'ai'; content: string }> // last 8 turns
  activeMisconceptionName: string | null
  frustrationScore: number

  // CURRICULUM_CONTEXT layer inputs — RAG chunks, may be truncated
  ragChunks: string[] // ordered by relevance descending

  // Meta
  conceptName: string
  subjectName: string
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
    '2. Ask exactly one question per turn.',
    '3. Acknowledge partial credit explicitly before correcting.',
    '4. When a student says "I don\'t know", ask a simpler prerequisite question — do not give the answer.',
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
      `Exam proximity: exam is in ${ctx.examDateProximityDays} days — prioritise exam-focused practice and revision.`,
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
      'Tone guidance: student appears FRUSTRATED — be extra gentle, acknowledge effort, reduce difficulty slightly, and celebrate small wins.',
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
  const lines: string[] = [
    '### SESSION_STATE',
    `Current stage: ${ctx.stage}`,
    `Stage attempt count: ${ctx.stageAttemptCount}`,
    `Hints used this stage: ${ctx.hintsUsed}`,
    `Frustration score (0–1): ${ctx.frustrationScore.toFixed(2)}`,
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
    const curriculum = buildCurriculumContextLayer(ctx, workingRag)
    const responseFormat = buildResponseFormatLayer(ctx)

    const pieces = [persona, safety, rules, studentProfile, sessionState]
    const layersIncluded: string[] = ['PERSONA', 'SAFETY', 'PEDAGOGICAL_RULES', 'STUDENT_PROFILE', 'SESSION_STATE']

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

