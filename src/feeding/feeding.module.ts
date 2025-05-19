import { Module } from '@nestjs/common';
import { FeedingService } from './feeding.service';
import { FeedingController } from './feeding.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationService } from 'src/common/validation/validation.service';

@Module({
  controllers: [FeedingController],
  providers: [FeedingService, PrismaService, ValidationService],
})
export class FeedingModule {}
