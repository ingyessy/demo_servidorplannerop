/*
  Warnings:

  - A unique constraint covering the columns `[payroll_code]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "payroll_code" TEXT,
ALTER COLUMN "code" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_payroll_code_key" ON "Worker"("payroll_code");
