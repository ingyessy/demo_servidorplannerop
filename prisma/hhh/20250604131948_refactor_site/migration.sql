/*
  Warnings:

  - You are about to drop the column `city` on the `Site` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Site` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `Site` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Site_code_key";

-- AlterTable
ALTER TABLE "Site" DROP COLUMN "city",
DROP COLUMN "code",
DROP COLUMN "department";
