/*
  Warnings:

  - You are about to drop the column `boxes` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `container` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `hour` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `id_costCenter` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `sacks` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - You are about to drop the column `wage` on the `UnitOfMeasure` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `UnitOfMeasure` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `UnitOfMeasure` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UnitOfMeasure" DROP CONSTRAINT "UnitOfMeasure_id_costCenter_fkey";

-- AlterTable
ALTER TABLE "UnitOfMeasure" DROP COLUMN "boxes",
DROP COLUMN "container",
DROP COLUMN "hour",
DROP COLUMN "id_costCenter",
DROP COLUMN "sacks",
DROP COLUMN "unit",
DROP COLUMN "wage",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_name_key" ON "UnitOfMeasure"("name");
