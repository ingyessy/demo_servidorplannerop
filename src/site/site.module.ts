import { Module } from '@nestjs/common';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
imports: [AuthModule],
  controllers: [SiteController],
  providers: [SiteService],
})
export class SiteModule {}
