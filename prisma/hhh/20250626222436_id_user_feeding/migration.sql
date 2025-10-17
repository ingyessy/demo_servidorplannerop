-- AlterTable
ALTER TABLE "WorkerFeeding" ADD COLUMN     "id_user" INTEGER;

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
