/*
  Warnings:

  - The values [success] on the enum `transaction_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "transaction_status_new" AS ENUM ('pending', 'successful', 'failed');
ALTER TABLE "public"."Transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Transactions" ALTER COLUMN "status" TYPE "transaction_status_new" USING ("status"::text::"transaction_status_new");
ALTER TYPE "transaction_status" RENAME TO "transaction_status_old";
ALTER TYPE "transaction_status_new" RENAME TO "transaction_status";
DROP TYPE "public"."transaction_status_old";
ALTER TABLE "Transactions" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;
