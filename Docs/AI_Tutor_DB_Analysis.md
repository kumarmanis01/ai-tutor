**AI Tutor DB Analysis — Blueprint vs Current Prisma Schema**

- **Path**: `Docs/AI_Tutor_DB_Analysis.md`
- **Based on**: `Docs/AI Tutor blueprint.pdf` (extracted) and `prisma/schema.prisma`
- **Goal**: Contrast blueprint requirements with current Prisma schema and recommend an optimal student-centric DB structure plus a pragmatic migration plan.

**Executive Summary**:
- **Blueprint focus**: Photo-first doubt solving, structured Q&A lifecycle, parent oversight and RLS, personalized learning (continue/resume, recommendations), tests/notes, streaks, safety/moderation, attachments (images/audio), real-time events, and reporting.
- **Current schema**: Solid foundation (`User`, `Event`, `Chat`, `Room`, `Badge`, `Challenge`, `Subscription`, etc.) but missing several domain-specific models required by the blueprint (student questions, attachments, flags, parent<>student linking, learning sessions/profiles, test results, notes/bookmarks, streak tracking).
- **Recommendation**: Add a small set of new models to support core functionality first (StudentQuestion, QuestionAnswer, QuestionAttachment, QuestionFlag, ParentStudent, LearningSession, StudentLearningProfile, StudentStreak, PracticeTest/TestResult, Note/Bookmark). Keep `User` as the canonical identity table.

**Key Gaps (Blueprint → Prisma mapping)**
- **Photo/voice-first Q&A pipeline**:
  - Blueprint expects per-question lifecycle, attachments and step-by-step AI answers. Current `Chat` and `ChatHistory` are generic and not sufficient for lifecycle fields (`status`, `answeredAt`, `contentSafetyScore`, `helpfulCount`, structured `answerSteps`).
- **Attachments storage**:
  - No `Attachment` model. Need S3 URLs + metadata (mime, width/height, size, kind).
- **Parent–student relationship & RLS**:
  - No explicit `ParentStudent` relation. Blueprint requires RLS policies and views allowing parents to access just their children’s data.
- **Moderation & safety**:
  - No `QuestionFlag` or content safety tracking. Blueprint requires flags, severity, reviewer notes and resolution workflow.
- **Personalization & analytics**:
  - No `LearningSession`, `StudentLearningProfile`, `StudentStreak` models. Events exist but need structured tables for fast queries & recommendation input.
- **Tests, notes, bookmarks**:
  - No `PracticeTest`/`TestResult` models or `Note`/`Bookmark` models.
- **Denormalized metrics**:
  - `User` lacks `lastActivityAt`, `totalStudyMinutes`, counters for `questionsAsked` etc. Useful for fast UI queries (Continue Learning, Profile card).

**Suggested Model Additions (Prisma-ready snippets)**
- Add these models to `prisma/schema.prisma`. These are intentionally concise and can be adapted.

- StudentQuestion / QuestionAnswer / QuestionAttachment / QuestionFlag
```prisma
model StudentQuestion {
  id                String    @id @default(cuid())
  studentId         String
  student           User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  type              String    // 'photo' | 'text' | 'voice'
  subject           String?
  grade             String?
  content           String?   // OCR text or typed text
  status            String    @default("processing")
  createdAt         DateTime  @default(now())
  answeredAt        DateTime?
  answerSummary     String?
  answerStepsJson   Json?
  aiMetadata        Json?
  helpfulCount      Int       @default(0)
  isFlagged         Boolean   @default(false)
  contentSafetyScore Int?
  attachments       QuestionAttachment[]
  answers           QuestionAnswer[]
  @@index([studentId])
  @@index([status])
}

model QuestionAnswer {
  id            String   @id @default(cuid())
  questionId    String
  question      StudentQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  responder     String?  // 'ai' | 'human'
  content       String
  contentJson   Json?
  createdAt     DateTime @default(now())
  helpfulCount  Int      @default(0)
}

model QuestionAttachment {
  id         String  @id @default(cuid())
  questionId String?
  question   StudentQuestion? @relation(fields: [questionId], references: [id], onDelete: Cascade)
  url        String
  mime       String?
  width      Int?
  height     Int?
  size       Int?
  kind       String? // 'image'|'audio'|'ocr'
  createdAt  DateTime @default(now())
  @@index([questionId])
}

model QuestionFlag {
  id            String   @id @default(cuid())
  questionId    String
  question      StudentQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  flagType      String
  severity      String   @default('low')
  autoFlagged   Boolean  @default(false)
  reviewerNotes String?
  status        String   @default('pending')
  flaggedBy     String?
  flaggedAt     DateTime @default(now())
  resolvedAt    DateTime?
}
```

- ParentStudent (explicit parent<>student linking)
```prisma
model ParentStudent {
  id        String @id @default(cuid())
  parentId  String
  parent    User   @relation("ParentRelations", fields: [parentId], references: [id], onDelete: Cascade)
  studentId String
  student   User   @relation("StudentRelations", fields: [studentId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([parentId, studentId])
  @@index([studentId])
}
```

