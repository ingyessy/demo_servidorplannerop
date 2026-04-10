import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type EtherealAccount = {
  email: string;
  password: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  web: string;
};

@Injectable()
export class EtherealTestService {
  private readonly logger = new Logger(EtherealTestService.name);

  /**
   * Crea una cuenta Ethereal para pruebas de email
   * Retorna las credenciales SMTP y el URL para ver los mensajes
   */
  async createTestAccount(): Promise<EtherealAccount> {
    try {
      const testAccount = await nodemailer.createTestAccount();

      const account: EtherealAccount = {
        email: testAccount.user,
        password: testAccount.pass,
        smtp: {
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
        },
        web: testAccount.web,
      };

      this.logger.log(`Cuenta Ethereal creada: ${testAccount.user}`);
      return account;
    } catch (error: any) {
      this.logger.error(`No se pudo crear cuenta Ethereal: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Crea un transporter Ethereal para enviar correos de prueba
   */
  async createTestTransporter(): Promise<nodemailer.Transporter> {
    try {
      const testAccount = await nodemailer.createTestAccount();

      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.logger.log('Transporter Ethereal creado exitosamente');
      return transporter;
    } catch (error: any) {
      this.logger.error(`No se pudo crear transporter Ethereal: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Envía un correo de prueba a través de Ethereal
   * y retorna el URL para ver el correo
   */
  async sendTestEmail(to: string, subject: string, text: string): Promise<{
    success: boolean;
    messageId?: string;
    previewUrl?: string;
    error?: string;
  }> {
    try {
      const transporter = await this.createTestTransporter();

      const info = await transporter.sendMail({
        from: '"PlannerOP Test" <test@plannerop.local>',
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      this.logger.log(`Correo de prueba enviado. Preview: ${previewUrl}`);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      this.logger.error(`No se pudo enviar correo de prueba: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
