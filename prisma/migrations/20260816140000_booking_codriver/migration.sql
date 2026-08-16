-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "coDriverRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "coDriverName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "coDriverLicenseNumber" TEXT;
