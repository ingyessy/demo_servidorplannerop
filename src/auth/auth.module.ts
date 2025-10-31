import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { RolesGuard } from './guards/roles.guard';
import { ValidationModule } from 'src/common/validation/validation.module';

@Module({
  imports: [
    ValidationModule,
    PassportModule,
    CacheModule.register({
      ttl: 60 * 60 * 24,
      max: 100,
    }),
 JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const expires = configService.get<string>('EXPIRES_IN') || '3600';

    return {
      secret: configService.get<string>('SECRET_JWT'),
      signOptions: {
        // acepta "3600" o "1h" sin romper el tipado
        expiresIn: /^\d+$/.test(expires) ? parseInt(expires, 10) : expires,
      },
    };
  },
}),

  ],
  providers: [
    AuthService,
    JwtStrategy,
    UserService,
    RolesGuard,
  ],
  exports: [AuthService, JwtModule, RolesGuard],
})
export class AuthModule {}
