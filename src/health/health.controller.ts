import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller()
export class HealthController {
  @Get('ping')
  @Public()  // Hace que no necesite token
  ping() {
    return { status: 'ok' };
  }
}
