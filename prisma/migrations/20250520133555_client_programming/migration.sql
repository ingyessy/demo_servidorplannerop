-- CreateEnum
CREATE TYPE "StatusComplete" AS ENUM ('COMPLETED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "ClientProgramming" (
    "id" SERIAL NOT NULL,
    "service_request" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "dateStart" DATE NOT NULL,
    "timeStart" TEXT NOT NULL,
    "ubication" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "status" "StatusComplete" NOT NULL DEFAULT 'INCOMPLETE',
    "id_user" INTEGER NOT NULL,
    "id_operation" INTEGER,

    CONSTRAINT "ClientProgramming_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
