-- CreateEnum
CREATE TYPE "ItineraryUnlockStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "ItineraryUnlock" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 49,
    "paymentIntentId" TEXT,
    "status" "ItineraryUnlockStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "generatedContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItineraryUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryUnlock_paymentIntentId_key" ON "ItineraryUnlock"("paymentIntentId");

-- CreateIndex
CREATE INDEX "ItineraryUnlock_status_idx" ON "ItineraryUnlock"("status");
