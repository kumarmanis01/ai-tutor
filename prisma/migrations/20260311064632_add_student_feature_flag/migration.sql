-- CreateTable
CREATE TABLE "StudentFeatureFlag" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_studentfeatureflag_key_enabled" ON "StudentFeatureFlag"("key", "enabled");

-- CreateIndex
CREATE INDEX "idx_studentfeatureflag_studentId" ON "StudentFeatureFlag"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeatureFlag_studentId_key_key" ON "StudentFeatureFlag"("studentId", "key");

-- AddForeignKey
ALTER TABLE "StudentFeatureFlag" ADD CONSTRAINT "StudentFeatureFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
