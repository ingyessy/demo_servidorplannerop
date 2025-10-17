-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_id_site_fkey";

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "id_site" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
