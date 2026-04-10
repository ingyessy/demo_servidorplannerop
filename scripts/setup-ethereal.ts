#!/usr/bin/env node

/**
 * Script para generar credenciales Ethereal para pruebas de email
 * 
 * Uso:
 *   npx ts-node scripts/setup-ethereal.ts
 * 
 * Esto creará un archivo .env.ethereal con las credenciales necesarias
 */

import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

const envFile = path.join(process.cwd(), '.env.ethereal');

async function setupEtherealAccount() {
  console.log('🚀 Generando cuenta Ethereal para pruebas de email...\n');

  try {
    const testAccount = await nodemailer.createTestAccount();

    const envContent = `# Credenciales Ethereal para pruebas de email
# Generadas automáticamente por scripts/setup-ethereal.ts

# Configuración SMTP
SMTP_HOST=${testAccount.smtp.host}
SMTP_PORT=${testAccount.smtp.port}
SMTP_SECURE=${testAccount.smtp.secure}
SMTP_USER=${testAccount.user}
SMTP_PASS=${testAccount.pass}
SMTP_FROM=${testAccount.user}
SMTP_FROM_NAME=PlannerOP Test

# URL donde ver los correos enviados
# Asegúrate de guardar este URL - no se puede regenerar
ETHEREAL_WEB_URL=${testAccount.web}

# Tiempo de expiración de tokens (en minutos)
OPERATION_CONFIRMATION_TOKEN_TTL_MINUTES=1440

# URL de la página de confirmación
OPERATION_CONFIRMATION_PAGE_URL=http://localhost:3001/confirm-operation

# Email por defecto para fallback
CONFIRMATION_DEFAULT_EMAIL=${testAccount.user}
`;

    fs.writeFileSync(envFile, envContent, 'utf8');

    console.log('✅ Cuenta Ethereal creada exitosamente\n');
    console.log('📧 Credenciales guardadas en: .env.ethereal\n');
    console.log('📋 Detalles de la cuenta:\n');
    console.log(`   Usuario:    ${testAccount.user}`);
    console.log(`   Contraseña: ${testAccount.pass}`);
    console.log(`   Host:       ${testAccount.smtp.host}`);
    console.log(`   Puerto:     ${testAccount.smtp.port}`);
    console.log(`   Seguro:     ${testAccount.smtp.secure}\n`);
    console.log('🔗 URL para ver correos:\n');
    console.log(`   ${testAccount.web}\n`);
    console.log('📝 Próximos pasos:\n');
    console.log('   1. Copia las variables SMTP_* a tu .env local');
    console.log('   2. Inicia la aplicación: npm run start:dev');
    console.log('   3. Haz una prueba:');
    console.log('      POST /api/operation/test/ethereal-credentials');
    console.log('   4. O envía un correo de prueba:');
    console.log('      POST /api/operation/test/send-test-email');
    console.log('      Body: { "to": "test@example.com", "subject": "Test", "text": "Hello" }');
    console.log('   5. O prueba confirmación de operación:');
    console.log('      POST /api/operation/test/test-operation-confirmation');
    console.log('      Body: { "operationId": 1, "confirmationLink": "...", "clientEmail": "test@example.com" }');
    console.log('   6. Abre el URL de Ethereal para ver los correos\n');
    console.log('⚠️  IMPORTANTE: Guarda el URL anterior. Las credenciales caducan después de cierto tiempo.\n');
  } catch (error: any) {
    console.error('❌ Error al generar cuenta Ethereal:\n');
    console.error(`   ${error?.message || 'Unknown error'}\n`);
    console.error('💡 Si no tienes internet, puedes configurar SMTP manualmente en .env\n');
    process.exit(1);
  }
}

setupEtherealAccount();
