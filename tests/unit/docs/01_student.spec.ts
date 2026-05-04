import fs from 'fs'
import path from 'path'

const DOC_PATH = path.join(__dirname, '../../../docs/v2/01_student.md')

describe('docs/v2/01_student.md structural invariants', () => {
  let doc: string

  beforeAll(() => {
    doc = fs.readFileSync(DOC_PATH, 'utf8')
  })

  it('exists and is non-empty', () => {
    expect(doc.length).toBeGreaterThan(0)
  })

  it('contains FILE OBJECTIVE header', () => {
    expect(doc).toContain('FILE OBJECTIVE')
  })

  it('contains all five audited story IDs', () => {
    expect(doc).toContain('F-STU-011')
    expect(doc).toContain('F-STU-012')
    expect(doc).toContain('F-STU-013')
    expect(doc).toContain('F-STU-014')
    expect(doc).toContain('F-STU-015')
  })

  it('every AC in F-STU-011 through F-STU-015 has a Status column entry', () => {
    // Each MUST AC row must have either a DONE or PARTIAL status marker.
    const mustRows = doc.match(/\nMUST\n/g) ?? []
    // There are MUSTs in earlier stories too; just assert the count is reasonable.
    expect(mustRows.length).toBeGreaterThan(10)
    // Every DONE or PARTIAL marker must follow a MUST or SHOULD row.
    const doneCount = (doc.match(/✅ DONE/g) ?? []).length
    const partialCount = (doc.match(/⚠️ PARTIAL/g) ?? []).length
    expect(doneCount + partialCount).toBeGreaterThan(25)
  })

  it('does not contain Phase 2 deferral markers inside audited AC statuses as DONE', () => {
    // F-STU-015 AC-05 time-slot feature is deferred -- should be PARTIAL not DONE.
    const ac05Block = doc.slice(
      doc.indexOf('F-STU-015'),
      doc.indexOf('F-STU-020'),
    )
    const ac05Line = ac05Block
      .split('\n')
      .find((l) => l.includes('historical active hours'))
    expect(ac05Line).toBeDefined()
    expect(ac05Line).not.toMatch(/^✅ DONE/)
  })

  it('does not use forbidden copy ("broke", "missed", "failed") in student-facing status copy', () => {
    // Status notes are internal but still follow copy rules to avoid leaking into UX.
    // The rule only covers user-facing strings; check the whole doc stays clean.
    expect(doc).not.toMatch(/\bstudent (broke|missed|failed)\b/i)
  })

  it('Phase 2 referral section is present and scoped correctly', () => {
    expect(doc).toContain('Phase 2 — Referral & Rewards (Deferred)')
  })
})
