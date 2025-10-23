-- CreateTable
CREATE TABLE "SubSite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "id_site" INTEGER NOT NULL,
    "status" "StatusActivation" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "SubSite_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubSite" ADD CONSTRAINT "SubSite_id_site_fkey" FOREIGN KEY ("id_site") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
