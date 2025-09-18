import { Module } from '@nestjs/common';
import { OperationsCronService } from './cron-job.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateOperationService } from './services/update-operation.service';
import { UpdateWorkerService } from './services/update-worker.service';
import { UpdateOperationWorkerService } from './services/update-operation-worker.service';
import { BillService } from 'src/bill/bill.service';
import { OperationModule } from 'src/operation/operation.module';
import { BillModule } from 'src/bill/bill.module';
import { UpdatePermissionService } from 'src/permission/services/update-permission.service';
import { UpdateInabilityService } from 'src/inability/service/update-inability.service';
import { CancelledOperationsCleanupService } from './services/cancelled-operations-cleanup.service';
@Module({
  imports: [
    OperationModule, 
    BillModule,
  ],
  providers: [
    OperationsCronService,
    PrismaService,
    UpdateOperationService,
    UpdateWorkerService,
    UpdateOperationWorkerService,
    UpdatePermissionService,
    UpdateInabilityService,
    CancelledOperationsCleanupService,
    // BillService
  ],
  exports: [OperationsCronService, PrismaService, UpdateOperationService, CancelledOperationsCleanupService],
})
export class CronJobModule {}
