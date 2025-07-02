/*
  Warnings:

  - Added the required column `ED` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `EN` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FED` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FEN` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FOD` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FON` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `OD` to the `Tariff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ON` to the `Tariff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN     "ED" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "EN" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "FED" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "FEN" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "FOD" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "FON" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "OD" DECIMAL(4,2) NOT NULL,
ADD COLUMN     "ON" DECIMAL(4,2) NOT NULL;
