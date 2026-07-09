import { Module } from '@nestjs/common';
import { ClientEmailService } from './client-email.service';
import { ClientEmailController } from './client-email.controller';

@Module({
  controllers: [ClientEmailController],
  providers: [ClientEmailService],
})
export class ClientEmailModule {}
