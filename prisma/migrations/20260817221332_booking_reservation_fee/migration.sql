-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'RESERVED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reservationDeadline" TIMESTAMP(3),
ADD COLUMN     "reservationFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reservationPaidAt" TIMESTAMP(3);
