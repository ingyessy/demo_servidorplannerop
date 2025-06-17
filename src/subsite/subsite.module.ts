import { Module } from '@nestjs/common';
import { SubsiteService } from './subsite.service';
import { SubsiteController } from './subsite.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [SubsiteController],
  providers: [SubsiteService, PrismaService],
})
export class SubsiteModule {}
