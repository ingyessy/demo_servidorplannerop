-- CreateEnum
CREATE TYPE "FeedingStatus" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "WorkerFeeding" (
    "id" SERIAL NOT NULL,
    "id_worker" INTEGER NOT NULL,
    "id_operation" INTEGER NOT NULL,
    "dateFeeding" DATE NOT NULL,
    "type" "FeedingStatus" NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerFeeding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
