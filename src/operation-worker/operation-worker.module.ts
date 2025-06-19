import { Module } from '@nestjs/common';
import { OperationWorkerService } from './operation-worker.service';
import { OperationWorkerController } from './operation-worker.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OperationWorkerController],
  providers: [OperationWorkerService, PrismaService, ValidationService],
  exports: [OperationWorkerService],
})
export class OperationWorkerModule {}
