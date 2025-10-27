-- CreateEnum
CREATE TYPE "TypeValueConfiguration" AS ENUM ('INT', 'DECIMAL', 'STRING', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "YES_NO" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "TypeDisability" AS ENUM ('INITIAL', 'EXTENSION');

-- CreateEnum
CREATE TYPE "CauseDisability" AS ENUM ('LABOR', 'TRANSIT', 'DISEASE');

-- CreateEnum
CREATE TYPE "FeedingStatus" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERADMIN', 'GH', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('AVALIABLE', 'ASSIGNED', 'UNAVALIABLE', 'DEACTIVATED', 'DISABLE', 'PERMISSION');

-- CreateEnum
CREATE TYPE "StatusOperation" AS ENUM ('PENDING', 'INPROGRESS', 'COMPLETED', 'CANCELED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Failures" AS ENUM ('INASSISTANCE', 'IRRESPECTFUL', 'ABANDONMENT');

-- CreateEnum
CREATE TYPE "StatusComplete" AS ENUM ('COMPLETED', 'INCOMPLETE', 'UNASSIGNED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "StatusActivation" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "dni" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "occupation" TEXT NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "id_site" INTEGER DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobArea" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_user" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "id_site" INTEGER NOT NULL DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "JobArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "dni" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'AVALIABLE',
    "id_area" INTEGER,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER NOT NULL,
    "code" TEXT,
    "payroll_code" TEXT,
    "dateDisableEnd" TIMESTAMP(3),
    "dateDisableStart" TIMESTAMP(3),
    "dateRetierment" TIMESTAMP(3),
    "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "id_site" INTEGER NOT NULL DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" SERIAL NOT NULL,
    "status" "StatusOperation" NOT NULL DEFAULT 'PENDING',
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE,
    "timeStrat" TEXT NOT NULL,
    "timeEnd" TEXT,
    "id_user" INTEGER NOT NULL,
    "id_area" INTEGER NOT NULL,
    "id_task" INTEGER,
    "id_client" INTEGER NOT NULL,
    "motorShip" TEXT,
    "zone" INTEGER NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_clientProgramming" INTEGER,
    "op_duration" DOUBLE PRECISION DEFAULT 0,
    "id_site" INTEGER NOT NULL DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation_Worker" (
    "id" SERIAL NOT NULL,
    "id_operation" INTEGER NOT NULL,
    "id_worker" INTEGER NOT NULL,
    "dateEnd" DATE,
    "dateStart" DATE,
    "timeEnd" TEXT,
    "timeStart" TEXT,
    "id_group" TEXT,
    "id_task" INTEGER,
    "id_subtask" INTEGER,
    "id_tariff" INTEGER,

    CONSTRAINT "Operation_Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_user" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "id_site" INTEGER NOT NULL DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubTask" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "id_task" INTEGER NOT NULL,
    "id_subsite" INTEGER NOT NULL,
    "id_client" INTEGER NOT NULL,

    CONSTRAINT "SubTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_user" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalledAttention" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "id_user" INTEGER NOT NULL,
    "dni_worker" TEXT NOT NULL,
    "type" "Failures",
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalledAttention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InChargeOperation" (
    "id" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_operation" INTEGER NOT NULL,

    CONSTRAINT "InChargeOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerFeeding" (
    "id" SERIAL NOT NULL,
    "id_worker" INTEGER NOT NULL,
    "id_operation" INTEGER NOT NULL,
    "dateFeeding" DATE NOT NULL,
    "type" "FeedingStatus" NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER,

    CONSTRAINT "WorkerFeeding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inability" (
    "id" SERIAL NOT NULL,
    "dateDisableStart" DATE NOT NULL,
    "dateDisableEnd" DATE NOT NULL,
    "type" "TypeDisability" NOT NULL,
    "cause" "CauseDisability" NOT NULL,
    "id_worker" INTEGER NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_user" INTEGER NOT NULL,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "dateDisableStart" DATE NOT NULL,
    "dateDisableEnd" DATE NOT NULL,
    "timeStart" TEXT NOT NULL,
    "timeEnd" TEXT NOT NULL,
    "id_worker" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "observation" TEXT,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProgramming" (
    "id" SERIAL NOT NULL,
    "service_request" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "dateStart" DATE NOT NULL,
    "timeStart" TEXT NOT NULL,
    "ubication" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "status" "StatusComplete" NOT NULL DEFAULT 'UNASSIGNED',
    "id_user" INTEGER NOT NULL,
    "id_site" INTEGER NOT NULL DEFAULT 1,
    "id_subsite" INTEGER,

    CONSTRAINT "ClientProgramming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER DEFAULT 36,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_site" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "SubSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_client" INTEGER NOT NULL,
    "id_subsite" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_user" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "id_subtask" INTEGER NOT NULL,
    "id_costCenter" INTEGER NOT NULL,
    "id_unidOfMeasure" INTEGER NOT NULL,
    "id_facturation_unit" INTEGER,
    "paysheet_tariff" DECIMAL(10,2) NOT NULL,
    "facturation_tariff" DECIMAL(10,2) NOT NULL,
    "full_tariff" "YES_NO" NOT NULL,
    "compensatory" "YES_NO" NOT NULL,
    "alternative_paid_service" "YES_NO" NOT NULL,
    "group_tariff" "YES_NO" NOT NULL DEFAULT 'NO',
    "settle_payment" "YES_NO" NOT NULL DEFAULT 'NO',
    "pay_units" DECIMAL(4,2),
    "agreed_hours" DECIMAL(4,2),
    "OD" DECIMAL(4,2) NOT NULL,
    "ON" DECIMAL(4,2) NOT NULL,
    "ED" DECIMAL(4,2) NOT NULL,
    "EN" DECIMAL(4,2) NOT NULL,
    "FOD" DECIMAL(4,2) NOT NULL,
    "FON" DECIMAL(4,2) NOT NULL,
    "FED" DECIMAL(4,2) NOT NULL,
    "FEN" DECIMAL(4,2) NOT NULL,
    "FAC_OD" DECIMAL(4,2) NOT NULL,
    "FAC_ON" DECIMAL(4,2) NOT NULL,
    "FAC_ED" DECIMAL(4,2) NOT NULL,
    "FAC_EN" DECIMAL(4,2) NOT NULL,
    "FAC_FOD" DECIMAL(4,2) NOT NULL,
    "FAC_FON" DECIMAL(4,2) NOT NULL,
    "FAC_FED" DECIMAL(4,2) NOT NULL,
    "FAC_FEN" DECIMAL(4,2) NOT NULL,
    "id_user" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "typeValue" "TypeValueConfiguration" NOT NULL,
    "value" TEXT NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "id_operation" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "number_of_workers" INTEGER NOT NULL,
    "total_bill" DECIMAL(10,2) NOT NULL,
    "total_paysheet" DECIMAL(10,2) NOT NULL,
    "week_number" INTEGER NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'ACTIVE',
    "number_of_hours" DECIMAL(4,2),
    "HOD" DECIMAL(4,2),
    "HON" DECIMAL(4,2),
    "HED" DECIMAL(4,2),
    "HEN" DECIMAL(4,2),
    "HFOD" DECIMAL(4,2),
    "HFON" DECIMAL(4,2),
    "HFED" DECIMAL(4,2),
    "HFEN" DECIMAL(4,2),
    "FAC_HOD" DECIMAL(4,2),
    "FAC_HON" DECIMAL(4,2),
    "FAC_HED" DECIMAL(4,2),
    "FAC_HEN" DECIMAL(4,2),
    "FAC_HFOD" DECIMAL(4,2),
    "id_group" TEXT,
    "FAC_HFON" DECIMAL(4,2),
    "FAC_HFED" DECIMAL(4,2),
    "FAC_HFEN" DECIMAL(4,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id_user" INTEGER NOT NULL,
    "group_hours" INTEGER,
    "observation" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillDetail" (
    "id" SERIAL NOT NULL,
    "id_bill" INTEGER NOT NULL,
    "id_operation_worker" INTEGER NOT NULL,
    "pay_unit" DECIMAL(4,2),
    "pay_rate" DECIMAL(10,2),
    "total_bill" DECIMAL(10,2),
    "total_paysheet" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_dni_key" ON "Worker"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_payroll_code_key" ON "Worker"("payroll_code");

-- CreateIndex
CREATE UNIQUE INDEX "Task_name_key" ON "Task"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubTask_code_key" ON "SubTask"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_name_key" ON "UnitOfMeasure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_code_key" ON "Tariff"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArea" ADD CONSTRAINT "JobArea_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArea" ADD CONSTRAINT "JobArea_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobArea" ADD CONSTRAINT "JobArea_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "JobArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "JobArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_clientProgramming_fkey" FOREIGN KEY ("id_clientProgramming") REFERENCES "ClientProgramming"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_subtask_fkey" FOREIGN KEY ("id_subtask") REFERENCES "SubTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_tariff_fkey" FOREIGN KEY ("id_tariff") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation_Worker" ADD CONSTRAINT "Operation_Worker_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalledAttention" ADD CONSTRAINT "CalledAttention_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalledAttention" ADD CONSTRAINT "CalledAttention_dni_worker_fkey" FOREIGN KEY ("dni_worker") REFERENCES "Worker"("dni") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InChargeOperation" ADD CONSTRAINT "InChargeOperation_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InChargeOperation" ADD CONSTRAINT "InChargeOperation_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFeeding" ADD CONSTRAINT "WorkerFeeding_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inability" ADD CONSTRAINT "Inability_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inability" ADD CONSTRAINT "Inability_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_id_worker_fkey" FOREIGN KEY ("id_worker") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProgramming" ADD CONSTRAINT "ClientProgramming_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSite" ADD CONSTRAINT "SubSite_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_id_subsite_fkey" FOREIGN KEY ("id_subsite") REFERENCES "SubSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_subtask_fkey" FOREIGN KEY ("id_subtask") REFERENCES "SubTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_costCenter_fkey" FOREIGN KEY ("id_costCenter") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_unidOfMeasure_fkey" FOREIGN KEY ("id_unidOfMeasure") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_facturation_unit_fkey" FOREIGN KEY ("id_facturation_unit") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_id_operation_fkey" FOREIGN KEY ("id_operation") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_id_bill_fkey" FOREIGN KEY ("id_bill") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDetail" ADD CONSTRAINT "BillDetail_id_operation_worker_fkey" FOREIGN KEY ("id_operation_worker") REFERENCES "Operation_Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
