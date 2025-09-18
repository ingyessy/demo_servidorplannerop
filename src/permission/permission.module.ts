import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';
import { ExcelExportService } from 'src/common/validation/services/excel-export.service';

@Module({
  imports: [AuthModule],
  controllers: [PermissionController],
  providers: [PermissionService, PrismaService, ValidationService, ExcelExportService],
  
})
export class PermissionModule {}
