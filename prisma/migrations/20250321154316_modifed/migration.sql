-- CreateTable
CREATE TABLE "InChargeOperation" (
    "id" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_operation" INTEGER NOT NULL,

    CONSTRAINT "InChargeOperation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InChargeOperation" ADD CONSTRAINT "InChargeOperation_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InChargeOperation" ADD CONSTRAINT "InChargeOperation_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
