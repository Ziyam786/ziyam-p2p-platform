-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "priceEstimate" DOUBLE PRECISION NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "serviceLocation" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "fleetExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_fleetExpenseId_key" ON "ServiceRequest"("fleetExpenseId");

-- CreateIndex
CREATE INDEX "ServiceRequest_carId_idx" ON "ServiceRequest"("carId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_fleetExpenseId_fkey" FOREIGN KEY ("fleetExpenseId") REFERENCES "FleetExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
