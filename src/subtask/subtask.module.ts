import { Module } from '@nestjs/common';
import { SubtaskService } from './subtask.service';
import { SubtaskController } from './subtask.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';

@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [SubtaskController],
  providers: [SubtaskService, PrismaService],
})
export class SubtaskModule {}
