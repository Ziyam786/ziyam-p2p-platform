-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "deliveryLatitude" DOUBLE PRECISION,
ADD COLUMN     "deliveryLocationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryLongitude" DOUBLE PRECISION;
