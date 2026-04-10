import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class OperationTokenService {
  // Genera el token que se entrega al cliente (valor plano para URL).
  generateTokenValue(): string {
    return randomBytes(32).toString('hex');
  }

  // Se persiste el hash del token para seguridad 
  hashTokenValue(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Construye el link final que consumirá el portal de confirmación.
  buildConfirmationLink(token: string): string {
    const confirmationPageUrl =
      process.env.OPERATION_CONFIRMATION_PAGE_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://192.168.15.68:5173/cargoplannerweb/confirm-operation';

    // El token viaja en query porque el portal de confirmación ya espera ese formato.
    const encodedToken = encodeURIComponent(token);
    const separator = confirmationPageUrl.includes('?') ? '&' : '?';
    return `${confirmationPageUrl.replace(/\/$/, '')}${separator}token=${encodedToken}`;
  }
}
