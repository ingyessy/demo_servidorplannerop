import { Module } from '@nestjs/common';
import { OperationService } from './operation.service';
import { OperationController } from './operation.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';
import { OperationWorkerService } from 'src/operation-worker/operation-worker.service';
import { OperationInChargeService } from 'src/in-charged/in-charged.service';

@Module({
  imports: [ValidationModule],
  controllers: [OperationController],
  providers: [OperationService, PrismaService, OperationWorkerService, OperationInChargeService],
})
export class OperationModule {}
