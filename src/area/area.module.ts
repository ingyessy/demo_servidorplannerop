import { Module } from '@nestjs/common';
import { AreaService } from './area.service';
import { AreaController } from './area.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AreaController],
  providers: [AreaService, PrismaService, UserService],
})
export class AreaModule {}
