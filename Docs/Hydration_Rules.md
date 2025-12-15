# Hydration Rules (NON-NEGOTIABLE)

These rules are mandatory for all hydrators and AI content pipeline code.

- Syllabus hydration is SUBJECT-scoped — not chapter-scoped. Chapters and topics MUST be created by the syllabus worker.
- Hydrators may only enqueue `HydrationJob` rows. They MUST NOT call LLMs or mutate curriculum entities directly.
- Hydrators must be idempotent and check for existing content before enqueueing a job.
- If a syllabus (any active `ChapterDef` for the subject) exists, hydrator must no-op and return a clear reason.
- Hydrators must check global flags (e.g., `HYDRATION_PAUSED`) before enqueueing.
- JobType and Status are stored as string literals in Prisma; do not import non-existent Prisma enums.
- Jobs must be deduplicated: avoid creating multiple pending/running jobs for same board/grade/subject.
- All generated chapters/topics must be created as `draft`/`pending` and require admin approval before publishing.
- Soft deletes only — never hard delete curriculum data from hydrators.

If you are writing a new hydrator, follow these steps:

1. Validate inputs (board, grade, subjectId).
2. Check `HYDRATION_PAUSED` system setting.
3. Verify no active `ChapterDef` exists for `subjectId`.
4. Check for existing pending/running `HydrationJob` with same board/grade/subject.
5. Create a `HydrationJob` with `jobType: "syllabus"` and `status: "pending"`.

Failure to follow these rules is considered an architectural bug.
