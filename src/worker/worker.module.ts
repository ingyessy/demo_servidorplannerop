import { forwardRef, Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { ValidationModule } from 'src/common/validation/validation.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [forwardRef (()=> ValidationModule), AuthModule ],
  controllers: [WorkerController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
