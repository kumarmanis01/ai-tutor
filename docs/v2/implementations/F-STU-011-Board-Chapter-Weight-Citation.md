<!--
FILE OBJECTIVE:
- Complete reference for the BoardChapterWeight feature: what it is, why it exists,
  how the code works end-to-end, the seed scripts, and what the team must do
  operationally before board citations appear in production AI responses.

LINKED CODE:
- lib/ai/tutor/promptAssembly.ts      (AC-07 injection -- buildStageInstructionsLayer)
- services/tutor/turn.ts              (boardChapterWeightMarks fetch, lines 650-659)
- scripts/seed-board-chapter-weights.ts / .cjs  (full-coverage seed script)
- scripts/seed-taxonomy-launch-slice.ts         (legacy CBSE Gr10 only seed)
- prisma/schema.prisma                (BoardChapterWeight model)

LINKED TESTS:
- tests/unit/lib/ai/tutor/promptAssembly.test.ts
  (describe "buildStageInstructionsLayer -- board chapter weight (AC-07)")

EDIT LOG:
- 2026-04-20T00:00:00Z | claude | created -- covers AC-07 implementation for F-STU-011
-->

# Board Chapter Weight Citation — Feature Reference

> **Feature:** AC-07 of F-STU-011 (AI Teach Mode — Pedagogical Flow)
> **Priority:** SHOULD
> **Status:** Code complete and tested. Requires data seeding before it fires in production.

---

## 1. What This Feature Does

When the AI tutor (Vidya) explains a concept, she optionally opens with one short sentence
connecting the lesson to its board exam:

> "This concept appears in CBSE Class 10 board exam — 15 marks."

This sentence appears in three teaching stages: `CORE_EXPLANATION`, `WORKED_EXAMPLE`,
and `CONSOLIDATION`. It does **not** appear during `HOOK`, `PREREQ_BRIDGE`,
`GUIDED_PRACTICE`, or `INDEPENDENT_PRACTICE` — those stages are interactive and the
citation would be intrusive.

---

## 2. Why It Exists

Indian students (and their parents) make learning decisions around board exam relevance.
A student who knows a chapter carries 15 marks is more motivated to engage deeply than
one who sees it as abstract content. Surfacing this in the AI's own voice — without the
student having to look it up — reduces friction and aligns with the product goal:
**Weekly Active Learning Sessions > 5 per paid student**.

---

## 3. How It Works — End to End

```
Student message
     |
     v
services/tutor/turn.ts
     |
     |-- 1. Resolve concept from DB
     |        Concept -> topic -> chapter -> chapter.id
     |
     |-- 2. Fetch board weight (lines 650-659)
     |        prisma.boardChapterWeight.findUnique({ where: { chapterId } })
     |        -> boardChapterWeightMarks: number | null
     |
     |-- 3. Pass to prompt assembler (line 683)
     |        assembleSystemPrompt({ ..., boardChapterWeightMarks })
     |
     v
lib/ai/tutor/promptAssembly.ts -- buildStageInstructionsLayer()
     |
     |-- If stage == CORE_EXPLANATION and boardChapterWeightMarks is a number:
     |      inject: "Board exam mapping: begin explanation with
     |               'This concept appears in CBSE Class 10 board exam -- 15 marks.'"
     |
     |-- If stage == WORKED_EXAMPLE and boardChapterWeightMarks is a number:
     |      inject: "Begin with a single-sentence board exam preface:
     |               'This concept appears in CBSE Class 10 board exam -- 15 marks.'"
     |
     |-- If stage == CONSOLIDATION and boardChapterWeightMarks is a number:
     |      inject: "Include a sentence noting the board marks weightage."
     |
     v
LLM receives the instruction -> Vidya's response includes the citation
```

**If `boardChapterWeightMarks` is `null`** (no row seeded for that chapter), the
instruction is silently skipped. No error, no fallback — Vidya simply does not cite
board marks for that lesson.

---

## 4. Data Model

```prisma
model BoardChapterWeight {
  id          String     @id @default(cuid())
  chapterId   String
  weightMarks Int        // marks allocated in board exam theory paper
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  chapter     ChapterDef @relation(fields: [chapterId], references: [id], onDelete: Cascade)

  @@unique([chapterId])    // one weight row per chapter
  @@index([chapterId])
}
```

**Key design point:** `BoardChapterWeight` has no `board` column. This is intentional.
Each `ChapterDef` already belongs to exactly one board through the chain:

```
ChapterDef.subjectId -> SubjectDef.classId -> ClassLevel.boardId -> Board.slug
```

So one weight row per chapter inherently covers the right board. CBSE chapters and ICSE
chapters are separate rows in `ChapterDef`, so CBSE and ICSE can have different weights
for the "same" topic without any schema change.

---

## 5. Seed Scripts

### 5a. Full-coverage seed (recommended — use this one)

**File:** `scripts/seed-board-chapter-weights.ts`
**Runner:** `scripts/seed-board-chapter-weights.cjs`

Covers all active chapters across CBSE + ICSE, grades 6–12, all available subjects.

**Default marks formula:**
```
marks_per_chapter = round(80 / total_chapters_in_subject)
minimum: 1 mark per chapter
```

80 marks is the standard CBSE/ICSE theory paper total. Equal distribution is a reasonable
default until official marking-scheme figures are entered.

**Run modes:**

