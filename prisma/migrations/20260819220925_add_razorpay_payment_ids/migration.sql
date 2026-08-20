-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "razorpayPaymentId" TEXT;

-- AlterTable
ALTER TABLE "DamageClaim" ADD COLUMN     "excessChargeRazorpayPaymentId" TEXT;

-- AlterTable
ALTER TABLE "ItineraryUnlock" ADD COLUMN     "razorpayPaymentId" TEXT;
