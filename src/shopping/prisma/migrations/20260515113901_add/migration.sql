/*
  Warnings:

  - A unique constraint covering the columns `[cart_id,product_id]` on the table `Cart_Item` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Cart_Item_cart_id_product_id_key" ON "Cart_Item"("cart_id", "product_id");
