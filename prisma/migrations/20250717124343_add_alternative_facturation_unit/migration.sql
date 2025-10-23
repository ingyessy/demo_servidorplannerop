/*
  Warnings:

  - You are about to drop the column `hourly_paid_service` on the `Tariff` table. All the data in the column will be lost.
  - Added the required column `alternative_paid_service` to the `Tariff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tariff" DROP COLUMN "hourly_paid_service",
ADD COLUMN     "alternative_paid_service" "YES_NO" NOT NULL;
