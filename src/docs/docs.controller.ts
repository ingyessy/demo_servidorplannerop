import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { Public } from '../auth/decorators/public.decorator';
@Controller()
export class DocsController {
  @Get('login')
  @Public()
  getLoginPage(@Res() res: Response) {
    return res.redirect('/login.html'); // Redirige a la página de login
  }

  @Get('docs')
  // Sin decorador @Public() - esta ruta quedará protegida
  getDocs(@Res() res: Response) {
    // Esta ruta está protegida por el guard
    // Los archivos estáticos se servirán desde la configuración en main.ts
    return res.redirect('/docs/index.html'); // Asumiendo que tienes un index.html en la carpeta docs
  }
}