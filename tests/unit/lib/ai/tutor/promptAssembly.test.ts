import { assembleSystemPrompt, type PromptContext } from '@/lib/ai/tutor/promptAssembly'

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    studentName: 'Aarav',
    grade: 10,
    board: 'CBSE',
    teachingLanguage: 'en',
    examDateProximityDays: 30,
    learningStyle: 'visual',
    recentMisconceptions: ['Quadratic roots', 'Circle theorems'],
    masteryBrief: 'strong in algebra, weak in geometry',
    emotionalState: 'NEUTRAL',
    stage: 'CORE_EXPLANATION',
    stageAttemptCount: 1,
    hintsUsed: 0,
    sessionSummary: 'Student recently revised algebra topics.',
    recentTurns: [
      { role: 'student', content: 'I am okay with algebra.' },
      { role: 'ai', content: 'Great, let us start geometry.' },
    ],
    activeMisconceptionName: null,
    frustrationScore: 0.2,
    ragChunks: ['Chunk 1', 'Chunk 2'],
    conceptName: 'Similar Triangles',
    subjectName: 'Mathematics',
    ...overrides,
  }
}

describe('assembleSystemPrompt', () => {
  test('1. All 7 layers present in output when well within budget', () => {
    const res = assembleSystemPrompt(makeCtx())
    const s = res.system
    expect(s).toContain('### PERSONA')
    expect(s).toContain('### SAFETY')
    expect(s).toContain('### PEDAGOGICAL_RULES')
    expect(s).toContain('### STUDENT_PROFILE')
    expect(s).toContain('### SESSION_STATE')
    expect(s).toContain('### CURRICULUM_CONTEXT')
    expect(s).toContain('### RESPONSE_FORMAT')
    expect(res.layersIncluded).toEqual([
      'PERSONA',
      'SAFETY',
      'PEDAGOGICAL_RULES',
      'STUDENT_PROFILE',
      'SESSION_STATE',
      'CURRICULUM_CONTEXT',
      'RESPONSE_FORMAT',
    ])
  })

  test('2. Layer order is PERSONA -> SAFETY -> PEDAGOGICAL_RULES -> STUDENT_PROFILE -> SESSION_STATE -> CURRICULUM_CONTEXT -> RESPONSE_FORMAT', () => {
    const s = assembleSystemPrompt(makeCtx()).system
    const idx = (marker: string) => s.indexOf(marker)
    const order = [
      '### PERSONA',
      '### SAFETY',
      '### PEDAGOGICAL_RULES',
      '### STUDENT_PROFILE',
      '### SESSION_STATE',
      '### CURRICULUM_CONTEXT',
      '### RESPONSE_FORMAT',
    ]
    for (let i = 0; i < order.length - 1; i++) {
      expect(idx(order[i])).toBeGreaterThanOrEqual(0)
      expect(idx(order[i])).toBeLessThan(idx(order[i + 1]))
    }
  })

  test('3. PEDAGOGICAL_RULES contains Rule 1 verbatim', () => {
    const res = assembleSystemPrompt(makeCtx())
    expect(res.system).toContain(
      '1. Never give a direct answer to a practice or test problem. Guide with questions, hints, or worked examples only.',
    )
  })

  test('4. RAG chunks dropped when over budget — CURRICULUM_CONTEXT text absent but layers 1–3 still present', () => {
    const hugeChunk = 'X'.repeat(50_000)
    const ctx = makeCtx({ ragChunks: [hugeChunk, hugeChunk, hugeChunk] })
    const res = assembleSystemPrompt(ctx)
    expect(res.system).toContain('### PERSONA')
    expect(res.system).toContain('### SAFETY')
    expect(res.system).toContain('### PEDAGOGICAL_RULES')
    // CURRICULUM_CONTEXT header should be absent when all chunks dropped
    expect(res.system).not.toContain('### CURRICULUM_CONTEXT')
    expect(res.layersTruncated).toContain('CURRICULUM_CONTEXT')
  })

  test('5. recentTurns trimmed when RAG fully dropped and still over budget — oldest turns gone, newest 2 kept', () => {
    const bigTurn = 'Y'.repeat(120_000)
    const recentTurns = [
      { role: 'student' as const, content: bigTurn },
      { role: 'ai' as const, content: bigTurn },
      { role: 'student' as const, content: 'keep1' },
      { role: 'ai' as const, content: 'keep2' },
    ]
    const ctx = makeCtx({ ragChunks: [], recentTurns, sessionSummary: bigTurn })
    const res = assembleSystemPrompt(ctx)
    const s = res.system
    expect(s).not.toContain(bigTurn)
    expect(s).toContain('keep1')
    expect(s).toContain('keep2')
    expect(res.layersTruncated).toContain('SESSION_STATE')
  })

  test('6. PERSONA, SAFETY, PEDAGOGICAL_RULES always present at full length regardless of budget pressure', () => {
    const huge = 'Z'.repeat(80_000)
    const ctx = makeCtx({
      ragChunks: [huge, huge],
      sessionSummary: huge,
      recentTurns: [
        { role: 'student', content: huge },
        { role: 'ai', content: huge },
      ],
    })
    const res = assembleSystemPrompt(ctx)
    const s = res.system
    expect(s).toContain('### PERSONA')
    expect(s).toContain('### SAFETY')
    expect(s).toContain('### PEDAGOGICAL_RULES')
    expect(s).toContain(
      '1. Never give a direct answer to a practice or test problem. Guide with questions, hints, or worked examples only.',
    )
  })

  test('7. layersTruncated populated correctly when truncation occurs', () => {
    const huge = 'W'.repeat(50_000)
    const ctx = makeCtx({
      ragChunks: [huge, huge],
      recentTurns: [
        { role: 'student', content: huge },
        { role: 'ai', content: huge },
      ],
    })
    const res = assembleSystemPrompt(ctx)
    expect(res.layersTruncated.length).toBeGreaterThan(0)
    expect(res.layersTruncated).toEqual(expect.arrayContaining(['CURRICULUM_CONTEXT', 'SESSION_STATE']))
  })

  test('8. estimatedTokens is a positive integer', () => {
    const res = assembleSystemPrompt(makeCtx())
    expect(Number.isInteger(res.estimatedTokens)).toBe(true)
    expect(res.estimatedTokens).toBeGreaterThan(0)
  })

  test('9. Empty ragChunks → no CURRICULUM_CONTEXT section but no crash', () => {
    const res = assembleSystemPrompt(makeCtx({ ragChunks: [] }))
    expect(res.system).not.toContain('### CURRICULUM_CONTEXT')
    expect(res.layersIncluded).toEqual([
      'PERSONA',
      'SAFETY',
      'PEDAGOGICAL_RULES',
      'STUDENT_PROFILE',
      'SESSION_STATE',
      'RESPONSE_FORMAT',
    ])
  })

  test('10. emotionalState FRUSTRATED → tone note present in STUDENT_PROFILE layer', () => {
    const res = assembleSystemPrompt(makeCtx({ emotionalState: 'FRUSTRATED' }))
    const s = res.system
    const profileIdx = s.indexOf('### STUDENT_PROFILE')
    const sessionIdx = s.indexOf('### SESSION_STATE')
    const profileSection = s.slice(profileIdx, sessionIdx)
    expect(profileSection).toMatch(/student appears FRUSTRATED/i)
  })

  test('11. activeMisconception present → appears in SESSION_STATE layer', () => {
    const res = assembleSystemPrompt(makeCtx({ activeMisconceptionName: 'Sign error in quadratic formula' }))
    const s = res.system
    const sessionIdx = s.indexOf('### SESSION_STATE')
    const ctxIdx = s.indexOf('### CURRICULUM_CONTEXT')
    const sessionSection = s.slice(sessionIdx, ctxIdx > 0 ? ctxIdx : undefined)
    expect(sessionSection).toContain('Sign error in quadratic formula')
  })

  test('12. examDateProximityDays < 14 → urgency note in STUDENT_PROFILE', () => {
    const res = assembleSystemPrompt(makeCtx({ examDateProximityDays: 10 }))
    const s = res.system
    const profileIdx = s.indexOf('### STUDENT_PROFILE')
    const sessionIdx = s.indexOf('### SESSION_STATE')
    const profileSection = s.slice(profileIdx, sessionIdx)
    expect(profileSection).toMatch(/exam is in 10 days/i)
    expect(profileSection).toMatch(/prioritise exam-focused practice/i)
  })
})

