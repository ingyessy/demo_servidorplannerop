-- CreateEnum
CREATE TYPE "YES_NO" AS ENUM ('YES', 'NO');

-- CreateTable
CREATE TABLE "Tariff" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "id_subtask" INTEGER NOT NULL,
    "id_costCenter" INTEGER NOT NULL,
    "id_unidOfMeasure" INTEGER NOT NULL,
    "paysheet_tariff" INTEGER NOT NULL,
    "facturation_tariff" INTEGER NOT NULL,
    "full_tariff" "YES_NO" NOT NULL,
    "compensatory" "YES_NO" NOT NULL,
    "hourly_paid_service" "YES_NO" NOT NULL,
    "id_user" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_code_key" ON "Tariff"("code");

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_subtask_fkey" FOREIGN KEY ("id_subtask") REFERENCES "SubTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_costCenter_fkey" FOREIGN KEY ("id_costCenter") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_unidOfMeasure_fkey" FOREIGN KEY ("id_unidOfMeasure") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
