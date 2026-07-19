/*
  Warnings:

  - You are about to drop the column `created_at` on the `InventoryOutbox` table. All the data in the column will be lost.
  - You are about to drop the column `processed_at` on the `InventoryOutbox` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `InventoryOutbox` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `InventoryOutbox` table. All the data in the column will be lost.
  - Added the required column `aggregateid` to the `InventoryOutbox` table without a default value. This is not possible if the table is not empty.
  - Added the required column `aggregatetype` to the `InventoryOutbox` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventtype` to the `InventoryOutbox` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InventoryOutbox" DROP COLUMN "created_at",
DROP COLUMN "processed_at",
DROP COLUMN "status",
DROP COLUMN "type",
ADD COLUMN     "aggregateid" TEXT NOT NULL,
ADD COLUMN     "aggregatetype" TEXT NOT NULL,
ADD COLUMN     "eventtype" TEXT NOT NULL;
