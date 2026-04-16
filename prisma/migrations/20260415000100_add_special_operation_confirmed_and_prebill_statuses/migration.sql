-- Add rejection status for special operations
ALTER TYPE "StatusOperation" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Add prebill lifecycle statuses
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'TO_APPROVED';
