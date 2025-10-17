-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ClientProgramming" ADD COLUMN     "id_site" INTEGER;

-- AlterTable
ALTER TABLE "JobArea" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArea" ADD CONSTRAINT "JobArea_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
