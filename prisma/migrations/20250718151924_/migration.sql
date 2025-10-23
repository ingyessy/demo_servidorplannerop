/*
  Warnings:

  - You are about to alter the column `number_of_hours` on the `Bill` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(4,2)`.

*/
-- AlterTable
ALTER TABLE "Bill" ALTER COLUMN "number_of_hours" DROP NOT NULL,
ALTER COLUMN "number_of_hours" SET DATA TYPE DECIMAL(4,2);
