-- CreateTable
CREATE TABLE "SubTask" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "id_task" INTEGER NOT NULL,

    CONSTRAINT "SubTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
