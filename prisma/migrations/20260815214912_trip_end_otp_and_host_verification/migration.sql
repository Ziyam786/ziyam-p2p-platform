-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "endOtp" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alternatePhoneNumber" TEXT,
ADD COLUMN     "selfieUrl" TEXT,
ADD COLUMN     "signatureUrl" TEXT;
