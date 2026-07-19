/*
  Warnings:

  - A unique constraint covering the columns `[product_id,order_id,status]` on the table `Inventory_reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "reserved_status" ADD VALUE 'expired_processing';

-- DropIndex
DROP INDEX "Inventory_reservation_product_id_order_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_reservation_product_id_order_id_status_key" ON "Inventory_reservation"("product_id", "order_id", "status");
