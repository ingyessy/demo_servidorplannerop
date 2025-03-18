import { Module } from '@nestjs/common';
import { CalledAttentionService } from './called-attention.service';
import { CalledAttentionController } from './called-attention.controller';

@Module({
  controllers: [CalledAttentionController],
  providers: [CalledAttentionService],
})
export class CalledAttentionModule {}
