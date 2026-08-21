-- CreateEnum
CREATE TYPE "AxonPartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('GUEST', 'AXON_PARTNER');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_customerId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "axonPartnerId" TEXT,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'GUEST',
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "razorpayxFundAccountId" TEXT;

-- CreateTable
CREATE TABLE "AxonPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "status" "AxonPartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxonPartner_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_axonPartnerId_fkey" FOREIGN KEY ("axonPartnerId") REFERENCES "AxonPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
