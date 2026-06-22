import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as https from 'https';
import * as querystring from 'querystring';

type SendConfirmationEmailParams = {
  to: string;
  operationId: number;
  confirmationLink: string;
  clientLabel?: string | null;
  tokenTtlMinutes: number;
  /** Asunto personalizado. Si se omite se usa uno por defecto. */
  subject?: string | null;
  /** Cuerpo de contexto (texto plano, admite saltos de linea). */
  bodyMessage?: string | null;
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
    // Preferir Graph API si está configurado
    if (this.isGraphConfigured()) {
      return this.sendViaGraphApi(params);
    }

    return this.sendViaSmtp(params);
  }

  // ─────────────────────────── Microsoft Graph API ───────────────────────────

  private isGraphConfigured(): boolean {
    return !!(
      process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.MAIL_FROM
    );
  }

  private async getGraphToken(): Promise<string> {
    const tenantId = process.env.AZURE_TENANT_ID!;
    const clientId = process.env.AZURE_CLIENT_ID!;
    const clientSecret = process.env.AZURE_CLIENT_SECRET!;

    const body = querystring.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'login.microsoftonline.com',
        path: `/${tenantId}/oauth2/v2.0/token`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              resolve(json.access_token);
            } else {
              reject(new Error(`Error obteniendo token: ${json.error_description || data}`));
            }
          } catch {
            reject(new Error(`Respuesta inesperada del token endpoint: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private async sendViaGraphApi(
    params: SendConfirmationEmailParams,
  ): Promise<SendConfirmationEmailResult> {
    if (!this.isValidEmail(params.to)) {
      return { sent: false, reason: `Correo destino invalido: ${params.to}` };
    }

    try {
      const token = await this.getGraphToken();

      const subjectPrefix =
        process.env.CONFIRMATION_EMAIL_SUBJECT_PREFIX || 'PlannerOP';
      const customSubject = (params.subject || '').trim();
      const subject = customSubject
        ? customSubject
        : `[${subjectPrefix}] Confirmacion de operacion #${params.operationId}`;

      const intro = params.clientLabel ? `Hola ${params.clientLabel},` : 'Hola,';
      const customBody = (params.bodyMessage || '').trim();
      const defaultBodyText =
        `La operacion #${params.operationId} esta pendiente de su validacion. ` +
        'Use el siguiente enlace para aprobar o rechazar el servicio.';
      const bodyText = customBody || defaultBodyText;
      const bodyHtml = this.escapeHtml(bodyText).replace(/\n/g, '<br/>');

      const now = new Date();
      const dateLabel = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

      const html = `
        <div style="background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;">
          <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

            <div style="background:#0f3460;padding:28px 32px 24px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:1.5px;">CARGOBAN</span>
              </div>
              <p style="font-size:12px;color:#9FE1CB;margin:0;">Operador Logístico y Portuario S.A.S.</p>
            </div>

            <div style="padding:28px 32px 0;">
              <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Estimado cliente,</p>
              <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 16px;">Solicitud de confirmación — Operación #${params.operationId}</h2>

              <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">
                ${bodyHtml}
              </p>

              <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:16px 20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:6px 0;width:50%;">
                      <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Operación</p>
                      <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">#${params.operationId}</p>
                    </td>
                    <td style="padding:6px 0;width:50%;">
                      <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Estado</p>
                      <p style="margin:0;"><span style="background:#E1F5EE;color:#0F6E56;font-size:12px;padding:2px 10px;border-radius:20px;">Pendiente de confirmación</span></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;">
                      <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Vigencia del enlace</p>
                      <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${params.tokenTtlMinutes} minutos</p>
                    </td>
                    <td style="padding:6px 0;">
                      <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Fecha</p>
                      <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${dateLabel}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align:center;margin-bottom:24px;">
                <a href="${params.confirmationLink}" style="display:inline-block;background:#0f3460;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                  Abrir portal
                </a>
              </div>

              <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="font-size:12px;color:#6b7280;margin:0 0 4px;">Si el botón no funciona, copie este enlace en su navegador:</p>
                <p style="font-size:12px;color:#185FA5;word-break:break-all;margin:0;">${params.confirmationLink}</p>
              </div>

              <div style="background:#FAEEDA;border-radius:8px;padding:12px 16px;margin-bottom:28px;">
                <p style="font-size:12px;color:#854F0B;margin:0;line-height:1.6;">
                  &#9200; Este enlace tiene una vigencia de <strong>${params.tokenTtlMinutes} minutos</strong> desde el momento en que fue generado. Si ha expirado, solicite un nuevo enlace al equipo de CARGOBAN.
                </p>
              </div>
            </div>

            <div style="border-top:1px solid #e5e7eb;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p style="font-size:12px;color:#374151;margin:0;">CARGOBAN Operador Logístico y Portuario S.A.S.</p>
                <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">Este es un mensaje automático, por favor no responda este correo.</p>
              </div>
            </div>

          </div>
        </div>
      `;

      const mailFrom = process.env.MAIL_FROM!;
      const payload = JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: params.to } }],
        },
        saveToSentItems: false,
      });

      await this.graphRequest(token, mailFrom, payload);

      this.logger.log(
        `[Graph] Correo enviado para operacion ${params.operationId} a ${params.to}`,
      );

      return { sent: true };
    } catch (error: any) {
      this.logger.error(
        `[Graph] Error enviando correo para operacion ${params.operationId}: ${error?.message || 'unknown'}`,
      );
      return { sent: false, reason: error?.message || 'Error al enviar correo via Graph API' };
    }
  }

  private graphRequest(token: string, mailFrom: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'graph.microsoft.com',
        path: `/v1.0/users/${encodeURIComponent(mailFrom)}/sendMail`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 202) {
            resolve();
          } else {
            reject(new Error(`Graph API respondió ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // ──────────────────────────────── SMTP (fallback) ────────────────────────────────

  private async sendViaSmtp(
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
      return { sent: false, reason: `Correo destino invalido: ${params.to}` };
    }

    const from = this.getFromAddress();
    const subjectPrefix =
      process.env.CONFIRMATION_EMAIL_SUBJECT_PREFIX || 'PlannerOP';
    const customSubject = (params.subject || '').trim();
    const subject = customSubject
      ? customSubject
      : `[${subjectPrefix}] Confirmacion de operacion #${params.operationId}`;

    const intro = params.clientLabel ? `Hola ${params.clientLabel},` : 'Hola,';
    const customBody = (params.bodyMessage || '').trim();
    const defaultBodyText =
      `La operacion #${params.operationId} esta pendiente de su validacion. ` +
      'Use el siguiente enlace para aprobar o rechazar el servicio.';
    const bodyText = customBody || defaultBodyText;
    const bodyHtml = this.escapeHtml(bodyText).replace(/\n/g, '<br/>');

    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

    const html = `
      <div style="background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;">
        <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

          <div style="background:#0f3460;padding:28px 32px 24px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
              <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:1.5px;">CARGOBAN</span>
            </div>
            <p style="font-size:12px;color:#9FE1CB;margin:0;">Operador Logístico y Portuario S.A.S.</p>
          </div>

          <div style="padding:28px 32px 0;">
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Estimado cliente,</p>
            <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 16px;">Solicitud de confirmación — Operación #${params.operationId}</h2>

            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">
              ${bodyHtml}
            </p>

            <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:16px 20px;margin-bottom:24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0;width:50%;">
                    <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Operación</p>
                    <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">#${params.operationId}</p>
                  </td>
                  <td style="padding:6px 0;width:50%;">
                    <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Estado</p>
                    <p style="margin:0;"><span style="background:#E1F5EE;color:#0F6E56;font-size:12px;padding:2px 10px;border-radius:20px;">Pendiente de confirmación</span></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Vigencia del enlace</p>
                    <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${params.tokenTtlMinutes} minutos</p>
                  </td>
                  <td style="padding:6px 0;">
                    <p style="font-size:11px;color:#9ca3af;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px;">Fecha</p>
                    <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">${dateLabel}</p>
                  </td>
                </tr>
              </table>
            </div>

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${params.confirmationLink}" style="display:inline-block;background:#0f3460;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                Abrir portal
              </a>
            </div>

            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
              <p style="font-size:12px;color:#6b7280;margin:0 0 4px;">Si el botón no funciona, copie este enlace en su navegador:</p>
              <p style="font-size:12px;color:#185FA5;word-break:break-all;margin:0;">${params.confirmationLink}</p>
            </div>

            <div style="background:#FAEEDA;border-radius:8px;padding:12px 16px;margin-bottom:28px;">
              <p style="font-size:12px;color:#854F0B;margin:0;line-height:1.6;">
                &#9200; Este enlace tiene una vigencia de <strong>${params.tokenTtlMinutes} minutos</strong> desde el momento en que fue generado. Si ha expirado, solicite un nuevo enlace al equipo de CARGOBAN.
              </p>
            </div>
          </div>

          <div style="border-top:1px solid #e5e7eb;padding:20px 32px;">
            <p style="font-size:12px;color:#374151;margin:0;">CARGOBAN Operador Logístico y Portuario S.A.S.</p>
            <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">Este es un mensaje automático, por favor no responda este correo.</p>
          </div>

        </div>
      </div>
    `;

    const text = [
      intro,
      '',
      bodyText,
      '',
      'Use este enlace para aprobar o rechazar el servicio:',
      params.confirmationLink,
      '',
      `Este enlace expira en ${params.tokenTtlMinutes} minutos.`,
    ].join('\n');

    try {
      const info = await transporter.sendMail({ from, to: params.to, subject, text, html });

      this.logger.log(
        `[SMTP] Correo enviado para operacion ${params.operationId} a ${params.to}`,
      );

      return { sent: true, messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(
        `[SMTP] Error enviando correo para operacion ${params.operationId}: ${error?.message || 'unknown'}`,
      );
      return { sent: false, reason: error?.message || 'Error al enviar correo' };
    }
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

    if (!host || !port || !user || !pass) {
      this.logger.warn('SMTP no configurado. Se omitira envio de correos de confirmacion.');
      return null;
    }

    this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    return this.transporter;
  }

  private getFromAddress(): string {
    const from = process.env.SMTP_FROM;
    const fromName = process.env.SMTP_FROM_NAME || 'PlannerOP';
    if (from && this.isValidEmail(from)) return `${fromName} <${from}>`;
    return 'PlannerOP <no-reply@plannerop.local>';
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
