/*
  Warnings:

  - You are about to drop the column `id_site` on the `ClientProgramming` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientProgramming" DROP CONSTRAINT "ClientProgramming_id_site_fkey";

-- AlterTable
ALTER TABLE "ClientProgramming" DROP COLUMN "id_site";
