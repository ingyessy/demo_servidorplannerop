/*
  Warnings:

  - You are about to drop the column `UnitOfMesure_Facture` on the `Tariff` table. All the data in the column will be lost.
  - You are about to drop the column `UnitOfMesure_Paysheet` on the `Tariff` table. All the data in the column will be lost.
  - You are about to drop the column `id_unidOfMeasure` on the `Tariff` table. All the data in the column will be lost.
  - Added the required column `id_facturation_unit` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_paysheet_unit` to the `Tariff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_id_unidOfMeasure_fkey";

-- AlterTable
ALTER TABLE "Tariff" DROP COLUMN "UnitOfMesure_Facture",
DROP COLUMN "UnitOfMesure_Paysheet",
DROP COLUMN "id_unidOfMeasure",
ADD COLUMN     "id_facturation_unit" INTEGER NOT NULL,
ADD COLUMN     "id_paysheet_unit" INTEGER NOT NULL,
ADD COLUMN     "settle_payment" "YES_NO" NOT NULL DEFAULT 'NO';

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_paysheet_unit_fkey" FOREIGN KEY ("id_paysheet_unit") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_facturation_unit_fkey" FOREIGN KEY ("id_facturation_unit") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
