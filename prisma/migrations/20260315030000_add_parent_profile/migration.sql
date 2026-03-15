-- Migration: add_parent_profile (T38 — parent as distinct actor)

CREATE TABLE "ParentProfile" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

ALTER TABLE "ParentProfile"
  ADD CONSTRAINT "ParentProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
