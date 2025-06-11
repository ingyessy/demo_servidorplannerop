import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class SiteGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization;
    
    if (!token) {
      throw new ForbiddenException('Token not provided');
    }

    const decodedResult = this.authService.decodeToken(token);
    
    if (!decodedResult.valid) {
      throw new ForbiddenException('Invalid token');
    }

    return true;
  }
}