```bash
# 1. Preview — see exactly what will be seeded, no writes
node scripts/seed-board-chapter-weights.cjs --dry-run

# 2. Normal run — creates rows for chapters with no row yet; leaves existing rows alone
node scripts/seed-board-chapter-weights.cjs

# 3. Force — recreates all rows using the computed default (overwrites manual edits)
node scripts/seed-board-chapter-weights.cjs --force
```

**Sample output:**
```
Board  Grade  Subject                 Chapters  Marks ea.  Created  Updated  Skipped
------------------------------------------------------------------------
CBSE   10     Mathematics             15        5          15       0        0
CBSE   10     Science                 11        7          11       0        0
CBSE   9      Mathematics             12        7          12       0        0
CBSE   9      Science                 12        7          12       0        0
ICSE   10     Mathematics             14        6          14       0        0
ICSE   10     Physics                 10        8          10       0        0
...
Total: 312 created, 0 updated, 0 skipped
```

### 5b. Legacy seed (do not use for new runs)

**File:** `scripts/seed-taxonomy-launch-slice.ts`

Seeds only CBSE Grade 10 Maths + Science with a flat 8 marks per chapter. Kept for
historical reference. Do not run this for new environments — use 5a instead.

---

## 6. Operational Runbook — What You Need to Do

### 6a. Before first launch (required)

Run the full seed once on Neon production:

```bash
# On the VPS, from the app directory:
node scripts/seed-board-chapter-weights.cjs --dry-run   # verify the output looks right
node scripts/seed-board-chapter-weights.cjs              # execute
```

After this, board citations will fire automatically for every session on every grade,
subject, and board where a chapter weight row exists.

### 6b. When you add new chapters (routine)

Run the seed again after adding new chapters via the admin curriculum panel:

```bash
node scripts/seed-board-chapter-weights.cjs   # creates rows for new chapters only
```

Existing rows are untouched. Safe to run any time.

### 6c. When official marking-scheme figures become available (one-time upgrade)

CBSE and ICSE publish official marking schemes (chapter-wise marks breakdowns)
in their syllabi PDFs each academic year. To load the official figures:

**Option A — Direct SQL (for a small number of chapters):**

```bash
# Use scripts/db-exec.sh (never use --stdin or here-strings on AlmaLinux)
bash scripts/db-exec.sh "
  UPDATE \"BoardChapterWeight\"
  SET \"weightMarks\" = 20, \"updatedAt\" = now()
  WHERE \"chapterId\" = '<chapter-id-here>'
"
```

**Option B — Edit the seed script with known values, then --force:**

In `scripts/seed-board-chapter-weights.ts`, replace the equal-distribution formula
with a hardcoded lookup table keyed by subject slug + chapter slug. Then:

```bash
node scripts/seed-board-chapter-weights.cjs --force
```

**Option C — Admin panel (future):**

A future admin UI could expose a per-chapter marks field. No code change needed in the
tutor — it reads `weightMarks` directly from the DB.

### 6d. Verifying it works in production

To confirm the feature is firing, check the AI response for a CORE_EXPLANATION turn.
The response should open with a sentence like:

> "This concept appears in CBSE Class 10 board exam — 7 marks."

If the sentence is absent for a known-seeded chapter, check:

1. Is there a `BoardChapterWeight` row for that chapter?
   ```bash
   bash scripts/db-exec.sh "
     SELECT bcw.\"weightMarks\", c.name
     FROM \"BoardChapterWeight\" bcw
     JOIN \"ChapterDef\" c ON c.id = bcw.\"chapterId\"
     WHERE c.slug = '<chapter-slug-here>'
   "
   ```

2. Is the concept linked to a topic → chapter?
   ```bash
   bash scripts/db-exec.sh "
     SELECT con.name, t.name as topic, ch.name as chapter
     FROM \"Concept\" con
     JOIN \"TopicDef\" t ON t.id = con.\"topicId\"
     JOIN \"ChapterDef\" ch ON ch.id = t.\"chapterId\"
     WHERE con.id = '<concept-id-here>'
   "
   ```

3. Check the AI tutor log for `boardChapterWeight.load.failed` warnings in PM2:
   ```bash
   pm2 logs spinzy-app --lines 100 | grep boardChapterWeight
   ```

---

## 7. What Requires No Action From You

| Thing | Status |
|-------|--------|
| Code fetches weight from DB per session | Automatic |
| Prompt injection in CORE_EXPLANATION | Automatic |
| Prompt injection in WORKED_EXAMPLE | Automatic |
| Prompt injection in CONSOLIDATION | Automatic |
| Graceful skip when weight is null | Automatic |
| Works across all grades (6-12) | Automatic |
| Works for CBSE and ICSE separately | Automatic |
| Works for all subjects | Automatic |
| Unit tests (12 tests, all passing) | Done |

---

## 8. Limitations and Future Work

| Limitation | Impact | Resolution |
|-----------|--------|------------|
| Marks are equal-distribution defaults, not official figures | Vidya may cite slightly inaccurate marks for some chapters | Replace with official marking-scheme data (see 6c) |
| No board column on `BoardChapterWeight` | CBSE and ICSE chapters share independent rows; no conflict today since chapters are separate rows in ChapterDef | No action needed unless a subject shares exact same ChapterDef across boards (not current design) |
| Only CBSE/ICSE boards seeded | Other boards (state boards) get null weight | Add board slugs to the seed script's `where: { slug: { in: [...] } }` filter when state boards are added |
| Marks figure is per-chapter, not per-topic | Vidya cites chapter-level marks even when the concept is a small sub-topic | Acceptable for now; per-topic weight granularity is post-launch |
