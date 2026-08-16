-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutFrequency" TEXT NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "fleetManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fleetOperatorId" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "fleetReceiptConfirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Car_fleetOperatorId_idx" ON "Car"("fleetOperatorId");

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_fleetOperatorId_fkey" FOREIGN KEY ("fleetOperatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
