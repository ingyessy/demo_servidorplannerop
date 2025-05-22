import { Module } from '@nestjs/common';
import { ClientProgrammingService } from './client-programming.service';
import { ClientProgrammingController } from './client-programming.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';

@Module({
  imports: [ValidationModule],
  controllers: [ClientProgrammingController],
  providers: [ClientProgrammingService, PrismaService],
})
export class ClientProgrammingModule {}
