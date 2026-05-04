import {
  assembleSystemPrompt,
  buildPersonaLayer,
  buildStageInstructionsLayer,
  type PromptContext,
} from '@/lib/ai/tutor/promptAssembly'

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
    isHintRequest: false,
    sessionSummary: 'Student recently revised algebra topics.',
    recentTurns: [
      { role: 'student', content: 'I am okay with algebra.' },
      { role: 'ai', content: 'Great, let us start geometry.' },
    ],
    activeMisconceptionName: null,
    activeMisconceptionCorrection: null,
    frustrationScore: 0.2,
    ragChunks: ['Chunk 1', 'Chunk 2'],
    conceptName: 'Similar Triangles',
    subjectName: 'Mathematics',
    ...overrides,
  }
}

describe('assembleSystemPrompt', () => {
  test('1. All 8 layers present in output when well within budget', () => {
    const res = assembleSystemPrompt(makeCtx())
    const s = res.system
    expect(s).toContain('### PERSONA')
    expect(s).toContain('### SAFETY')
    expect(s).toContain('### PEDAGOGICAL_RULES')
    expect(s).toContain('### STUDENT_PROFILE')
    expect(s).toContain('### SESSION_STATE')
    expect(s).toContain('### STAGE_INSTRUCTIONS')
    expect(s).toContain('### CURRICULUM_CONTEXT')
    expect(s).toContain('### RESPONSE_FORMAT')
    expect(res.layersIncluded).toEqual([
      'PERSONA',
      'SAFETY',
      'PEDAGOGICAL_RULES',
      'STUDENT_PROFILE',
      'SESSION_STATE',
      'STAGE_INSTRUCTIONS',
      'CURRICULUM_CONTEXT',
      'RESPONSE_FORMAT',
    ])
  })

  test('2. Layer order is PERSONA -> SAFETY -> PEDAGOGICAL_RULES -> STUDENT_PROFILE -> SESSION_STATE -> STAGE_INSTRUCTIONS -> CURRICULUM_CONTEXT -> RESPONSE_FORMAT', () => {
    const s = assembleSystemPrompt(makeCtx()).system
    const idx = (marker: string) => s.indexOf(marker)
    const order = [
      '### PERSONA',
      '### SAFETY',
      '### PEDAGOGICAL_RULES',
      '### STUDENT_PROFILE',
      '### SESSION_STATE',
      '### STAGE_INSTRUCTIONS',
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
      'STAGE_INSTRUCTIONS',
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

  test('13. STAGE_INSTRUCTIONS present for non-practice stage (CORE_EXPLANATION)', () => {
    const res = assembleSystemPrompt(makeCtx({ stage: 'CORE_EXPLANATION', isHintRequest: false }))
    const s = res.system
    expect(s).toContain('### STAGE_INSTRUCTIONS')
    expect(s).toContain('CORE_EXPLANATION')
    expect(res.layersIncluded).toContain('STAGE_INSTRUCTIONS')
  })
})

describe('buildStageInstructionsLayer -- hint tiers', () => {
  function makePracticeCtx(hintsUsed: number, isHintRequest: boolean, stage: PromptContext['stage'] = 'GUIDED_PRACTICE'): PromptContext {
    return {
      studentName: 'Priya',
      grade: 9,
      board: 'CBSE',
      teachingLanguage: 'en',
      examDateProximityDays: null,
      learningStyle: null,
      recentMisconceptions: [],
      masteryBrief: 'moderate',
      emotionalState: 'NEUTRAL',
      stage,
      stageAttemptCount: 0,
      hintsUsed,
      isHintRequest,
      sessionSummary: null,
      recentTurns: [],
      activeMisconceptionName: null,
      activeMisconceptionCorrection: null,
      frustrationScore: 0,
      ragChunks: [],
      conceptName: 'Quadratic Equations',
      subjectName: 'Mathematics',
    }
  }

  test('should output Tier 1 Directional Nudge when hintsUsed=0 and isHintRequest=true', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(0, true))
    expect(layer).toContain('Tier 1')
    expect(layer).toContain('Directional Nudge')
    expect(layer).toContain('[HINT_OFFER]')
    expect(layer).not.toContain('Tier 2')
    expect(layer).not.toContain('Tier 3')
  })

  test('should output Tier 2 Structural Hint when hintsUsed=1 and isHintRequest=true', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(1, true))
    expect(layer).toContain('Tier 2')
    expect(layer).toContain('Structural Hint')
    expect(layer).toContain('[HINT_OFFER]')
    expect(layer).not.toContain('Tier 1')
    expect(layer).not.toContain('Tier 3')
  })

  test('should output Tier 3 Worked Scaffold when hintsUsed=2 and isHintRequest=true', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(2, true))
    expect(layer).toContain('Tier 3')
    expect(layer).toContain('Worked Scaffold')
    expect(layer).toContain('[HINT_OFFER]')
    expect(layer).not.toContain('Tier 1')
    expect(layer).not.toContain('Tier 2')
  })

  test('should output full solution + isomorphic problem when hintsUsed=3 and isHintRequest=true', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(3, true))
    expect(layer).toContain('ALL HINTS EXHAUSTED')
    expect(layer).toContain('isomorphic')
    expect(layer).toContain('[QUESTION]')
    expect(layer).not.toContain('[HINT_OFFER]')
  })

  test('should NOT deliver hint instructions when isHintRequest=false even in practice stage', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(0, false))
    expect(layer).not.toContain('Tier 1')
    expect(layer).not.toContain('HINT REQUESTED')
    // Should show normal practice guidance instead
    expect(layer).toContain('GUIDED_PRACTICE')
  })

  test('should NOT show hint instructions for non-practice stages even when isHintRequest=true', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(0, true, 'CORE_EXPLANATION'))
    expect(layer).not.toContain('Tier 1')
    expect(layer).not.toContain('HINT REQUESTED')
    expect(layer).toContain('CORE_EXPLANATION')
  })

  test('should work for INDEPENDENT_PRACTICE stage hint request', () => {
    const layer = buildStageInstructionsLayer(makePracticeCtx(1, true, 'INDEPENDENT_PRACTICE'))
    expect(layer).toContain('Tier 2')
    expect(layer).toContain('[HINT_OFFER]')
  })

  test('should include STAGE_INSTRUCTIONS header in all cases', () => {
    for (const stage of ['HOOK', 'PREREQ_BRIDGE', 'CORE_EXPLANATION', 'WORKED_EXAMPLE', 'GUIDED_PRACTICE', 'INDEPENDENT_PRACTICE', 'CONSOLIDATION'] as PromptContext['stage'][]) {
      const layer = buildStageInstructionsLayer(makePracticeCtx(0, false, stage))
      expect(layer).toContain('### STAGE_INSTRUCTIONS')
    }
  })

  // AC-04 (F-STU-011): re-explain style directives
  test('should inject Simpler directive when explainStyle is simpler', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', explainStyle: 'simpler' })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('RE-EXPLAIN REQUEST -- Simpler')
    expect(layer).toContain('Shorter sentences')
  })

  test('should inject Harder directive when explainStyle is harder', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', explainStyle: 'harder' })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('RE-EXPLAIN REQUEST -- Harder/Deeper')
    expect(layer).toContain('underlying mechanism')
  })

  test('should inject real-life example directive when explainStyle is real_life_example', () => {
    const ctx = makeCtx({ stage: 'WORKED_EXAMPLE', explainStyle: 'real_life_example' })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('RE-EXPLAIN REQUEST -- Real-life example')
    expect(layer).toContain('Indian daily life')
  })

  test('should not inject re-explain directive when explainStyle is null', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', explainStyle: null })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('RE-EXPLAIN REQUEST')
  })

  test('should not inject re-explain directive when explainStyle is undefined', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION' })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('RE-EXPLAIN REQUEST')
  })

  // AC-08 (F-STU-011): wrong-answer threshold warning in practice stages
  test('should show PREREQ_FAIL warning when consecutiveWrongAnswers >= 2 in practice stage', () => {
    const ctx = makeCtx({ stage: 'GUIDED_PRACTICE', consecutiveWrongAnswers: 2, hintsUsed: 0, isHintRequest: false })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('PREREQ_FAIL')
    expect(layer).toContain('multiple wrong answers')
  })

  test('should NOT show PREREQ_FAIL warning when consecutiveWrongAnswers < 2 in practice stage', () => {
    const ctx = makeCtx({ stage: 'GUIDED_PRACTICE', consecutiveWrongAnswers: 1, hintsUsed: 0, isHintRequest: false })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('[STRUGGLE_DETECTED]')
    expect(layer).not.toContain('multiple wrong answers')
  })

  test('should include consecutiveWrongAnswers in SESSION_STATE layer', () => {
    const ctx = makeCtx({ consecutiveWrongAnswers: 2 })
    const result = assembleSystemPrompt(ctx)
    expect(result.system).toContain('Consecutive wrong answers: 2')
  })

  // AC-03 (F-STU-013): contrastive explanation
  test('should inject MISCONCEPTION DETECTED contrastive block when both name and correction are set', () => {
    const ctx = makeCtx({
      stage: 'GUIDED_PRACTICE',
      activeMisconceptionName: 'Quadratic has only one root',
      activeMisconceptionCorrection: 'There are two roots: positive and negative.',
    })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('MISCONCEPTION DETECTED -- Contrastive Explanation Required')
    expect(layer).toContain('Quadratic has only one root')
    expect(layer).toContain('There are two roots: positive and negative.')
    expect(layer).toContain('counterexample')
    expect(layer).toContain('correct model')
  })

  test('should inject a softer MISCONCEPTION DETECTED block when name is set but correction is null', () => {
    const ctx = makeCtx({
      stage: 'CORE_EXPLANATION',
      activeMisconceptionName: 'Quadratic has only one root',
      activeMisconceptionCorrection: null,
    })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('MISCONCEPTION DETECTED')
    expect(layer).toContain('Quadratic has only one root')
    expect(layer).not.toContain('Contrastive Explanation Required')
  })

  test('should NOT inject misconception block when activeMisconceptionName is null', () => {
    const ctx = makeCtx({
      activeMisconceptionName: null,
      activeMisconceptionCorrection: null,
    })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('MISCONCEPTION DETECTED')
  })

  test('contrastive block appears before hint tier instructions in layer output', () => {
    const ctx = makeCtx({
      stage: 'GUIDED_PRACTICE',
      isHintRequest: true,
      hintsUsed: 0,
      activeMisconceptionName: 'Binomial square misconception',
      activeMisconceptionCorrection: 'The correct expansion includes 2ab.',
    })
    const layer = buildStageInstructionsLayer(ctx)
    const misconceptionIdx = layer.indexOf('MISCONCEPTION DETECTED')
    const hintIdx = layer.indexOf('HINT REQUESTED')
    expect(misconceptionIdx).toBeGreaterThanOrEqual(0)
    expect(hintIdx).toBeGreaterThanOrEqual(0)
    expect(misconceptionIdx).toBeLessThan(hintIdx)
  })
})

