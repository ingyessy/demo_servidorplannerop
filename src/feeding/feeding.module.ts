import { Module } from '@nestjs/common';
import { FeedingService } from './feeding.service';
import { FeedingController } from './feeding.controller';
import { ValidationService } from 'src/common/validation/validation.service';
import { PaginationModule } from 'src/common/services/pagination/pagination.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PaginationModule, AuthModule],
  controllers: [FeedingController],
  providers: [FeedingService, ValidationService],
})
export class FeedingModule {}
