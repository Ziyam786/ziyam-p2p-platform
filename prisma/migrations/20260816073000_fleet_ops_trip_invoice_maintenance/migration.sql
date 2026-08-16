-- CreateEnum
CREATE TYPE "OpsTripStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpsInvoiceType" AS ENUM ('RENTAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "OpsInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'PAID');

-- CreateEnum
CREATE TYPE "OpsPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "serviceCategory" TEXT,
ADD COLUMN     "labourCost" DOUBLE PRECISION,
ADD COLUMN     "partsCost" DOUBLE PRECISION,
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ADD COLUMN     "technician" TEXT,
ADD COLUMN     "mechanicNotes" TEXT,
ADD COLUMN     "odometer" DOUBLE PRECISION,
ADD COLUMN     "serviceCode" TEXT,
ADD COLUMN     "invoiceBillTo" TEXT,
ADD COLUMN     "invoiceMobile" TEXT,
ADD COLUMN     "invoiceDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceRequestItem" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequestItem_serviceId_idx" ON "ServiceRequestItem"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceRequestItem" ADD CONSTRAINT "ServiceRequestItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OpsTrip" (
    "id" TEXT NOT NULL,
    "tripCode" TEXT,
    "carId" TEXT NOT NULL,
    "bookingPlatform" TEXT,
    "externalBookingId" TEXT,
    "driverRef" TEXT,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "pickupLocation" TEXT,
    "dropLocation" TEXT,
    "pickupType" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "odometerStart" DOUBLE PRECISION,
    "odometerEnd" DOUBLE PRECISION,
    "rangeKm" DOUBLE PRECISION,
    "fastag" TEXT,
    "checkoutFastag" TEXT,
    "fuelEst" TEXT,
    "carWashed" BOOLEAN NOT NULL DEFAULT false,
    "washingCharges" DOUBLE PRECISION,
    "tyreHealth" TEXT,
    "newDamages" TEXT,
    "baseFare" DOUBLE PRECISION,
    "addonTotal" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "amountCollected" DOUBLE PRECISION,
    "amountPaidGuest" DOUBLE PRECISION,
    "addons" JSONB,
    "checkoutAddons" JSONB,
    "status" "OpsTripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsTrip_carId_idx" ON "OpsTrip"("carId");

-- CreateIndex
CREATE INDEX "OpsTrip_status_idx" ON "OpsTrip"("status");

-- AddForeignKey
ALTER TABLE "OpsTrip" ADD CONSTRAINT "OpsTrip_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsTrip" ADD CONSTRAINT "OpsTrip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OpsTripImage" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsTripImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsTripImage_tripId_idx" ON "OpsTripImage"("tripId");

-- AddForeignKey
ALTER TABLE "OpsTripImage" ADD CONSTRAINT "OpsTripImage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "OpsTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OpsInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "OpsInvoiceType" NOT NULL,
    "tripId" TEXT,
    "serviceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "serviceChargePct" DOUBLE PRECISION NOT NULL,
    "serviceCharge" DOUBLE PRECISION NOT NULL,
    "netToOwner" DOUBLE PRECISION NOT NULL,
    "status" "OpsInvoiceStatus" NOT NULL DEFAULT 'SENT',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpsInvoice_invoiceNumber_key" ON "OpsInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "OpsInvoice_tripId_idx" ON "OpsInvoice"("tripId");

-- CreateIndex
CREATE INDEX "OpsInvoice_serviceId_idx" ON "OpsInvoice"("serviceId");

-- AddForeignKey
ALTER TABLE "OpsInvoice" ADD CONSTRAINT "OpsInvoice_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "OpsTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsInvoice" ADD CONSTRAINT "OpsInvoice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsInvoice" ADD CONSTRAINT "OpsInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "OpsPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" TEXT,
    "transferDate" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "OpsPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsPayment_invoiceId_idx" ON "OpsPayment"("invoiceId");

-- AddForeignKey
ALTER TABLE "OpsPayment" ADD CONSTRAINT "OpsPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "OpsInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsPayment" ADD CONSTRAINT "OpsPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
