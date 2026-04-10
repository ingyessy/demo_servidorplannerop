import {
  Controller,
  Post,
  Body,
  Get,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { EtherealTestService } from './services/ethereal-test.service';

@Controller('operation/test')
export class OperationTestController {
  private readonly logger = new Logger(OperationTestController.name);

  constructor(private readonly etherealTestService: EtherealTestService) {}

  @Get('ethereal-credentials')
  @Public()
  @ApiOperation({
    summary: 'Generar credenciales Ethereal para pruebas de email',
    description:
      'Crea una cuenta temporal Ethereal para probar el envío de correos sin necesidad de configurar SMTP real. Los correos se pueden ver en el URL retornado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credenciales Ethereal creadas exitosamente',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@ethereal.email' },
        password: { type: 'string' },
        smtp: {
          type: 'object',
          properties: {
            host: { type: 'string', example: 'smtp.ethereal.email' },
            port: { type: 'number', example: 587 },
            secure: { type: 'boolean', example: false },
          },
        },
        web: {
          type: 'string',
          description: 'URL para ver los correos enviados',
        },
        envConfiguration: {
          type: 'object',
          description: 'Configura estas variables en tu .env',
        },
      },
    },
  })
  async generateEtherealCredentials() {
    try {
      const account = await this.etherealTestService.createTestAccount();

      return {
        ...account,
        envConfiguration: {
          SMTP_HOST: account.smtp.host,
          SMTP_PORT: account.smtp.port,
          SMTP_SECURE: String(account.smtp.secure),
          SMTP_USER: account.email,
          SMTP_PASS: account.password,
          SMTP_FROM: account.email,
          SMTP_FROM_NAME: 'PlannerOP Test',
        },
        instructions: [
          '1. Copia las credenciales retornadas arriba',
          '2. Actualiza tu .env con SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM',
          '3. Haz una solicitud POST a /operation/complete/:operationId para probar envío de email',
          `4. Los correos se verán en: ${account.web}`,
        ],
      };
    } catch (error: any) {
      this.logger.error(`Error al generar credenciales Ethereal: ${error?.message}`);
      throw new BadRequestException(
        `No se pudo crear cuenta Ethereal: ${error?.message}`,
      );
    }
  }

  @Post('send-test-email')
  @Public()
  @ApiOperation({
    summary: 'Enviar correo de prueba a través de Ethereal',
    description:
      'Envía un correo de prueba usando una cuenta Ethereal temporal. Útil para validar configuración antes de usar SMTP real.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          example: 'cliente@example.com',
          description: 'Dirección de correo destino',
        },
        subject: {
          type: 'string',
          example: 'Prueba de confirmación',
        },
        text: {
          type: 'string',
          example:
            'Este es un correo de prueba para validar la confirmación de operaciones.',
        },
      },
      required: ['to', 'subject', 'text'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Correo de prueba enviado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messageId: { type: 'string' },
        previewUrl: {
          type: 'string',
          description: 'URL donde puedes ver el correo enviado',
        },
      },
    },
  })
  async sendTestEmail(
    @Body()
    body: {
      to: string;
      subject: string;
      text: string;
    },
  ) {
    if (!body.to || !body.subject || !body.text) {
      throw new BadRequestException('Se requieren to, subject y text');
    }

    return await this.etherealTestService.sendTestEmail(
      body.to,
      body.subject,
      body.text,
    );
  }

  @Post('test-operation-confirmation')
  @Public()
  @ApiOperation({
    summary: 'Probar envío de correo de confirmación de operación',
    description:
      'Simula el envío de un correo de confirmación de operación especial usando Ethereal. Requiere que OPERATION_CONFIRMATION_PAGE_URL esté configurada.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        operationId: {
          type: 'number',
          example: 1792,
        },
        confirmationLink: {
          type: 'string',
          example:
            'https://cargoban.com.co/confirm-operation?token=abc123def456',
        },
        clientEmail: {
          type: 'string',
          example: 'cliente@example.com',
          description: 'Correo destino para la prueba',
        },
      },
      required: ['operationId', 'confirmationLink', 'clientEmail'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Correo de confirmación enviado exitosamente',
  })
  async testOperationConfirmationEmail(
    @Body()
    body: {
      operationId: number;
      confirmationLink: string;
      clientEmail: string;
    },
  ) {
    if (!body.operationId || !body.confirmationLink || !body.clientEmail) {
      throw new BadRequestException(
        'Se requieren operationId, confirmationLink y clientEmail',
      );
    }

    const tokenTtlMinutes = 60;

    const text = [
      'Hola,',
      '',
      `La operacion #${body.operationId} esta pendiente de su validacion.`,
      'Use este enlace para aprobar o rechazar el servicio:',
      body.confirmationLink,
      '',
      `Este enlace expira en ${tokenTtlMinutes} minutos.`,
    ].join('\n');

    return await this.etherealTestService.sendTestEmail(
      body.clientEmail,
      `[PlannerOP] Confirmacion de operacion #${body.operationId}`,
      text,
    );
  }
}
