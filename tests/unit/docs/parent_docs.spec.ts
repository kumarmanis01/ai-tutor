/**
 * FILE OBJECTIVE:
 * - Validate structural invariants and AC-audit status coverage for docs/v2/02_parent.md.
 *
 * LINKED UNIT TEST:
 * - tests/unit/docs/parent_docs.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | created parent doc audit invariants test
 */

import fs from 'fs'
import path from 'path'

const DOC_PATH = path.join(__dirname, '../../../docs/v2/02_parent.md')

describe('docs/v2/02_parent.md AC audit status invariants', () => {
  let doc: string

  beforeAll(() => {
    doc = fs.readFileSync(DOC_PATH, 'utf8')
  })

  it('exists and is non-empty', () => {
    expect(doc.length).toBeGreaterThan(0)
  })

  it('contains file objective header and edit log', () => {
    expect(doc).toContain('FILE OBJECTIVE')
    expect(doc).toContain('EDIT LOG')
  })

  it('contains AC audit section and status legend', () => {
    expect(doc).toContain('8. AC Audit Status (Codebase Audit — 2026-05-04)')
    expect(doc).toContain('Status legend:')
    expect(doc).toContain('Done:')
    expect(doc).toContain('Partial:')
    expect(doc).toContain('Pending:')
  })

  it('includes all parent MVP story IDs in the audit section', () => {
    const requiredStories = [
      'F-PAR-001',
      'F-PAR-002',
      'F-PAR-003',
      'F-PAR-010',
      'F-PAR-011',
      'F-PAR-012',
      'F-PAR-020',
      'F-PAR-021',
      'F-PAR-022',
      'F-PAR-023',
      'F-PAR-024',
      'F-PAR-030',
      'F-PAR-031',
      'F-PAR-032',
    ]

    for (const storyId of requiredStories) {
      expect(doc).toContain(storyId)
    }
  })

  it('has substantial AC status coverage markers', () => {
    const doneCount = (doc.match(/: Done/g) ?? []).length
    const partialCount = (doc.match(/: Partial/g) ?? []).length
    const pendingCount = (doc.match(/: Pending/g) ?? []).length

    expect(doneCount).toBeGreaterThan(20)
    expect(partialCount).toBeGreaterThan(10)
    expect(pendingCount).toBeGreaterThan(10)
  })

  it('contains phase-2 parent feature status snapshot', () => {
    expect(doc).toContain('6. Phase 2 Parent Features (Scoped, Not Built at MVP)')
    expect(doc).toContain('F-PAR-P2-001')
    expect(doc).toContain('F-PAR-P2-007')
  })
})
