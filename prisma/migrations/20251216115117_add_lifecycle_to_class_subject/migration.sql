-- AlterTable
ALTER TABLE "ClassLevel" ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "SubjectDef" ADD COLUMN     "lifecycle" "SoftDeleteStatus" NOT NULL DEFAULT 'active';
