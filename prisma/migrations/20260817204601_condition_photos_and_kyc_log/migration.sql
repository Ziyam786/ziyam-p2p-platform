-- CreateEnum
CREATE TYPE "TripStage" AS ENUM ('PRE_TRIP', 'POST_TRIP');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'MIRROR_LEFT', 'MIRROR_RIGHT', 'ODOMETER', 'OTHER');

-- CreateEnum
CREATE TYPE "KycMethod" AS ENUM ('AADHAAR_OTP', 'DIGILOCKER', 'DOC_UPLOAD');

-- CreateEnum
CREATE TYPE "KycOutcome" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "KycVerificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "KycMethod" NOT NULL,
    "outcome" "KycOutcome" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingConditionPhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stage" "TripStage" NOT NULL,
    "angle" "PhotoAngle" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingConditionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycVerificationLog_userId_idx" ON "KycVerificationLog"("userId");

-- CreateIndex
CREATE INDEX "BookingConditionPhoto_bookingId_idx" ON "BookingConditionPhoto"("bookingId");

-- AddForeignKey
ALTER TABLE "KycVerificationLog" ADD CONSTRAINT "KycVerificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConditionPhoto" ADD CONSTRAINT "BookingConditionPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConditionPhoto" ADD CONSTRAINT "BookingConditionPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
