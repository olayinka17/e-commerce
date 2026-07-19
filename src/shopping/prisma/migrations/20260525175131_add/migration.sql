/*
  Warnings:

  - You are about to drop the `Cart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Cart_Item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wishlist` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wishlist_item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Cart_Item" DROP CONSTRAINT "Cart_Item_cart_id_fkey";

-- DropForeignKey
ALTER TABLE "Order_items" DROP CONSTRAINT "Order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist_item" DROP CONSTRAINT "Wishlist_item_wishlist_id_fkey";

-- DropTable
DROP TABLE "Cart";

-- DropTable
DROP TABLE "Cart_Item";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "Transaction";

-- DropTable
DROP TABLE "Wishlist";

-- DropTable
DROP TABLE "Wishlist_item";

-- CreateTable
CREATE TABLE "Carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "Wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart_Items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Cart_Items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'pending',
    "payment_status" "Payment_status" NOT NULL DEFAULT 'pending',
    "total_price" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transactions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'pending',
    "update_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carts_user_id_key" ON "Carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlists_user_id_key" ON "Wishlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_items_wishlist_id_product_id_key" ON "Wishlist_items"("wishlist_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_Items_cart_id_product_id_key" ON "Cart_Items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transactions_order_id_key" ON "Transactions"("order_id");

-- AddForeignKey
ALTER TABLE "Wishlist_items" ADD CONSTRAINT "Wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "Wishlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart_Items" ADD CONSTRAINT "Cart_Items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "Carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order_items" ADD CONSTRAINT "Order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
