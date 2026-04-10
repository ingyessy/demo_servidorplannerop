import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type SendConfirmationEmailParams = {
  to: string;
  operationId: number;
  confirmationLink: string;
  clientLabel?: string | null;
  tokenTtlMinutes: number;
};

type SendConfirmationEmailResult = {
  sent: boolean;
  reason?: string;
  messageId?: string;
};

@Injectable()
export class OperationEmailService {
  private readonly logger = new Logger(OperationEmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  async sendSpecialOperationConfirmationEmail(
    params: SendConfirmationEmailParams,
  ): Promise<SendConfirmationEmailResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        sent: false,
        reason: 'SMTP no configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM.',
      };
    }

    if (!this.isValidEmail(params.to)) {
      return {
        sent: false,
        reason: `Correo destino invalido: ${params.to}`,
      };
    }

    const from = this.getFromAddress();
    const subjectPrefix = process.env.CONFIRMATION_EMAIL_SUBJECT_PREFIX || 'PlannerOP';
    const subject = `[${subjectPrefix}] Confirmacion de operacion #${params.operationId}`;

    const intro = params.clientLabel
      ? `Hola ${params.clientLabel},`
      : 'Hola,';

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 12px;">Confirmacion de operacion especial</h2>
        <p>${intro}</p>
        <p>
          La operacion <strong>#${params.operationId}</strong> esta pendiente de su validacion.
          Use el siguiente enlace para <strong>aprobar</strong> o <strong>rechazar</strong> el servicio.
        </p>
        <p>
          <a href="${params.confirmationLink}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;">Abrir confirmacion</a>
        </p>
        <p style="font-size: 12px; color: #6b7280;">
          Este enlace expira en ${params.tokenTtlMinutes} minutos.
        </p>
      </div>
    `;

    const text = [
      intro,
      '',
      `La operacion #${params.operationId} esta pendiente de su validacion.`,
      'Use este enlace para aprobar o rechazar el servicio:',
      params.confirmationLink,
      '',
      `Este enlace expira en ${params.tokenTtlMinutes} minutos.`,
    ].join('\n');

    try {
      const info = await transporter.sendMail({
        from,
        to: params.to,
        subject,
        text,
        html,
      });

      this.logger.log(
        `Correo de confirmacion enviado para operacion ${params.operationId} a ${params.to}`,
      );

      return {
        sent: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      this.logger.error(
        `No se pudo enviar correo de confirmacion para operacion ${params.operationId}: ${error?.message || 'unknown error'}`,
      );
      return {
        sent: false,
        reason: error?.message || 'Error al enviar correo',
      };
    }
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

    if (!host || !port || !user || !pass) {
      this.logger.warn('SMTP no configurado. Se omitira envio de correos de confirmacion.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private getFromAddress(): string {
    const from = process.env.SMTP_FROM;
    const fromName = process.env.SMTP_FROM_NAME || 'PlannerOP';

    if (from && this.isValidEmail(from)) {
      return `${fromName} <${from}>`;
    }

    return 'PlannerOP <no-reply@plannerop.local>';
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}