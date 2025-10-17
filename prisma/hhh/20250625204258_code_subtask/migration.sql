/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `SubTask` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SubTask" ADD COLUMN     "code" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SubTask_code_key" ON "SubTask"("code");
