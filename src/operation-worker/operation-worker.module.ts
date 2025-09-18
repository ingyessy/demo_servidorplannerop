import { Module } from '@nestjs/common';
import { OperationWorkerService } from './operation-worker.service';
import { OperationWorkerController } from './operation-worker.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { ValidationModule } from 'src/common/validation/validation.module';
import { RemoveWorkerFromOperationService } from './service/remove-worker-from-operation/remove-worker-from-operation.service';
import { UpdateWorkerSheduleService } from './service/update-worker-shedule/update-worker-shedule.service';
import { AssignWorkerToOperationService } from './service/assign-worker-to-operation/assign-worker-to-operation.service';
import { WorkerModule } from 'src/worker/worker.module';

@Module({
  imports: [AuthModule, ValidationModule, WorkerModule],
  controllers: [OperationWorkerController],
  providers: [
    OperationWorkerService,
    PrismaService,
    RemoveWorkerFromOperationService,
    UpdateWorkerSheduleService,
    AssignWorkerToOperationService,
  ],
  exports: [
    OperationWorkerService,
    RemoveWorkerFromOperationService,
    UpdateWorkerSheduleService,
    AssignWorkerToOperationService,
  ],
})
export class OperationWorkerModule {}
