/*
  Warnings:

  - Added the required column `id_user` to the `Inability` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updateAt` to the `Inability` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Inability" ADD COLUMN     "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_user" INTEGER NOT NULL,
ADD COLUMN     "updateAt" TIMESTAMP(3) NOT NULL;

-- AddForeignKey
ALTER TABLE "Inability" ADD CONSTRAINT "Inability_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
