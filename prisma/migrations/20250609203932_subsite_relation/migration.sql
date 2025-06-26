-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "ClientProgramming" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "JobArea" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "id_subsite" INTEGER;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "id_subsite" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArea" ADD CONSTRAINT "JobArea_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
