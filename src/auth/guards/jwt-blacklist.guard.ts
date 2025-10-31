import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../auth.service';
@Injectable()
export class JwtBlacklistGuard extends JwtAuthGuard {
  constructor(
    protected reflector: Reflector,
    private authService: AuthService,
    protected configService: ConfigService,
  ) {
    super(reflector, configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Primero verifica con el JwtAuthGuard estándar
    const canActivate = await super.canActivate(context);
    
    if (!canActivate) return false;
    
    
    // Si es válido, verifica que no esté en la lista negra
    const request = context.switchToHttp().getRequest();
        const authHeader: string = request.headers?.authorization ?? '';

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

       // Si por alguna razón no hay token (no debería pasar si super.canActivate() fue true), continúa
    if (!token) return true;
    
    // 3) Verifica si el token está en blacklist
    try {
      const isBlacklisted = await this.authService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    } catch (err) {
      // Falla segura: si hay error consultando el cache, deniega el acceso
      // (puedes registrar el error si lo prefieres)
      throw new UnauthorizedException('Error validating token');
    }
    
    return true;
  }
}