import { Module } from '@nestjs/common';
import { OperationsCronService } from './cron-job.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOperationService } from './services/update-operation.service';
import { UpdateWorkerService } from './services/update-worker.service';
import { UpdateOperationWorkerService } from './services/update-operation-worker.service';
import { BillService } from 'src/bill/bill.service';

@Module({
  providers: [
    OperationsCronService,
    PrismaService,
    UpdateOperationService,
    UpdateWorkerService,
    UpdateOperationWorkerService,
    BillService
  ],
  exports: [OperationsCronService, PrismaService],
})
export class CronJobModule {}
