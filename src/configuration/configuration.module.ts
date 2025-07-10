import { Module } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [ConfigurationController],
  providers: [ConfigurationService, PrismaService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
