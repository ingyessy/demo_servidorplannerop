-- CreateEnum
CREATE TYPE "StatusActivation" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "StatusOperation" ADD VALUE 'DEACTIVATED';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "JobArea" ADD COLUMN     "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE';