- LearningSession / StudentLearningProfile / StudentStreak
```prisma
model LearningSession {
  id          String   @id @default(cuid())
  studentId   String
  student     User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  activityType String
  activityRef  String?
  duration     Int?
  meta         Json?
  startedAt    DateTime @default(now())
  endedAt      DateTime?
  @@index([studentId])
}

model StudentLearningProfile {
  id            String  @id @default(cuid())
  studentId     String  @unique
  student       User    @relation(fields: [studentId], references: [id], onDelete: Cascade)
  weakSubjects  String[] @default([])
  strengths     Json?
  recommendations Json?
  updatedAt     DateTime @updatedAt
}

model StudentStreak {
  id         String   @id @default(cuid())
  studentId  String
  student    User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  kind       String
  current    Int      @default(0)
  best       Int      @default(0)
  lastActive DateTime?
  @@index([studentId, kind])
}
```

- Tests / Notes / Bookmarks
```prisma
model PracticeTest {
  id          String   @id @default(cuid())
  title       String
  subject     String?
  grade       String?
  questions   Json?
  createdAt   DateTime @default(now())
}

model TestResult {
  id         String   @id @default(cuid())
  testId     String
  studentId  String
  score      Float?
  rawResult  Json?
  startedAt  DateTime?
  finishedAt DateTime?
  createdAt  DateTime @default(now())
  @@index([studentId])
}

model Note {
  id         String   @id @default(cuid())
  studentId  String?
  subject    String?
  title      String
  content    String
  contentJson Json?
  isPublic   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Bookmark {
  id        String @id @default(cuid())
  studentId String
  type      String
  refId     String
  createdAt DateTime @default(now())
  @@index([studentId, type])
}
```

**Schema integration & minimal changes to existing models**
- Keep `User` as canonical identity and continue `subjects String[]` for quick filtering.
- Add denormalized fields to `User` if desired: `lastActivityAt DateTime?`, `totalStudyMinutes Int @default(0)`, `questionsAskedCount Int @default(0)` — updated asynchronously via worker.
- Keep `Event` for analytics; enrich events with `activityRef` and `meta` to map to these new tables.
- `Chat` can remain for conversational flows; prefer `StudentQuestion` for structured Q&A pipeline.

**Indexes & performance**
- Index `studentId`, `status` and `createdAt` on `StudentQuestion`.
- Index `studentId` on session/profile/streak tables.
- Maintain per-user counters on `User` for fast UI retrieval; compute via incremental updates or worker.
- Use materialized views for parent weekly summaries (refresh on a schedule) or maintain summarized rows via workers.

**Moderation & RLS**
- Use `QuestionFlag` and `contentSafetyScore` for automated moderation pipeline.
- Implement Postgres RLS policies that use `ParentStudent` to restrict parent queries. Example policy: parents can select from `test_results` or `student_questions` where `student_id` is in their `ParentStudent` relation.

**Migration Plan (high-level, pragmatic)**
1. **Add new models**: update `prisma/schema.prisma` with the new models and run `npx prisma migrate dev --name add_student_question_models`.
2. **Backfill data**:
   - Map `Chat` entries to `StudentQuestion` where appropriate (e.g., `Chat.role='user'` and `subject` present). Write a Node script to transform and insert rows into `StudentQuestion` and `QuestionAnswer` as needed.
   - Compute `User` denorm counters (`questionsAskedCount`, `lastActivityAt`) from `Event` and `ChatHistory` logs.
3. **Add parent relationships**:
   - Create `ParentStudent` and populate from any existing parent fields (e.g., `parentEmail`) or migration CSV.
4. **Enable RLS & Views**:
   - Add SQL migrations (not Prisma-managed) to create `parent_weekly_summary` view and RLS policies.
5. **Workers & background jobs**:
   - Add jobs to compute `StudentLearningProfile.recommendations`, `totalStudyMinutes`, and update `StudentStreak` and badges when thresholds reached.
6. **Monitoring & roll-forward**:
   - Deploy and monitor slow queries, add indexes or caching (Redis) for hotspots.

**Priority roadmap (minimal to full)**
- Phase 1 (MVP): `StudentQuestion`, `QuestionAttachment`, `QuestionAnswer`, `ParentStudent`, `QuestionFlag`, minimal backfill for recent chats.
- Phase 2: `LearningSession`, `StudentLearningProfile`, `StudentStreak`, denorm fields on `User`, `PracticeTest`/`TestResult`.
- Phase 3: Views for parents, RLS policies, recommendation pipeline, materialized views and performance tuning.

**Operational notes**
- Store attachments in S3 and record stable signed URL patterns in `QuestionAttachment.url`.
- Avoid storing binary content in DB.
- Use JSON fields for AI-produced structured content to allow flexible schema evolution.
- Use background workers (BullMQ, Redis + Node) for heavy tasks: OCR, answer generation, safety checks, recommendation recompute.

**Next steps I can take for you (choose one)**
- Generate a Prisma patch adding Phase 1 models and run `npx prisma migrate dev` locally (I will create migration files and update the client).
- Create only the `StudentQuestion`/`QuestionAnswer`/`QuestionAttachment` models and a data-migration script to convert relevant `Chat` rows.
- Produce the SQL RLS policies and sample view `parent_weekly_summary` for review.

If you want, I can now create the Phase 1 Prisma changes and the migration scripts. Reply with which next-step you prefer and I will implement it.
