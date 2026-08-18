-- AlterEnum
ALTER TYPE "KycMethod" ADD VALUE 'DRIVING_LICENSE';

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "rcAutoVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "rcNumberMatches" BOOLEAN,
ADD COLUMN     "rcVerificationData" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "drivingLicenseExtractedData" JSONB,
ADD COLUMN     "isDrivingLicenseVerified" BOOLEAN NOT NULL DEFAULT false;
