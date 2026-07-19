-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processed', 'failed');

-- DropIndex
DROP INDEX "Product_category_id_key";

-- CreateTable
CREATE TABLE "InventoryOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "InventoryOutbox_pkey" PRIMARY KEY ("id")
);
