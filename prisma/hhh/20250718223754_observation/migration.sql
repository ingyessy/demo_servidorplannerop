/*
  Warnings:

  - You are about to drop the column `observation` on the `BillDetail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "id_group" TEXT;

-- AlterTable
ALTER TABLE "BillDetail" DROP COLUMN "observation";
