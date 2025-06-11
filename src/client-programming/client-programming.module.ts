import { Module } from '@nestjs/common';
import { ClientProgrammingService } from './client-programming.service';
import { ClientProgrammingController } from './client-programming.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [ValidationModule, AuthModule],
  controllers: [ClientProgrammingController],
  providers: [ClientProgrammingService, PrismaService],
})
export class ClientProgrammingModule {}
