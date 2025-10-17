/*
  Warnings:

  - Added the required column `typeValue` to the `Configuration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `Configuration` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TypeValueConfiguration" AS ENUM ('INT', 'DECIMAL', 'STRING', 'BOOLEAN', 'DATE');

-- AlterTable
ALTER TABLE "Configuration" ADD COLUMN     "description" TEXT,
ADD COLUMN     "typeValue" "TypeValueConfiguration" NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "id_operation" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "number_of_workers" INTEGER NOT NULL,
    "total_bill" INTEGER NOT NULL,
    "total_paysheet" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "number_of_hours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
