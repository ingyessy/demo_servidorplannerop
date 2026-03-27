import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class OperationTokenService {
  generateTokenValue(): string {
    return randomBytes(24).toString('hex');
  }

  buildConfirmationLink(token: string): string {
    const frontendBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'https://cargoban.com.co';

    const encodedToken = encodeURIComponent(token);
    return `${frontendBaseUrl.replace(/\/$/, '')}/confirm-operation?token=${encodedToken}`;
  }
}