// AC-07 (F-STU-011 SHOULD): board chapter weight citation in stage instructions
describe('buildStageInstructionsLayer -- board chapter weight (AC-07)', () => {
  test('should inject board exam mapping sentence in CORE_EXPLANATION when boardChapterWeightMarks is a number', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', boardChapterWeightMarks: 15 })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('Board exam mapping')
    expect(layer).toContain('15 marks')
  })

  test('should include grade and board in CORE_EXPLANATION board mapping example', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', grade: 10, board: 'CBSE', boardChapterWeightMarks: 12 })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('CBSE')
    expect(layer).toContain('Class 10')
    expect(layer).toContain('12 marks')
  })

  test('should inject board exam preface with marks count in WORKED_EXAMPLE when boardChapterWeightMarks is a number', () => {
    const ctx = makeCtx({ stage: 'WORKED_EXAMPLE', grade: 10, board: 'CBSE', boardChapterWeightMarks: 10 })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('board exam preface')
    expect(layer).toContain('10 marks')
    expect(layer).toContain('CBSE')
    expect(layer).toContain('Class 10')
  })

  test('should inject board exam reminder with marks count in CONSOLIDATION when boardChapterWeightMarks is a number', () => {
    const ctx = makeCtx({ stage: 'CONSOLIDATION', grade: 10, board: 'CBSE', boardChapterWeightMarks: 8 })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).toContain('Board exam reminder')
    expect(layer).toContain('8 marks')
    expect(layer).toContain('CBSE')
    expect(layer).toContain('Class 10')
  })

  test('should NOT inject board mapping in CORE_EXPLANATION when boardChapterWeightMarks is null', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', boardChapterWeightMarks: null })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('Board exam mapping')
  })

  test('should NOT inject board mapping in CORE_EXPLANATION when boardChapterWeightMarks is undefined', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION' })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('Board exam mapping')
  })

  test('should NOT inject board exam preface in WORKED_EXAMPLE when boardChapterWeightMarks is null', () => {
    const ctx = makeCtx({ stage: 'WORKED_EXAMPLE', boardChapterWeightMarks: null })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('board exam preface')
  })

  test('should NOT inject board exam reminder in CONSOLIDATION when boardChapterWeightMarks is null', () => {
    const ctx = makeCtx({ stage: 'CONSOLIDATION', boardChapterWeightMarks: null })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('Board exam reminder')
  })

  test('should NOT inject board mapping in HOOK stage even when boardChapterWeightMarks is set', () => {
    const ctx = makeCtx({ stage: 'HOOK', boardChapterWeightMarks: 10 })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('Board exam mapping')
    expect(layer).not.toContain('board marks weightage')
  })

  test('should NOT inject board mapping in GUIDED_PRACTICE even when boardChapterWeightMarks is set', () => {
    const ctx = makeCtx({ stage: 'GUIDED_PRACTICE', boardChapterWeightMarks: 10, hintsUsed: 0, isHintRequest: false })
    const layer = buildStageInstructionsLayer(ctx)
    expect(layer).not.toContain('Board exam mapping')
  })

  test('board weight marks propagate into assembled system prompt for CORE_EXPLANATION', () => {
    const ctx = makeCtx({ stage: 'CORE_EXPLANATION', boardChapterWeightMarks: 20 })
    const result = assembleSystemPrompt(ctx)
    expect(result.system).toContain('20 marks')
    expect(result.system).toContain('Board exam mapping')
  })

  test('board weight marks propagate into assembled system prompt for CONSOLIDATION', () => {
    const ctx = makeCtx({ stage: 'CONSOLIDATION', boardChapterWeightMarks: 6 })
    const result = assembleSystemPrompt(ctx)
    expect(result.system).toContain('Board exam reminder')
    expect(result.system).toContain('6 marks')
  })
})

