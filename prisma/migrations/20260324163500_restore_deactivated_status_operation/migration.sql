-- Restore enum value accidentally removed in previous migration
ALTER TYPE "StatusOperation" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
