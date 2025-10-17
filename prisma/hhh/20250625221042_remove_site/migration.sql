/*
  Warnings:

  - You are about to drop the column `id_site` on the `CostCenter` table. All the data in the column will be lost.
  - Made the column `id_subsite` on table `CostCenter` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_id_site_fkey";

-- DropForeignKey
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_id_subsite_fkey";

-- AlterTable
ALTER TABLE "CostCenter" DROP COLUMN "id_site",
ALTER COLUMN "id_subsite" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
