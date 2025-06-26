import { Module } from '@nestjs/common';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
imports: [AuthModule],
  controllers: [SiteController],
  providers: [SiteService, PrismaService],
})
export class SiteModule {}
