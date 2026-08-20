-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "liveLatitude" DOUBLE PRECISION,
ADD COLUMN     "liveLocationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "liveLongitude" DOUBLE PRECISION;
