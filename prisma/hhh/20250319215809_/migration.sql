-- CreateEnum
CREATE TYPE "Failures" AS ENUM ('INASSISTANCE', 'IRRESPECTFUL', 'ABANDONMENT');

-- AlterTable
ALTER TABLE "CalledAttention" ADD COLUMN     "type" "Failures";
