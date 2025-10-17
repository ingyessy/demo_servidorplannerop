-- CreateTable
CREATE TABLE "CalledAttention" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "id_user" INTEGER NOT NULL,
    "id_worker" INTEGER NOT NULL,

    CONSTRAINT "CalledAttention_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CalledAttention" ADD CONSTRAINT "CalledAttention_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalledAttention" ADD CONSTRAINT "CalledAttention_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
