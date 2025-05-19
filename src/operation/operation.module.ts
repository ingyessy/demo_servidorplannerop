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
import { PaginationService } from 'src/common/services/pagination.service';

@Module({
  imports: [ValidationModule],
  controllers: [OperationController],
  providers: [
    OperationService,
    PrismaService,
    OperationWorkerService,
    OperationInChargeService,
    OperationFinderService,
    PaginationService,
    OperationTransformerService,
    OperationRelationService,
  ],
})
export class OperationModule {}
