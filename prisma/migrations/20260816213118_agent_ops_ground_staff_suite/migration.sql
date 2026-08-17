-- CreateEnum
CREATE TYPE "CashLogType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- AlterTable
ALTER TABLE "OpsTrip" ADD COLUMN     "assignedAgentId" TEXT,
ADD COLUMN     "customerDecision" TEXT,
ADD COLUMN     "customerSignatureUrl" TEXT,
ADD COLUMN     "depositAmount" DOUBLE PRECISION,
ADD COLUMN     "depositCollected" DOUBLE PRECISION,
ADD COLUMN     "depositPaymentMode" TEXT,
ADD COLUMN     "depositRefundedAt" TIMESTAMP(3),
ADD COLUMN     "digilockerAadhaarLast4" TEXT,
ADD COLUMN     "digilockerAddress" TEXT,
ADD COLUMN     "digilockerRequestId" TEXT,
ADD COLUMN     "digilockerStatus" TEXT,
ADD COLUMN     "digilockerVerifiedName" TEXT,
ADD COLUMN     "dlBackUrl" TEXT,
ADD COLUMN     "dlFrontUrl" TEXT,
ADD COLUMN     "dlNumber" TEXT,
ADD COLUMN     "idVerificationMethod" TEXT,
ADD COLUMN     "maskedIdPhotoUrl" TEXT,
ADD COLUMN     "saveIdentityToVault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vehiclePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CustomerVaultEntry" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "fullName" TEXT,
    "idVerificationMethod" TEXT,
    "maskedIdPhotoUrl" TEXT,
    "dlFrontUrl" TEXT,
    "dlBackUrl" TEXT,
    "dlNumber" TEXT,
    "digilockerVerifiedName" TEXT,
    "digilockerAddress" TEXT,
    "digilockerAadhaarLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashLogEntry" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "CashLogType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVaultEntry_phoneNumber_key" ON "CustomerVaultEntry"("phoneNumber");

-- CreateIndex
CREATE INDEX "CashLogEntry_agentId_createdAt_idx" ON "CashLogEntry"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "CashLogEntry_tripId_idx" ON "CashLogEntry"("tripId");

-- CreateIndex
CREATE INDEX "OpsTrip_assignedAgentId_idx" ON "OpsTrip"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "OpsTrip" ADD CONSTRAINT "OpsTrip_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLogEntry" ADD CONSTRAINT "CashLogEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLogEntry" ADD CONSTRAINT "CashLogEntry_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "OpsTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
