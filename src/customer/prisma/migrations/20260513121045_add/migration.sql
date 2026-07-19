/*
  Warnings:

  - You are about to drop the column `password_change_at` on the `Token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expires_at` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password_change_at` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Token_token_key";

-- AlterTable
ALTER TABLE "Token" DROP COLUMN "password_change_at",
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password_change_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Token_email_key" ON "Token"("email");
