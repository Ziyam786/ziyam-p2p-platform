-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aadhaarVerifiedName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankAccountVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankNameAtBank" TEXT;
