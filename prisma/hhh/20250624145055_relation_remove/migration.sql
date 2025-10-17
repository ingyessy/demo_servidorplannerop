/*
  Warnings:

  - You are about to drop the column `id_site` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `id_subsite` on the `Client` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_id_site_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_id_subsite_fkey";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "id_site",
DROP COLUMN "id_subsite";
