/**
 * COPILOT:
 * This seed script defines ONLY academic taxonomy.
 * Do NOT add chapters, topics, notes, AI calls, or workers here.
 * This file is deterministic and must remain idempotent.
 */

/**
 * SEED SCRIPT GUARDRAILS:
 * - Script MUST be idempotent
 * - Never use create() without checking existence
 * - Always use upsert with compound unique keys
 * - Seed scripts must be safe to rerun after crashes
 * - Never overwrite existing academic data
 * - Uses unique constraints, not IDs
 * - Never overwrites approved / edited content
 * - Safe after crashes / partial runs
 */


/**
 * CBSE Subjects by Class (1-12)
 * 
 * Class 1-2:
 *   - English
 *   - Hindi
 *   - Mathematics
 *   - Environmental Studies
 *   - Art Education
 *   - Health & Physical Education
 *   - Computer Science
 * 
 * Class 3-5:
 *   - English
 *   - Hindi
 *   - Mathematics
 *   - Environmental Studies
 *   - General Knowledge
 *   - Art Education
 *   - Health & Physical Education
 *   - Computer Science
 * 
 * Class 6-8:
 *   - English
 *   - Hindi
 *   - Mathematics
 *   - Science
 *   - Social Science
 *   - Sanskrit / Urdu / Other Language (optional)
 *   - Computer Science / IT (optional)
 *   - Art Education
 *   - Health & Physical Education
 *   - Skill Modules (AI, Design Thinking, Financial Literacy, Coding, etc.) (optional)
 * 
 * Class 9-10:
 *   - English
 *   - Hindi / Language 2
 *   - Mathematics
 *   - Science (Physics, Chemistry, Biology)
 *   - Social Science (History, Geography, Political Science, Economics)
 *   - Computer Applications (optional)
 *   - Art Education
 *   - Physical Education
 *   - Skill-based Electives (AI, Data Science, IT, Retail, etc.) (optional)
 *   - Language 3 (optional)
 * 
 * Class 11-12 (Streams):
 *   - Common: English
 *   - Science Stream:
 *       - Physics
 *       - Chemistry
 *       - Mathematics / Biology
 *       - Computer Science / Biotechnology / Engineering Drawing (optional)
 *   - Commerce Stream:
 *       - Accountancy
 *       - Business Studies
 *       - Economics
 *   - Humanities/Arts Stream:
 *       - Political Science
 *       - History
 *       - Geography
 *       - Psychology
 *       - Sociology
 *       - Philosophy
 *       - Fine Arts
 *       - Music
 *   - Others (available as electives in any stream):
 *       - Physical Education
 *       - Home Science
 *       - Informatics Practices
 *       - Additional Languages
 */


/**
 * ICSE Subjects by Class (1-12)
 *
 * Class 1-4:
 *   - English
 *   - Second Language (Hindi or regional)
 *   - Mathematics
 *   - Environmental Studies (EVS) / Science
 *   - Social Studies (History, Civics, Geography)
 *   - Computer Applications
 *   - Art & Music
 *   - Physical Education
 *
 * Class 5-7:
 *   - English
 *   - Second Language (Hindi or regional)
 *   - Mathematics
 *   - Science (often integrated or split into Physics, Chemistry, Biology)
 *   - Social Studies (History, Civics, Geography)
 *   - Computer Applications / Computer Science
 *   - Arts Education / Health
 *
 * Class 8:
 *   - English
 *   - Second Language (Hindi or regional)
 *   - Mathematics
 *   - Science (Physics, Chemistry, Biology)
 *   - Social Studies (History, Civics, Geography)
 *   - Computer Applications
 *   - Environmental Science
 *   - Art / Moral Science / General Knowledge
 *
 * Class 9-10:
 *   Group I (Compulsory):
 *     - English
 *     - Second Language (Indian or Foreign)
 *     - History, Civics & Geography
 *     - Mathematics
 *     - Science (Physics, Chemistry, Biology)
 *   Group II (Choose Any Two):
 *     - Economics
 *     - Commercial Studies
 *     - Computer Applications
 *     - Environmental Science
 *     - Modern Foreign Languages
 *     - Classical Languages
 *   Group III (Choose Any One):
 *     - Computer Applications
 *     - Commercial Applications
 *     - Economic Applications
 *     - Art
 *     - Home Science
 *     - Yoga
 *     - Physical Education
 *     - Technical Drawing Applications
 *
 * Class 11-12 (ISC Streams):
 *   Core & Compulsory:
 *     - English
 *     - Hindi or another Indian/Foreign Language
 *   Science Stream:
 *     - Physics
 *     - Chemistry
 *     - Mathematics
 *     - Biology
 *     - Computer Science
 *     - Physical Education
 *     - Biotechnology
 *     - Environmental Science
 *   Commerce Stream:
 *     - Accountancy
 *     - Economics
 *     - Business Studies
 *     - Mathematics
 *     - Computer Science
 *     - Physical Education
 *     - Entrepreneurship
 *   Arts/Humanities Stream:
 *     - History
 *     - Political Science
 *     - Geography
 *     - Sociology
 *     - Psychology
 *     - Sanskrit
 *     - Fine Arts
 *     - Music
 *     - Legal Studies
 *     - Mass Media
 *     - Home Science
 *     - Fashion Designing
 *     - Hospitality Management
 *     - Computer Science
 *     - Physical Education
 *     - Languages (Sanskrit, French, etc.)
 *   Other Optional Subjects (across streams):
 *     - Computer Science
 *     - Physical Education
 *     - Art (Indian or Western Music, Applied Art)
 *     - Legal Studies
 *     - Home Science
 */

