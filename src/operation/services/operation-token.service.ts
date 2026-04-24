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

    const normalizedBaseUrl = confirmationPageUrl.trim().replace(/\/$/, '');

    // Soporta URLs base con o sin query previa y evita token duplicado.
    try {
      const url = new URL(normalizedBaseUrl);
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      const baseWithoutToken = normalizedBaseUrl
        .replace(/([?&])token=[^&]*/gi, '$1')
        .replace(/[?&]$/, '');
      const separator = baseWithoutToken.includes('?') ? '&' : '?';
      return `${baseWithoutToken}${separator}token=${encodeURIComponent(token)}`;
    }
  }
}
