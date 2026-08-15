-- CreateEnum
CREATE TYPE "RentalPlatform" AS ENUM ('ZOOMCAR', 'REVV', 'BHARAT', 'MARC8');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('FASTAG', 'FUEL', 'INSTANCES', 'WASHING', 'DAMAGE');

-- CreateEnum
CREATE TYPE "FleetExpenseType" AS ENUM ('ROUTINE_MAINTENANCE', 'INSURANCE_PREMIUMS', 'STATE_PERMITS', 'ROAD_TAX', 'DRIVER_SALARIES', 'GENERAL_ADMIN');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CORPORATE_CARD', 'FLEET_FUEL_CARD');

-- CreateTable
CREATE TABLE "PlatformBooking" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "platform" "RentalPlatform" NOT NULL,
    "externalBookingId" TEXT NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "totalFare" DOUBLE PRECISION NOT NULL,
    "doorstepCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformCommission" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "carId" TEXT NOT NULL,
    "amountCollected" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetExpense" (
    "id" TEXT NOT NULL,
    "expenseType" "FleetExpenseType" NOT NULL,
    "carId" TEXT,
    "paymentMode" "PaymentMode" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBooking_externalBookingId_key" ON "PlatformBooking"("externalBookingId");

-- CreateIndex
CREATE INDEX "PlatformBooking_carId_idx" ON "PlatformBooking"("carId");

-- CreateIndex
CREATE INDEX "PlatformBooking_platform_idx" ON "PlatformBooking"("platform");

-- CreateIndex
CREATE INDEX "JournalEntry_carId_idx" ON "JournalEntry"("carId");

-- CreateIndex
CREATE INDEX "JournalEntry_category_idx" ON "JournalEntry"("category");

-- CreateIndex
CREATE INDEX "FleetExpense_carId_idx" ON "FleetExpense"("carId");

-- CreateIndex
CREATE INDEX "FleetExpense_expenseType_idx" ON "FleetExpense"("expenseType");

-- AddForeignKey
ALTER TABLE "PlatformBooking" ADD CONSTRAINT "PlatformBooking_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBooking" ADD CONSTRAINT "PlatformBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetExpense" ADD CONSTRAINT "FleetExpense_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetExpense" ADD CONSTRAINT "FleetExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
