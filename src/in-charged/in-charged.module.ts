import { Module } from '@nestjs/common';
import { OperationInChargeService } from './in-charged.service';
import { OperationInChargeController } from './in-charged.controller';
import { ValidationService } from '../common/validation/validation.service';

@Module({
  controllers: [OperationInChargeController],
  providers: [OperationInChargeService, ValidationService],
  exports: [OperationInChargeService],
})
export class OperationInChargeModule {}