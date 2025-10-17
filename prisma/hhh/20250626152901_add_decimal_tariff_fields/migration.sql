/*
  Warnings:

  - You are about to alter the column `paysheet_tariff` on the `Tariff` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `facturation_tariff` on the `Tariff` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Tariff" ALTER COLUMN "paysheet_tariff" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "facturation_tariff" SET DATA TYPE DECIMAL(10,2);