/**
 * Absolutely. Below is a **clear, beginner-friendly README explanation** you can paste **at the top of the file or as `scripts/README.seed_ai_content.md`**.

This is written as if a **senior architect is onboarding a new engineer** who will touch this system months later.

---

# 📘 Academic Base Seed Script — README

## What is this script?

This script seeds the **academic foundation** of the AI Tutor system:

```
Board → Class → Subject
```

It creates the **minimum, stable, non-AI data** that everything else in the system depends on.

This includes:

* Education boards (CBSE, ICSE today; State Boards tomorrow)
* Classes / Grades (1–12)
* Subjects available in each class

⚠️ **This script does NOT create chapters, topics, notes, tests, or AI content.**
Those are created later by **AI-driven workers** after human approval.

---

## Why does this script exist?

AI systems must never invent or mutate **academic structure** on their own.

This script ensures:

* A **fixed, authoritative academic taxonomy**
* AI can only generate content **within approved structure**
* The system remains **deterministic, auditable, and safe**

Without this layer:

* AI could hallucinate subjects
* Data integrity would degrade over time
* Approval workflows would become impossible

---

## What data does it seed?

### 1️⃣ Boards

Examples:

* CBSE
* ICSE
  (Designed to support State Boards in the future)

### 2️⃣ Classes (Grades)

* Grades 1 through 12
* Each grade is unique per board

### 3️⃣ Subjects

* Subjects vary by board and grade
* Repeated subjects across grades are reused intentionally

Example:

```
CBSE → Class 6 → Science
ICSE → Class 9 → Physics, Chemistry, Biology
```

---

## What this script deliberately does NOT do

| ❌ Not Allowed          | Reason                             |
| ---------------------- | ---------------------------------- |
| Create chapters        | AI-generated, approval-gated       |
| Create topics          | AI-generated, approval-gated       |
| Call LLMs              | Seed scripts must be deterministic |
| Overwrite data         | Protects human edits & approvals   |
| Delete anything        | Safe after crashes                 |
| Use `create()` blindly | Avoids duplication                 |

---

## Idempotency (Very Important)

This script is **idempotent**.

That means:

* You can run it **multiple times**
* It will **not duplicate data**
* It will **not overwrite existing data**
* It is safe after:

  * Partial failures
  * Crashes
  * Schema resets

### How is this achieved?

* Uses **`upsert()` everywhere**
* Relies on **unique constraints**, not IDs
* Never updates existing rows

Example:

```ts
@@unique([boardId, grade])
@@unique([classId, slug])
```

These ensure correctness even if the script is re-run.

---

## Why are some classes missing subjects?

You may notice patterns like:

```ts
{ grade: 1, subjects: [...] }
{ grade: 2, subjects: [] }
```

This means:

➡️ *“Class 2 has the same subjects as Class 1”*

This avoids duplication and makes it easy to:

* Change subject structure in one place
* Keep grades consistent
* Scale to new boards quickly

---

## How does this support AI safely?

This script establishes **hard boundaries**:

AI workers are only allowed to:

* Read Board / Class / Subject IDs
* Generate content *inside* that structure

AI is **never allowed** to:

* Invent new boards
* Invent subjects
* Mutate academic structure

This enables:

* Approval workflows
* Versioning
* Rollbacks
* Curriculum audits

---

## How to extend this script tomorrow

### ➕ Add a new board

Add a new entry to `BOARDS`:

```ts
{
  name: "Maharashtra State Board",
  slug: "msb",
  classes: [...]
}
```

### ➕ Add or adjust subjects

Modify the subject arrays for the relevant grade.

⚠️ Do **not** delete or rename slugs casually — slugs are stable identifiers.

---

## Logging & Observability

The script logs:

* Each board created/found
* Each class processed
* Number of subjects per class

This helps:

* Debug failed runs
* Understand what changed
* Validate large curriculum imports

---

## Guardrails (Do Not Break These)

🚫 Do NOT add AI calls
🚫 Do NOT add chapters/topics
🚫 Do NOT convert upsert to create
🚫 Do NOT delete existing data

If you violate these rules, you risk:

* Corrupting production content
* Breaking approvals
* Allowing AI hallucinations

---

## In One Sentence

> **This script creates the stable academic skeleton of the platform — everything else grows safely on top of it.**

---

 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * ---------------------------------------------------
 * CURRICULUM DEFINITIONS (Board → Class → Subjects)
 * ---------------------------------------------------
 */

