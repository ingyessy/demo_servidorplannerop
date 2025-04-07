
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from 'src/auth/auth.service'; 

@Injectable()
export class DocsAuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Verificar si la ruta es de docs o api
    const isProtectedPath = req.path === '/api#' || 
                           req.path.startsWith('/api#/') || 
                           req.path === '/docs' || 
                           req.path.startsWith('/docs/');

    // Permitir siempre acceso a la página de login
    if (req.path === '/login' || req.path === '/login.html') {
      return next();
    }
    
    // Si no es una ruta protegida, continuar
    if (!isProtectedPath) {
      return next();
    }

    // Verificar token de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.redirect('/login.html');
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenInfo = this.authService.decodeToken(token);

    if (!tokenInfo.valid) {
      return res.redirect('/login.html');
    }

    // Verificar si está en lista negra
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.redirect('/login.html');
    }

    next();
  }
}