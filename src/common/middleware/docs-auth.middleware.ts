import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from 'src/auth/auth.service'; 

@Injectable()
export class DocsAuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Verificar la URL completa
    const url = (req.originalUrl || req.url).toLowerCase();
    
    // Permitir siempre acceso a la página de login y recursos estáticos necesarios
    if (url === '/login' || url === '/login.html' || 
        url.includes('.css') || url.includes('.js') || 
        url.includes('.ico') || url.includes('.png')) {
      return next();
    }
    
    // Verificar si la ruta es de docs o api
    const isProtectedPath = url.startsWith('/docs') || url.startsWith('/api');
    
    // Si no es una ruta protegida, continuar
    if (!isProtectedPath) {
      return next();
    }

    // Intentar obtener token de diferentes fuentes
    let token;
    
    // 1. Verificar en cookies
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    } 
    // 2. Verificar en headers de autorización  
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    // 3. Verificar en query string (URL)
    else if (req.query.token) {
      token = req.query.token as string;
    }
    
    // Si no hay token por ningún método, redirigir a login
    if (!token) {
      return res.redirect('/login.html');
    }

    // Verificar si el token es válido
    try {
      const tokenInfo = this.authService.decodeToken(token);

      if (!tokenInfo.valid) {
        return res.redirect('/login.html');
      }

      // Verificar si está en lista negra
      const isBlacklisted = await this.authService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return res.redirect('/login.html');
      }
      
      // Añadir el payload decodificado a la solicitud para uso posterior
      req['user'] = tokenInfo.decoded;
      
      next();
    } catch (error) {
      // Si hay cualquier error, redirigir a login
      return res.redirect('/login.html');
    }
  }
}