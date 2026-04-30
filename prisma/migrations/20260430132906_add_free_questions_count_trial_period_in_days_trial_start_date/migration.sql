/*
  Warnings:

  - The values [MISCONCEPTION_CREATE,MISCONCEPTION_UPDATE] on the enum `AdminActionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `LearningPlan` table. All the data in the column will be lost.
  - You are about to drop the column `todaysFreeQuestionsCount` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `ConsentRequest` will be added. If there are existing duplicate values, this will fail.
  - Made the column `ipAddress` on table `AdminAuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `MarketingSpend` required. This step will fail if there are existing NULL values in that column.
  - Made the column `type` on table `ParentNotification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `channel` on table `ParentNotification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sentAt` on table `ParentNotification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `ParentNotification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `PaymentEvent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `inputVars` on table `PromptExample` required. This step will fail if there are existing NULL values in that column.
  - Made the column `creditBalance` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/

-- AlterEnum
BEGIN;
CREATE TYPE "AdminActionType_new" AS ENUM ('GRADE_CHANGE', 'DIAGNOSTIC_RESET', 'ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'ACCOUNT_DEACTIVATE', 'SUBSCRIPTION_EXTEND', 'SUBSCRIPTION_REFUND', 'QUESTION_QUARANTINE', 'QUESTION_APPROVE', 'QUESTION_REJECT', 'FEATURE_FLAG_CHANGE', 'ERASURE_REQUEST', 'ERASURE_PSEUDONYMISE', 'ERASURE_PURGE', 'CONTENT_APPROVE', 'DOUBT_RESOLVE', 'CONTENT_REJECT', 'JOB_CANCEL', 'JOB_PAUSE', 'JOB_RESUME', 'JOB_RETRY', 'JOB_REQUEUE', 'REGEN_JOB_CREATED', 'REGEN_JOB_TRIGGERED', 'REGEN_JOB_STARTED', 'REGEN_JOB_COMPLETED', 'REGEN_JOB_FAILED', 'REGEN_JOB_LOCKED', 'CONTENT_HYDRATE', 'WORKER_START', 'WORKER_STOP', 'CONCEPT_SUSPEND', 'CONCEPT_UNSUSPEND');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AdminActionType_new" USING ("action"::text::"AdminActionType_new");
ALTER TYPE "AdminActionType" RENAME TO "AdminActionType_old";
ALTER TYPE "AdminActionType_new" RENAME TO "AdminActionType";
DROP TYPE "public"."AdminActionType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'MISCONCEPTION_HIGH_PREVALENCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegenerationJobStatus" ADD VALUE 'MISCONCEPTION_CREATE';
ALTER TYPE "RegenerationJobStatus" ADD VALUE 'MISCONCEPTION_UPDATE';

-- DropForeignKey
ALTER TABLE "ConceptHistory" DROP CONSTRAINT "ConceptHistory_conceptId_fkey";

-- DropForeignKey
ALTER TABLE "DoubtEscalation" DROP CONSTRAINT "DoubtEscalation_doubtKbId_fkey";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "fk_installment_payment";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "fk_installment_subscription";

-- DropForeignKey
ALTER TABLE "LtvSnapshot" DROP CONSTRAINT "fk_ltvsnapshot_createdby";

-- DropForeignKey
ALTER TABLE "MarketingSpend" DROP CONSTRAINT "fk_marketingspend_createdby";

-- DropForeignKey
ALTER TABLE "MockExamAttempt" DROP CONSTRAINT "MockExamAttempt_studentId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamQuestion" DROP CONSTRAINT "MockExamQuestion_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamSection" DROP CONSTRAINT "MockExamSection_mockExamId_fkey";

-- DropForeignKey
ALTER TABLE "MockExamSectionAttempt" DROP CONSTRAINT "MockExamSectionAttempt_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentCustomer" DROP CONSTRAINT "fk_paymentcustomer_user";

-- DropForeignKey
ALTER TABLE "PaymentEvent" DROP CONSTRAINT "fk_paymentevent_payment";

-- DropForeignKey
ALTER TABLE "PaymentMethod" DROP CONSTRAINT "fk_paymentmethod_customer";

-- DropForeignKey
ALTER TABLE "PaymentMethod" DROP CONSTRAINT "fk_paymentmethod_user";

-- DropForeignKey
ALTER TABLE "PhoneOtp" DROP CONSTRAINT "PhoneOtp_consentRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralReward" DROP CONSTRAINT "fk_referralreward_referral";

-- DropForeignKey
ALTER TABLE "ReferralReward" DROP CONSTRAINT "fk_referralreward_user";

-- DropForeignKey
ALTER TABLE "SessionArtifact" DROP CONSTRAINT "SessionArtifact_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SessionArtifact" DROP CONSTRAINT "SessionArtifact_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentConceptState" DROP CONSTRAINT "StudentConceptState_conceptId_fkey";

-- DropForeignKey
ALTER TABLE "StudentConceptState" DROP CONSTRAINT "StudentConceptState_studentId_fkey";

-- DropIndex
DROP INDEX "AITutorTurnLog_anomalyflags_gin";

-- DropIndex
DROP INDEX "CurriculumChunk_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "DoubtEscalation_doubtKbId_idx";

-- DropIndex
DROP INDEX "DoubtEscalation_notifiedAt_idx";

-- DropIndex
DROP INDEX "DoubtKb_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "DoubtKb_embedding_ivfflat_idx";

-- DropIndex
DROP INDEX "LearningPlan_studentId_key";

-- DropIndex
DROP INDEX "LearningPlanItem_planId_status_completedAt_idx";

-- DropIndex
DROP INDEX "LearningSession_studentId_startedAt_idx";

-- DropIndex
DROP INDEX "Message_anomalyflags_gin";

-- DropIndex
DROP INDEX "idx_promotioncandidate_scope_ref";

-- DropIndex
DROP INDEX "StructuredSession_studentId_startedAt_idx";

-- DropIndex
DROP INDEX "idx_subscription_grace_until";

-- AlterTable
ALTER TABLE "AdminAuditLog" ALTER COLUMN "ipAddress" SET NOT NULL;

-- AlterTable
ALTER TABLE "AdminUser" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "archived" DROP NOT NULL,
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Concept" ALTER COLUMN "suspendedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConceptHistory" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "previousPrereqIds" DROP DEFAULT,
ALTER COLUMN "newPrereqIds" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GenerationJob" ALTER COLUMN "subscriberIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Installment" ALTER COLUMN "dueAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastAttemptAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LearningPlan" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "LtvSnapshot" ALTER COLUMN "snapshotAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "windowStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "windowEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketingSpend" ALTER COLUMN "periodStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "periodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ParentChildControl" ALTER COLUMN "pausedUntil" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ParentNotification" ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "channel" SET NOT NULL,
ALTER COLUMN "sentAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "ParentStudent" ALTER COLUMN "pausedUntil" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentCustomer" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentEvent" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentMethod" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PromptExample" ALTER COLUMN "inputVars" SET NOT NULL;

-- AlterTable
ALTER TABLE "ReferralReward" ALTER COLUMN "appliedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentConceptState" ADD COLUMN     "hintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hintTier1" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hintTier2" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hintTier3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastHintAt" TIMESTAMP(3),
ADD COLUMN     "needsConsolidation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "creditBalance" SET NOT NULL,
ALTER COLUMN "lastDunningAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "graceUntil" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "todaysFreeQuestionsCount",
ADD COLUMN     "freeQuestionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialPeriodInDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "trialStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "QuestionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionText" TEXT NOT NULL,
    "topic" TEXT,

    CONSTRAINT "QuestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "studentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "hsnCode" TEXT,
    "gstin" TEXT,
    "taxBreakdown" JSONB,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'ONE_TIME',
    "scope" "CouponScope" NOT NULL DEFAULT 'GLOBAL',
    "studentId" TEXT,
    "batchId" TEXT,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerUser" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "amountApplied" INTEGER,
    "percentApplied" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "board" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "schoolName" TEXT NOT NULL,
    "partnerId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "imageUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "streakLength" INTEGER NOT NULL,
    "wasShielded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakHistory_pkey" PRIMARY KEY ("id")
);

-- -- CreateIndex
CREATE INDEX "QuestionLog_userId_timestamp_idx" ON "QuestionLog"("userId", "timestamp");

-- -- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- -- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");

-- -- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- -- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- -- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- -- CreateIndex
CREATE INDEX "Coupon_studentId_idx" ON "Coupon"("studentId");

-- -- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- -- CreateIndex
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- -- CreateIndex
CREATE INDEX "CouponRedemption_subscriptionId_idx" ON "CouponRedemption"("subscriptionId");

-- -- CreateIndex
CREATE INDEX "SchoolPartner_isActive_idx" ON "SchoolPartner"("isActive");

-- -- CreateIndex
CREATE INDEX "SchoolLead_status_createdAt_idx" ON "SchoolLead"("status", "createdAt");

-- -- CreateIndex
CREATE INDEX "SchoolLead_partnerId_idx" ON "SchoolLead"("partnerId");

-- -- CreateIndex
CREATE INDEX "SupportTicket_userId_status_idx" ON "SupportTicket"("userId", "status");

-- -- CreateIndex
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");

-- -- CreateIndex
CREATE INDEX "SupportTicket_assignedTo_idx" ON "SupportTicket"("assignedTo");

-- -- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- -- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- -- CreateIndex
CREATE INDEX "StreakHistory_studentId_date_idx" ON "StreakHistory"("studentId", "date");

-- -- CreateIndex
CREATE UNIQUE INDEX "StreakHistory_studentId_date_key" ON "StreakHistory"("studentId", "date");

-- -- CreateIndex
CREATE INDEX "ConsentMessageLog_messageId_idx" ON "ConsentMessageLog"("messageId");

-- -- CreateIndex
CREATE UNIQUE INDEX "ConsentRequest_token_key" ON "ConsentRequest"("token");

-- -- AddForeignKey
ALTER TABLE "QuestionLog" ADD CONSTRAINT "QuestionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "PaymentCustomer" ADD CONSTRAINT "PaymentCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "PaymentCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -- AddForeignKey
ALTER TABLE "SessionArtifact" ADD CONSTRAINT "SessionArtifact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentMessageLog" ADD CONSTRAINT "ConsentMessageLog_consentRequestId_fkey" FOREIGN KEY ("consentRequestId") REFERENCES "ConsentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolLead" ADD CONSTRAINT "SchoolLead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "SchoolPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakHistory" ADD CONSTRAINT "StreakHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_concepthistory_conceptid" RENAME TO "ConceptHistory_conceptId_idx";

-- RenameIndex
ALTER INDEX "idx_concepthistory_createdat" RENAME TO "ConceptHistory_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_installment_dueat" RENAME TO "Installment_dueAt_idx";

-- RenameIndex
ALTER INDEX "idx_installment_subscriptionid" RENAME TO "Installment_subscriptionId_idx";

-- RenameIndex
ALTER INDEX "uniq_installment_subscription_number" RENAME TO "Installment_subscriptionId_number_key";

-- RenameIndex
ALTER INDEX "idx_ltvsnapshot_snapshotat" RENAME TO "LtvSnapshot_snapshotAt_idx";

-- RenameIndex
ALTER INDEX "idx_marketingspend_periodend" RENAME TO "MarketingSpend_periodEnd_idx";

-- RenameIndex
ALTER INDEX "idx_marketingspend_periodstart" RENAME TO "MarketingSpend_periodStart_idx";

-- RenameIndex
ALTER INDEX "idx_paymentcustomer_provider" RENAME TO "PaymentCustomer_provider_idx";

-- RenameIndex
ALTER INDEX "idx_paymentcustomer_userid" RENAME TO "PaymentCustomer_userId_idx";

-- RenameIndex
ALTER INDEX "uniq_paymentcustomer_provider_customer_id" RENAME TO "PaymentCustomer_providerCustomerId_key";

-- RenameIndex
ALTER INDEX "idx_paymentevent_paymentid" RENAME TO "PaymentEvent_paymentId_idx";

-- RenameIndex
ALTER INDEX "idx_paymentevent_provider_idempotency" RENAME TO "PaymentEvent_provider_providerIdempotencyKey_idx";

-- RenameIndex
ALTER INDEX "idx_paymentevent_userid" RENAME TO "PaymentEvent_userId_idx";

-- RenameIndex
ALTER INDEX "idx_paymentmethod_provider" RENAME TO "PaymentMethod_provider_idx";

-- RenameIndex
ALTER INDEX "idx_paymentmethod_userid" RENAME TO "PaymentMethod_userId_idx";

-- RenameIndex
ALTER INDEX "uniq_paymentmethod_provider_pm_id" RENAME TO "PaymentMethod_providerPaymentMethodId_key";

-- RenameIndex
ALTER INDEX "idx_referralreward_status" RENAME TO "ReferralReward_status_idx";

-- RenameIndex
ALTER INDEX "idx_referralreward_userid" RENAME TO "ReferralReward_userId_idx";

-- RenameIndex
ALTER INDEX "SessionArtifact_sessionId_index" RENAME TO "SessionArtifact_sessionId_idx";

-- RenameIndex
ALTER INDEX "SessionArtifact_studentId_index" RENAME TO "SessionArtifact_studentId_idx";
