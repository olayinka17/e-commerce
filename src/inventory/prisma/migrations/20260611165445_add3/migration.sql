/*
  Warnings:

  - A unique constraint covering the columns `[product_id,order_id]` on the table `Inventory_reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Inventory_reservation_product_id_order_id_key" ON "Inventory_reservation"("product_id", "order_id");
