import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExcelExportService } from './services/excel-export.service';


@Module({
  providers: [ValidationService, PrismaService, ExcelExportService],
  exports: [ValidationService, ExcelExportService],
})
export class ValidationModule {}