-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'HOST', 'SYSTEM', 'ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_HOST_REVIEW';
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "hostReviewDeadline" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;
