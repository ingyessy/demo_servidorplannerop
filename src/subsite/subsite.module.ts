import { Module } from '@nestjs/common';
import { SubsiteService } from './subsite.service';
import { SubsiteController } from './subsite.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SubsiteController],
  providers: [SubsiteService],
})
export class SubsiteModule {}
