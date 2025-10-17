/*
  Warnings:

  - You are about to drop the column `id_subtask` on the `Operation_Worker` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Operation_Worker" DROP CONSTRAINT "Operation_Worker_id_subtask_fkey";

-- AlterTable
ALTER TABLE "Operation_Worker" DROP COLUMN "id_subtask";
