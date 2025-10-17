-- AlterTable
ALTER TABLE "Operation_Worker" ADD COLUMN     "id_subtask" INTEGER;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_subtask_fkey" FOREIGN KEY ("id_subtask") REFERENCES "SubTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
