/*
  Warnings:

  - You are about to drop the column `id_operation` on the `ClientProgramming` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientProgramming" DROP CONSTRAINT "ClientProgramming_id_operation_fkey";

-- AlterTable
ALTER TABLE "ClientProgramming" DROP COLUMN "id_operation";

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "id_clientProgramming" INTEGER;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_clientProgramming_fkey" FOREIGN KEY ("id_clientProgramming") REFERENCES "ClientProgramming"("id") ON DELETE SET NULL ON UPDATE CASCADE;