// AC-10 (F-STU-011 SHOULD): grade-band tone calibration in PERSONA layer
describe('buildPersonaLayer -- grade-band tone calibration (AC-10)', () => {
  test('should emit elder-sibling tone note for grade 6', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 6 }))
    expect(layer).toContain('Tone calibration (Grade 6-8)')
    expect(layer).toContain('elder sibling')
  })

  test('should emit elder-sibling tone note for grade 7', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 7 }))
    expect(layer).toContain('Tone calibration (Grade 6-8)')
    expect(layer).toContain('elder sibling')
  })

  test('should emit elder-sibling tone note for grade 8', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 8 }))
    expect(layer).toContain('Tone calibration (Grade 6-8)')
    expect(layer).toContain('elder sibling')
  })

  test('should emit peer-collaborator tone note for grade 9', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 9 }))
    expect(layer).toContain('Tone calibration (Grade 9-10)')
    expect(layer).toContain('peer collaborator')
    expect(layer).not.toContain('elder sibling')
  })

  test('should emit peer-collaborator tone note for grade 10', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 10 }))
    expect(layer).toContain('Tone calibration (Grade 9-10)')
    expect(layer).toContain('peer collaborator')
    expect(layer).not.toContain('elder sibling')
  })

  test('should emit focused-mentor tone note for grade 11', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 11 }))
    expect(layer).toContain('Tone calibration (Grade 11-12)')
    expect(layer).toContain('focused mentor')
    expect(layer).not.toContain('peer collaborator')
  })

  test('should emit focused-mentor tone note for grade 12', () => {
    const layer = buildPersonaLayer(makeCtx({ grade: 12 }))
    expect(layer).toContain('Tone calibration (Grade 11-12)')
    expect(layer).toContain('focused mentor')
  })

  test('tone note is present in assembled system prompt PERSONA section for all grade bands', () => {
    for (const { grade, expected } of [
      { grade: 7,  expected: 'elder sibling' },
      { grade: 10, expected: 'peer collaborator' },
      { grade: 12, expected: 'focused mentor' },
    ]) {
      const result = assembleSystemPrompt(makeCtx({ grade }))
      const personaEnd = result.system.indexOf('### SAFETY')
      const personaSection = result.system.slice(0, personaEnd)
      expect(personaSection).toContain(expected)
    }
  })

  test('tone note does not bleed into SAFETY or later layers', () => {
    const result = assembleSystemPrompt(makeCtx({ grade: 7 }))
    const safetyIdx = result.system.indexOf('### SAFETY')
    const safetyOnward = result.system.slice(safetyIdx)
    expect(safetyOnward).not.toContain('Tone calibration')
  })
})

