-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FLEET_ADMIN';
ALTER TYPE "Role" ADD VALUE 'OPERATIONS_EXECUTIVE';
ALTER TYPE "Role" ADD VALUE 'MECHANICAL_EXECUTIVE';
ALTER TYPE "Role" ADD VALUE 'TECHNICIAN';

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customRoleId" TEXT,
ADD COLUMN     "ownerCode" TEXT,
ADD COLUMN     "partnerAgreementWetSignedUrl" TEXT,
ADD COLUMN     "partnerAgreementWetSignedAt" TIMESTAMP(3),
ADD COLUMN     "partnerAgreementEsignRequestId" TEXT,
ADD COLUMN     "partnerAgreementEsignStatus" TEXT,
ADD COLUMN     "partnerAgreementEsignDownloadUrl" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "vehicleCode" TEXT,
ADD COLUMN     "chassis" TEXT,
ADD COLUMN     "currentOdo" DOUBLE PRECISION,
ADD COLUMN     "lastServiceOdo" DOUBLE PRECISION,
ADD COLUMN     "lastServiceDate" TIMESTAMP(3),
ADD COLUMN     "serviceScheduledDate" TIMESTAMP(3),
ADD COLUMN     "insuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "rcExpiry" TIMESTAMP(3),
ADD COLUMN     "pucExpiry" TIMESTAMP(3),
ADD COLUMN     "fuelLevel" DOUBLE PRECISION,
ADD COLUMN     "fleetStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "pauseReason" TEXT,
ADD COLUMN     "pauseStatus" TEXT,
ADD COLUMN     "pauseFrom" TIMESTAMP(3),
ADD COLUMN     "pauseUntil" TIMESTAMP(3);
