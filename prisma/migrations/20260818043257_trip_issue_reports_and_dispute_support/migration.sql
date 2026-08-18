-- CreateEnum
CREATE TYPE "TripIssueType" AS ENUM ('DAMAGE', 'FUEL', 'FASTAG');

-- CreateEnum
CREATE TYPE "DisputeSupportChannel" AS ENUM ('PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DisputeSupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "DamageClaimStatus" ADD VALUE 'BILL_SUBMITTED';

-- DropIndex
DROP INDEX "DamageClaim_bookingId_key";

-- AlterTable
ALTER TABLE "DamageClaim" ADD COLUMN     "excessChargeAmount" DOUBLE PRECISION,
ADD COLUMN     "excessChargePaidAt" TIMESTAMP(3),
ADD COLUMN     "excessChargePaymentIntentId" TEXT,
ADD COLUMN     "resolutionBillAmount" DOUBLE PRECISION,
ADD COLUMN     "resolutionBillUrl" TEXT,
ADD COLUMN     "resolutionPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resolutionSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "type" "TripIssueType" NOT NULL DEFAULT 'DAMAGE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingFeeDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DisputeSupportRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "channel" "DisputeSupportChannel" NOT NULL,
    "status" "DisputeSupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAgentId" TEXT,
    "hostFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 149,
    "hostFeeCharged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DisputeSupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeSupportRequest_status_idx" ON "DisputeSupportRequest"("status");

-- CreateIndex
CREATE INDEX "DamageClaim_bookingId_idx" ON "DamageClaim"("bookingId");

-- AddForeignKey
ALTER TABLE "DisputeSupportRequest" ADD CONSTRAINT "DisputeSupportRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeSupportRequest" ADD CONSTRAINT "DisputeSupportRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeSupportRequest" ADD CONSTRAINT "DisputeSupportRequest_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
