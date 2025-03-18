import { Module } from '@nestjs/common';
import { CalledAttentionService } from './called-attention.service';
import { CalledAttentionController } from './called-attention.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationModule } from 'src/common/validation/validation.module';

@Module({
  imports: [ValidationModule],
  controllers: [CalledAttentionController],
  providers: [CalledAttentionService, PrismaService],
})
export class CalledAttentionModule {}
