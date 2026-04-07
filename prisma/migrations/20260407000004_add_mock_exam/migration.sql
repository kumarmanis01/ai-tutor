-- F-STU-021: Full Syllabus Mock Exam
-- Additive migration: creates 5 new tables, no existing tables modified.

CREATE TABLE "MockExam" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "subjectId"   TEXT NOT NULL,
    "grade"       INTEGER NOT NULL,
    "board"       TEXT NOT NULL,
    "totalMarks"  INTEGER NOT NULL DEFAULT 80,
    "durationMin" INTEGER NOT NULL DEFAULT 180,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamSection" (
    "id"           TEXT NOT NULL,
    "mockExamId"   TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "order"        INTEGER NOT NULL,
    "totalMarks"   INTEGER NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "MockExamSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamQuestion" (
    "id"         TEXT NOT NULL,
    "sectionId"  TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "marks"      INTEGER NOT NULL DEFAULT 1,
    "order"      INTEGER NOT NULL,

    CONSTRAINT "MockExamQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamAttempt" (
    "id"           TEXT NOT NULL,
    "mockExamId"   TEXT NOT NULL,
    "studentId"    TEXT NOT NULL,
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"   TIMESTAMP(3),
    "scorePercent" DOUBLE PRECISION,
    "percentile"   DOUBLE PRECISION,
    "priorityPlan" TEXT,
    "rawResult"    JSONB,

    CONSTRAINT "MockExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamSectionAttempt" (
    "id"          TEXT NOT NULL,
    "attemptId"   TEXT NOT NULL,
    "sectionId"   TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "scorePercent" DOUBLE PRECISION,
    "answers"     JSONB,

    CONSTRAINT "MockExamSectionAttempt_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "MockExam"
    ADD CONSTRAINT "MockExam_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "SubjectDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MockExamSection"
    ADD CONSTRAINT "MockExamSection_mockExamId_fkey"
    FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MockExamQuestion"
    ADD CONSTRAINT "MockExamQuestion_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "MockExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MockExamQuestion"
    ADD CONSTRAINT "MockExamQuestion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MockExamAttempt"
    ADD CONSTRAINT "MockExamAttempt_mockExamId_fkey"
    FOREIGN KEY ("mockExamId") REFERENCES "MockExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MockExamAttempt"
    ADD CONSTRAINT "MockExamAttempt_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MockExamSectionAttempt"
    ADD CONSTRAINT "MockExamSectionAttempt_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "MockExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MockExamSectionAttempt"
    ADD CONSTRAINT "MockExamSectionAttempt_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "MockExamSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "MockExam_subjectId_grade_board_status_idx"
    ON "MockExam"("subjectId", "grade", "board", "status");

CREATE INDEX "MockExamSection_mockExamId_idx"
    ON "MockExamSection"("mockExamId");

CREATE INDEX "MockExamQuestion_sectionId_idx"
    ON "MockExamQuestion"("sectionId");

CREATE INDEX "MockExamQuestion_questionId_idx"
    ON "MockExamQuestion"("questionId");

CREATE INDEX "MockExamAttempt_studentId_idx"
    ON "MockExamAttempt"("studentId");

CREATE INDEX "MockExamAttempt_mockExamId_idx"
    ON "MockExamAttempt"("mockExamId");

CREATE UNIQUE INDEX "MockExamSectionAttempt_attemptId_sectionId_key"
    ON "MockExamSectionAttempt"("attemptId", "sectionId");

CREATE INDEX "MockExamSectionAttempt_attemptId_idx"
    ON "MockExamSectionAttempt"("attemptId");
