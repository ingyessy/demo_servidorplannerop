import { Module } from '@nestjs/common';
import { OperationInChargeService } from './in-charged.service';
import { OperationInChargeController } from './in-charged.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../common/validation/validation.service';

@Module({
  controllers: [OperationInChargeController],
  providers: [OperationInChargeService, PrismaService, ValidationService],
  exports: [OperationInChargeService],
})
export class OperationInChargeModule {}