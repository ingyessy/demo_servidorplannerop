/*
  Warnings:

  - You are about to drop the column `id_site` on the `CostCenter` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_id_site_fkey";

-- AlterTable
ALTER TABLE "CostCenter" DROP COLUMN "id_site";
