-- CreateEnum
CREATE TYPE "CarVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "insuranceDocUrl" TEXT,
ADD COLUMN     "maxBookingDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "minBookingHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "minInterBookingHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "nightBookingEnd" TEXT NOT NULL DEFAULT '06:00',
ADD COLUMN     "nightBookingStart" TEXT NOT NULL DEFAULT '22:00',
ADD COLUMN     "noNightBookings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offersPickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pickupFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pollutionCertUrl" TEXT,
ADD COLUMN     "rcDocUrl" TEXT,
ADD COLUMN     "verificationStatus" "CarVerificationStatus" NOT NULL DEFAULT 'PENDING';
