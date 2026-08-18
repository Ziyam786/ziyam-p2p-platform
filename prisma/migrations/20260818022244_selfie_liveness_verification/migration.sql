-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSelfieVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfieVerificationData" JSONB;
