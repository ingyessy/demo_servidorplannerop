import { Module } from '@nestjs/common';
import { CalledAttentionService } from './called-attention.service';
import { CalledAttentionController } from './called-attention.controller';
import { ValidationModule } from 'src/common/validation/validation.module';
import { PaginationModule } from 'src/common/services/pagination/pagination.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [ValidationModule, PaginationModule, AuthModule],
  controllers: [CalledAttentionController],
  providers: [CalledAttentionService],
})
export class CalledAttentionModule {}
