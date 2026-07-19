-- CreateEnum
CREATE TYPE "movement_types" AS ENUM ('purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'damage', 'loss');

-- CreateEnum
CREATE TYPE "reserved_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "available_quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL,
    "physical_stock" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory_movement" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "movement_types" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory_reservation" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "reserved_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_reservation_pkey" PRIMARY KEY ("id")
);
