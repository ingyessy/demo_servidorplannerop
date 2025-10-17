-- AlterTable
ALTER TABLE "Operation_Worker" ADD COLUMN     "id_task" INTEGER;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
