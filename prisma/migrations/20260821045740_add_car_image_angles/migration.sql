-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhotoAngle" ADD VALUE 'INTERIOR_FRONT';
ALTER TYPE "PhotoAngle" ADD VALUE 'INTERIOR_REAR';

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "imageAngles" TEXT[] DEFAULT ARRAY[]::TEXT[];
