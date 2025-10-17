/*
  Warnings:

  - Added the required column `id_site` to the `CostCenter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "id_site" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
