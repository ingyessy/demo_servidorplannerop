-- Rename observation to clientObservation and add supervisorObservation
ALTER TABLE "OperationConfirmation" RENAME COLUMN "observation" TO "clientObservation";
ALTER TABLE "OperationConfirmation" ADD COLUMN "supervisorObservation" TEXT;
