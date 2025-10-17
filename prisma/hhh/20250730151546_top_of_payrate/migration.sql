/*
  Warnings:

  - You are about to alter the column `pay_unit` on the `BillDetail` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(4,2)`.

*/
-- AlterTable
ALTER TABLE "BillDetail" ALTER COLUMN "pay_unit" SET DATA TYPE DECIMAL(4,2),
ALTER COLUMN "pay_rate" SET DATA TYPE DECIMAL(10,2);
