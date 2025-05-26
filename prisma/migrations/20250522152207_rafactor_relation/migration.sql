-- DropForeignKey
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_id_task_fkey";

-- AlterTable
ALTER TABLE "Operation" ALTER COLUMN "id_task" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
