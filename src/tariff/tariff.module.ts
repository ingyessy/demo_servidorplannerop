import { Module } from '@nestjs/common';
import { TariffService } from './tariff.service';
import { TariffController } from './tariff.controller';
import { AuthModule } from 'src/auth/auth.module';
import { ValidationModule } from 'src/common/validation/validation.module';
import { TariffTransformerService } from './service/tariff-transformer.service';

@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [TariffController],
  providers: [TariffService, TariffTransformerService],
  exports: [TariffTransformerService],
})
export class TariffModule {}
