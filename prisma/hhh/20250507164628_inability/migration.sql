-- CreateEnum
CREATE TYPE "TypeDisability" AS ENUM ('INITIAL', 'EXTENSION');

-- CreateEnum
CREATE TYPE "CauseDisability" AS ENUM ('LABOR', 'TRANSIT', 'DISEASE');

-- CreateTable
CREATE TABLE "Inability" (
    "id" SERIAL NOT NULL,
    "dateDisableStart" TIMESTAMP(3) NOT NULL,
    "dateDisableEnd" TIMESTAMP(3) NOT NULL,
    "type" "TypeDisability" NOT NULL,
    "cause" "CauseDisability" NOT NULL,
    "id_worker" INTEGER NOT NULL,

    CONSTRAINT "Inability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Inability" ADD CONSTRAINT "Inability_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
