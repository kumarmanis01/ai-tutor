-- Make conceptId nullable on AnswerEvent.
-- Diagnostic answers legitimately have no conceptId when a topic has no
-- concepts seeded yet; the route was already guarding with a conditional
-- spread, but Prisma enforced NOT NULL at the DB level.
ALTER TABLE "AnswerEvent" ALTER COLUMN "conceptId" DROP NOT NULL;
