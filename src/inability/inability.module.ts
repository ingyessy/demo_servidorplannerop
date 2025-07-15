import { Module } from '@nestjs/common';
import { InabilityService } from './inability.service';
import { InabilityController } from './inability.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';

@Module({
  controllers: [InabilityController],
  providers: [InabilityService, PrismaService, ValidationService, ExcelExportService],
})
export class InabilityModule {}
