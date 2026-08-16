-- AlterTable
ALTER TABLE "PlatformBooking" ADD COLUMN     "received" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedCreditDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FleetExpense" ADD COLUMN     "paidTo" TEXT;

-- CreateEnum
CREATE TYPE "OutstandingType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "OutstandingStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OutstandingFrequency" AS ENUM ('ONCE', 'EVERY_TRIP', 'EVERY_MONTH', 'EVERY_DUE', 'EVERY_PAYMENT', 'EVERY_COLLECTION');

-- CreateTable
CREATE TABLE "Outstanding" (
    "id" TEXT NOT NULL,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "paymentTo" TEXT NOT NULL,
    "amountOwed" DOUBLE PRECISION NOT NULL,
    "outstandingType" "OutstandingType" NOT NULL,
    "sourceType" TEXT,
    "frequency" "OutstandingFrequency" NOT NULL DEFAULT 'ONCE',
    "recurringGroup" TEXT,
    "status" "OutstandingStatus" NOT NULL DEFAULT 'PENDING',
    "paidDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outstanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outstanding_outstandingType_idx" ON "Outstanding"("outstandingType");

-- CreateIndex
CREATE INDEX "Outstanding_status_idx" ON "Outstanding"("status");

-- AddForeignKey
ALTER TABLE "Outstanding" ADD CONSTRAINT "Outstanding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MonthlyBalance" (
    "month" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBalance_pkey" PRIMARY KEY ("month")
);
