-- Converts platform/category/expenseType/paymentMode from fixed Postgres
-- enums to plain TEXT columns, admin-configurable via Settings
-- (fleet_platforms / fleet_ledger_categories / fleet_expense_types /
-- fleet_payment_modes) instead of requiring a migration to add/rename a
-- category. Isolated into its own migration file (separate from the
-- additive 20260816080000 one) since this alters existing columns and drops
-- types rather than purely adding — kept independently revertible.

-- AlterTable
ALTER TABLE "PlatformBooking" ALTER COLUMN "platform" TYPE TEXT USING "platform"::TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- AlterTable
ALTER TABLE "FleetExpense" ALTER COLUMN "expenseType" TYPE TEXT USING "expenseType"::TEXT,
ALTER COLUMN "paymentMode" TYPE TEXT USING "paymentMode"::TEXT;

-- DropEnum
DROP TYPE "RentalPlatform";

-- DropEnum
DROP TYPE "LedgerCategory";

-- DropEnum
DROP TYPE "FleetExpenseType";

-- DropEnum
DROP TYPE "PaymentMode";
