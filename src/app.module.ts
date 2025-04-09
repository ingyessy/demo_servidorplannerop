import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaService } from './prisma/prisma.service';
import { AreaModule } from './area/area.module';
import { LoginModule } from './login/login.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { WorkerModule } from './worker/worker.module';
import { TaskModule } from './task/task.module';
import { OperationModule } from './operation/operation.module';
import { CronJobModule } from './cron-job/cron-job.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientModule } from './client/client.module';
import { ValidationModule } from './common/validation/validation.module';
import { CalledAttentionModule } from './called-attention/called-attention.module';
import { OperationWorkerModule } from './operation-worker/operation-worker.module';
import { OperationInChargeModule } from './in-charged/in-charged.module';
import { DocsController } from './docs/docs.controller';
import { DocsModule } from './docs/docs.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtBlacklistGuard } from './auth/guards/jwt-blacklist.guard';
import { DocsAuthMiddleware } from './common/middleware/docs-auth.middleware';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60000,
    }),
    ThrottlerModule.forRoot( {  throttlers: [
      {
        ttl: 60000,
        limit: 5,
      },
    ]}),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CronJobModule,
    UserModule,
    AreaModule,
    LoginModule,
    AuthModule,
    WorkerModule,
    TaskModule,
    OperationModule,
    CronJobModule,
    ClientModule,
    ValidationModule,
    CalledAttentionModule,
    OperationWorkerModule,
    OperationInChargeModule,
    DocsModule,
  ],
  providers: [
    PrismaService,
    DocsAuthMiddleware,
    {provide: APP_GUARD, useClass: CustomThrottlerGuard},
    { provide: APP_GUARD, useClass: JwtBlacklistGuard },
  ],
  controllers: [DocsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DocsAuthMiddleware)
      .exclude(
        { path: 'login', method: RequestMethod.ALL },
        { path: 'login.html', method: RequestMethod.ALL },
      )
      .forRoutes('docs', 'docs/*path', 'api', 'api/*path');
  }
}
