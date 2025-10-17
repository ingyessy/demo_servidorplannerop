/*
  Warnings:

  - You are about to drop the column `time` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - Added the required column `hour` to the `UnitOfMeasure` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UnitOfMeasure" DROP COLUMN "time",
ADD COLUMN     "hour" TEXT NOT NULL;
