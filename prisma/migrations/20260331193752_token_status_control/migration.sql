-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "usedAt" TIMESTAMP(3);
