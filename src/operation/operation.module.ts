import { Module } from '@nestjs/common';
import { OperationService } from './operation.service';
import { OperationController } from './operation.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';
import { OperationWorkerService } from 'src/operation-worker/operation-worker.service';
import { OperationInChargeService } from 'src/in-charged/in-charged.service';
import { OperationFinderService } from './services/operation-finder.service';
import { OperationTransformerService } from './services/operation-transformer.service';
import { OperationRelationService } from './services/operation-relation.service';
import { WorkerAnalyticsService } from 'src/operation/services/workerAnalytics.service';
import { PaginationModule } from 'src/common/services/pagination/pagination.module';

@Module({
  imports: [ValidationModule, PaginationModule],
  controllers: [OperationController],
  providers: [
    OperationService,
    PrismaService,
    OperationWorkerService,
    OperationInChargeService,
    OperationFinderService,
    OperationTransformerService,
    OperationRelationService,
    WorkerAnalyticsService
  ],
})
export class OperationModule {}
