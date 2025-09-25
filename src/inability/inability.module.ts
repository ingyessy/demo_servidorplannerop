import { Module } from '@nestjs/common';
import { InabilityService } from './inability.service';
import { InabilityController } from './inability.controller';
import { ValidationService } from 'src/common/validation/validation.service';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InabilityController],
  providers: [InabilityService, ValidationService, ExcelExportService],
})
export class InabilityModule {}
