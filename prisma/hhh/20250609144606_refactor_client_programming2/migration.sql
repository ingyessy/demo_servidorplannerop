-- AlterTable
ALTER TABLE "ClientProgramming" ADD COLUMN     "id_site" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
