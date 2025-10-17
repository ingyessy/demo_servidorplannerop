/*
  Warnings:

  - You are about to alter the column `total_bill` on the `Bill` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - You are about to alter the column `total_paysheet` on the `Bill` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Bill" ALTER COLUMN "total_bill" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_paysheet" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN     "group_tariff" "YES_NO" NOT NULL DEFAULT 'NO',
ADD COLUMN     "pay_units" DECIMAL(4,2);

-- CreateTable
CREATE TABLE "BillDetail" (
    "id" SERIAL NOT NULL,
    "id_bill" INTEGER NOT NULL,
    "observation" TEXT NOT NULL,
    "id_operation_worker" INTEGER NOT NULL,
    "pay_unit" DECIMAL(4,2),
    "pay_rate" DECIMAL(4,2),
    "total_bill" DECIMAL(10,2),
    "total_paysheet" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillDetail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_id_bill_fkey" FOREIGN KEY ("id_bill") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_id_operation_worker_fkey" FOREIGN KEY ("id_operation_worker") REFERENCES "Operation_Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
