-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "assignedAgentId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceRequest_bookingId_idx" ON "ServiceRequest"("bookingId");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignedAgentId_idx" ON "ServiceRequest"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
