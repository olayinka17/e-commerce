-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('pending', 'success', 'failed');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'pending',
    "update_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
