import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { ValidationModule } from 'src/common/validation/validation.module';


@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [UserController],
  providers: [UserService, PrismaService ],
  exports: [UserService ],
})
export class UserModule {}