type SubjectSeed = {
  name: string
  slug: string
}

type ClassSeed = {
  grade: number
  subjects: SubjectSeed[]
}

type BoardSeed = {
  name: string
  slug: string
  classes: ClassSeed[]
}

/**
 * NOTE:
 * - Subjects repeat across grades → we intentionally redefine
 * - Empty subjects array means "same as previous grade"
 */

const BOARDS: BoardSeed[] = [
  {
    name: "CBSE",
    slug: "cbse",
    classes: [
      {
        grade: 1,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "Art Education", slug: "art-education" },
          { name: "Health & Physical Education", slug: "physical-education" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 2, subjects: [] },

      {
        grade: 3,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "General Knowledge", slug: "general-knowledge" },
          { name: "Art Education", slug: "art-education" },
          { name: "Health & Physical Education", slug: "physical-education" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },

      {
        grade: 6,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Science", slug: "science" },
          { name: "Social Science", slug: "social-science" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 7, subjects: [] },
      { grade: 8, subjects: [] },

      {
        grade: 9,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Biology", slug: "biology" },
          { name: "History", slug: "history" },
          { name: "Geography", slug: "geography" },
          { name: "Economics", slug: "economics" },
          { name: "Computer Applications", slug: "computer-applications" },
        ],
      },
      { grade: 10, subjects: [] },

      {
        grade: 11,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Biology", slug: "biology" },
          { name: "Accountancy", slug: "accountancy" },
          { name: "Business Studies", slug: "business-studies" },
          { name: "Economics", slug: "economics" },
          { name: "History", slug: "history" },
          { name: "Political Science", slug: "political-science" },
        ],
      },
      { grade: 12, subjects: [] },
    ],
  },

  {
    name: "ICSE",
    slug: "icse",
    classes: [
      {
        grade: 1,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Second Language", slug: "second-language" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "Computer Applications", slug: "computer-applications" },
          { name: "Art & Music", slug: "art-music" },
          { name: "Physical Education", slug: "physical-education" },
        ],
      },
      { grade: 2, subjects: [] },
      { grade: 3, subjects: [] },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },

      {
        grade: 9,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Biology", slug: "biology" },
          { name: "History Civics & Geography", slug: "history-civics-geography" },
          { name: "Computer Applications", slug: "computer-applications" },
        ],
      },
      { grade: 10, subjects: [] },
    ],
  },
]

/**
 * ---------------------------------------------------
 * EXECUTION
 * ---------------------------------------------------
 */

async function main() {
  console.log("🌱 Starting academic base seeding...\n")

  for (const boardSeed of BOARDS) {
    const board = await prisma.board.upsert({
      where: { slug: boardSeed.slug },
      update: {},
      create: {
        name: boardSeed.name,
        slug: boardSeed.slug,
      },
    })

    console.log(`📘 Board ready: ${board.name}`)

    let previousSubjects: SubjectSeed[] = []

    for (const classSeed of boardSeed.classes) {
      const classLevel = await prisma.classLevel.upsert({
        where: {
          boardId_grade: {
            boardId: board.id,
            grade: classSeed.grade,
          },
        },
        update: {},
        create: {
          boardId: board.id,
          grade: classSeed.grade,
          slug: `class-${classSeed.grade}`,
        },
      })

      const subjectsToSeed =
        classSeed.subjects.length > 0 ? classSeed.subjects : previousSubjects

      console.log(
        `  🎓 Class ${classSeed.grade} → ${subjectsToSeed.length} subjects`
      )

      for (const subject of subjectsToSeed) {
        await prisma.subjectDef.upsert({
          where: {
            classId_slug: {
              classId: classLevel.id,
              slug: subject.slug,
            },
          },
          update: {},
          create: {
            classId: classLevel.id,
            name: subject.name,
            slug: subject.slug,
          },
        })
      }

      previousSubjects = subjectsToSeed
    }

    console.log("")
  }

  console.log("✅ Academic base seeding completed successfully")
}

main()
  .catch((err) => {
    console.error("❌ Seed failed", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
