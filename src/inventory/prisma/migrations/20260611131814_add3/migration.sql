/*
  Warnings:

  - You are about to drop the column `product_id` on the `processed_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "processed_events" DROP COLUMN "product_id";
