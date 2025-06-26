import { Module } from '@nestjs/common';
import { CostCenterService } from './cost-center.service';
import { CostCenterController } from './cost-center.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';

@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [CostCenterController],
  providers: [CostCenterService, PrismaService],
})
export class CostCenterModule {}
