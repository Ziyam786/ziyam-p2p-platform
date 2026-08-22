-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPanVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "panCategory" TEXT,
ADD COLUMN     "panNumber" TEXT;
