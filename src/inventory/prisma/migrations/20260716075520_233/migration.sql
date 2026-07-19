/*
  Warnings:

  - Added the required column `archived_quantity` to the `Inventory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "archived_quantity" INTEGER NOT NULL;
