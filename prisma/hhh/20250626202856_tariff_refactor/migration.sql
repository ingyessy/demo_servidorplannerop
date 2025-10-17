-- AlterTable
ALTER TABLE "Operation_Worker" ADD COLUMN     "id_tariff" INTEGER;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_tariff_fkey" FOREIGN KEY ("id_tariff") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
