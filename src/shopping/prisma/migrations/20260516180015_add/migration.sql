-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending',
ALTER COLUMN "transaction_id" DROP NOT NULL,
ALTER COLUMN "payment_status" SET DEFAULT 'pending';
