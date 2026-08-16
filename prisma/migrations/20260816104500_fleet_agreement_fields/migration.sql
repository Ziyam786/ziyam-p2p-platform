-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "fleetAgreementWetSignedUrl" TEXT,
ADD COLUMN     "fleetAgreementWetSignedAt" TIMESTAMP(3),
ADD COLUMN     "fleetAgreementEsignRequestId" TEXT,
ADD COLUMN     "fleetAgreementEsignStatus" TEXT,
ADD COLUMN     "fleetAgreementEsignDownloadUrl" TEXT;
