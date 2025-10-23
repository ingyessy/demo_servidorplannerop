/*
  Warnings:

  - Added the required column `updatedAt` to the `CostCenter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CostCenter" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" SERIAL NOT NULL,
    "time" TEXT NOT NULL,
    "wage" INTEGER NOT NULL,
    "container" INTEGER NOT NULL,
    "boxes" INTEGER NOT NULL,
    "unit" INTEGER NOT NULL,
    "sacks" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_costCenter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_id_costCenter_fkey" FOREIGN KEY ("id_costCenter") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
