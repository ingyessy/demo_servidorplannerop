import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
@Controller()
export class DocsController {
  @Get('login')
  @Public()
  getLoginPage(@Res() res: Response) {
    return res.redirect('/login.html'); // Redirige a la página de login
  }

  @Get('docs')
  getDocs(@Res() res: Response) {
    return res.redirect('/docs/index.html'); // Asumiendo que tienes un index.html en la carpeta docs
  }
}