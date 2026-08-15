-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "esignDownloadUrl" TEXT,
ADD COLUMN     "esignRequestId" TEXT,
ADD COLUMN     "esignStatus" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digilockerRequestId" TEXT,
ADD COLUMN     "digilockerStatus" TEXT;
