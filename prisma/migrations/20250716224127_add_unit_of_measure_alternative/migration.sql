/*
  Warnings:

  - You are about to drop the column `id_paysheet_unit` on the `Tariff` table. All the data in the column will be lost.
  - Added the required column `id_unidOfMeasure` to the `Tariff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_id_facturation_unit_fkey";

-- DropForeignKey
ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_id_paysheet_unit_fkey";

-- AlterTable
ALTER TABLE "Tariff" DROP COLUMN "id_paysheet_unit",
ADD COLUMN     "id_unidOfMeasure" INTEGER NOT NULL,
ALTER COLUMN "id_facturation_unit" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_unidOfMeasure_fkey" FOREIGN KEY ("id_unidOfMeasure") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_facturation_unit_fkey" FOREIGN KEY ("id_facturation_unit") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
