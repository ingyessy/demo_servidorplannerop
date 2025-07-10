import { Module } from '@nestjs/common';
import { BillService } from './bill.service';
import { BillController } from './bill.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { OperationModule } from 'src/operation/operation.module';
import { WorkerGroupAnalysisService } from './services/worker-group-analysis.service';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { ConfigurationModule } from 'src/configuration/configuration.module';

@Module({
  imports: [AuthModule, OperationModule, ConfigurationModule],
  controllers: [BillController],
  providers: [
    BillService,
    PrismaService,
    WorkerGroupAnalysisService,
    PayrollCalculationService,
  ],
})
export class BillModule {}
