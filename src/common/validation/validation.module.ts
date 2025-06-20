import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExcelExportService } from './services/excel-export.service';
import { ValidationWorkerService } from './services/validation-worker/validation-worker.service';
import { ValidationClientProgrammingService } from './services/validation-client-programming/validation-client-programming.service';
import { ValidationTaskAndSubtaskService } from './services/validation-task-and-subtask/validation-task-and-subtask.service';

@Module({
  providers: [
    ValidationService,
    PrismaService,
    ExcelExportService,
    ValidationWorkerService,
    ValidationClientProgrammingService,
    ValidationTaskAndSubtaskService,
  ],
  exports: [
    ValidationService,
    ExcelExportService,
    ValidationWorkerService,
    ValidationClientProgrammingService,
    ValidationTaskAndSubtaskService,
  ],
})
export class ValidationModule {}
