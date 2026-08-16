-- AlterTable
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_carId_status_idx" ON "Booking"("carId", "status");
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE INDEX "Car_city_isAvailable_idx" ON "Car"("city", "isAvailable");
CREATE INDEX "Car_ownerId_idx" ON "Car"("ownerId");
CREATE INDEX "Review_carId_hidden_idx" ON "Review"("carId", "hidden");
CREATE INDEX "Review_targetHostId_hidden_idx" ON "Review"("targetHostId", "hidden");
