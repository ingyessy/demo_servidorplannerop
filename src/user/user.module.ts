import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { ValidationUserSiteService } from './service/validation-user-site/validation-user-site.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, PrismaService, ValidationUserSiteService],
  exports: [UserService, ValidationUserSiteService],
})
export class UserModule {}
