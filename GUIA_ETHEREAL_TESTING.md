# Pruebas de Email con Ethereal

## Descripción rápida

Ethereal Email es un servicio gratuito de Node Mailer que permite probar el envío de correos sin configurar un SMTP real. Los correos se capturan durante la prueba y puedes verlos en un panel web específico.

**Ventajas:**
- ✅ No requiere configuración SMTP real
- ✅ Todos los correos se capturan y se pueden ver en la web
- ✅ Ideal para ambiente de desarrollo y pruebas
- ✅ Soporta HTML y texto plano
- ✅ Genera un enlace por cada correo para previsualizar

## Instalación y Setup

### 1. Generar credenciales Ethereal

Ejecuta el script de setup:

```bash
npx ts-node scripts/setup-ethereal.ts
```

Este script:
1. Crea una cuenta temporal en Ethereal
2. Genera un archivo `.env.ethereal` con las credenciales
3. Imprime un URL donde ver los correos

**Salida esperada:**
```
🚀 Generando cuenta Ethereal para pruebas de email...

✅ Cuenta Ethereal creada exitosamente

📧 Credenciales guardadas en: .env.ethereal

📋 Detalles de la cuenta:

   Usuario:    user@ethereal.email
   Contraseña: PaSsWoRd1234
   Host:       smtp.ethereal.email
   Puerto:     587
   Seguro:     false

🔗 URL para ver correos:

   https://ethereal.email/messages?...

📝 Próximos pasos:
   ...
```

### 2. Copiar credenciales al .env local

Abre el archivo `.env.ethereal` generado y copia las variables SMTP_* a tu `.env`:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@ethereal.email
SMTP_PASS=PaSsWoRd1234
SMTP_FROM=user@ethereal.email
SMTP_FROM_NAME=PlannerOP Test
OPERATION_CONFIRMATION_PAGE_URL=http://localhost:3001/confirm-operation
OPERATION_CONFIRMATION_TOKEN_TTL_MINUTES=1440
CONFIRMATION_DEFAULT_EMAIL=user@ethereal.email
```

### 3. Iniciar la aplicación

```bash
npm run start:dev
```

## Pruebas disponibles

### Opción 1: Generar nuevas credenciales Ethereal (en tiempo real)

```bash
curl http://localhost:3001/api/operation/test/ethereal-credentials
```

**Respuesta:**
```json
{
  "email": "user@ethereal.email",
  "password": "password123",
  "smtp": {
    "host": "smtp.ethereal.email",
    "port": 587,
    "secure": false
  },
  "web": "https://ethereal.email/messages?...",
  "envConfiguration": {
    "SMTP_HOST": "smtp.ethereal.email",
    ...
  },
  "instructions": [
    "1. Copia las credenciales retornadas arriba",
    ...
  ]
}
```

### Opción 2: Enviar correo de prueba

```bash
curl -X POST http://localhost:3001/api/operation/test/send-test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@example.com",
    "subject": "Prueba de confirmación",
    "text": "Este es un correo de prueba"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "messageId": "<message-id@ethereal.email>",
  "previewUrl": "https://ethereal.email/message/..."
}
```

Abre el `previewUrl` en el navegador para ver el correo.

### Opción 3: Probar envío de confirmación de operación

```bash
curl -X POST http://localhost:3001/api/operation/test/test-operation-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "operationId": 1792,
    "confirmationLink": "https://cargoban.com.co/confirm-operation?token=abc123def456",
    "clientEmail": "cliente@example.com"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "messageId": "<message-id@ethereal.email>",
  "previewUrl": "https://ethereal.email/message/..."
}
```

### Opción 4: Prueba end-to-end (si tienes operación especial)

#### 4.1 Crear una operación especial
```bash
# Asegurate que la operación tiene una tarifa con isSpecial = YES
POST /api/operation/complete/:id
```

#### 4.2 Configurar .env con Ethereal
Si aún no lo hiciste, configura SMTP_* en .env

#### 4.3 Completar la operación
```bash
curl -X POST http://localhost:3001/api/operation/complete/1792 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Respuesta:**
```json
{
  "operation": {...},
  "confirmation": {...},
  "token": {...},
  "link": "https://cargoban.com.co/confirm-operation?token=abc123...",
  "emailNotification": {
    "sent": true,
    "to": "cliente@example.com",
    "messageId": "<message-id@ethereal.email>"
  },
  "movedTo": "TO_APPROVED"
}
```

Busca el URL preview en el correo o copia el `previewUrl` desde la respuesta de envío.

## Visualizar correos

Cada vez que se envía un correo, Ethereal devuelve un `previewUrl`:

1. Opción A: Abre el URL directo

```
https://ethereal.email/message/...
```

2. Opción B: Ve al panel principal de Ethereal

El script inicial te genera un panel principal donde ves todos los correos enviados:

```
https://ethereal.email/messages?...
```

## Flujo de Confirmación Completo (Testing)

### 1. Generar credenciales Ethereal

```bash
npx ts-node scripts/setup-ethereal.ts
# Copia las credenciales SMTP_* al .env
```

### 2. Configurar variables en .env

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@ethereal.email
SMTP_PASS=password123
SMTP_FROM=user@ethereal.email
OPERATION_CONFIRMATION_PAGE_URL=http://localhost:3001/confirm-operation
CONFIRMATION_DEFAULT_EMAIL=user@ethereal.email
```

### 3. Iniciar servidor

```bash
npm run start:dev
```

### 4. Completar operación especial

```bash
curl -X POST http://localhost:3001/api/operation/complete/1792 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Obtén el `previewUrl` del email de la respuesta.

### 5. Ver correo en Ethereal

Abre el `previewUrl`, confirma que el correo se vea bien.

### 6. Abrir enlace de confirmación (local)

El correo contiene el enlace `OPERATION_CONFIRMATION_PAGE_URL?token=...`

```
http://localhost:3001/confirm-operation?token=abc123...
```

### 7. Aprobar o rechazar desde la página

- Click en "Confirmar y aprobar" → estado cambia a APPROVED
- Click en "Confirmar y rechazar" → estado cambia a REJECTED

### 8. Validar estado de operación

```bash
curl http://localhost:3001/api/operation/1792 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Verifica que `status` sea `APPROVED` o `REJECTED`.

## Troubleshooting

### "SMTP no configurado"

**Problema:** Mensaje indicando que SMTP no está configurado.

**Solución:**
1. Ejecuta `npx ts-node scripts/setup-ethereal.ts`
2. Copia variables SMTP_* a `.env`
3. Reinicia servidor

### "Token de confirmacion expirado"

**Problema:** Al intentar confirmar, dice que el token expiró.

**Solución:**
1. Define `OPERATION_CONFIRMATION_TOKEN_TTL_MINUTES=1440` en `.env` (24 horas por defecto)
2. O regenera el token ejecutando nuevamente `/operation/complete/:id`

### "No se encontro correo valido del cliente"

**Problema:** El sistema no puede determinar a quién enviar el correo.

**Solución:**
1. Define `CONFIRMATION_DEFAULT_EMAIL=user@ethereal.email` en `.env`
2. O agrega un email válido al cliente en la DB

### "Cuenta Ethereal creada hace mucho tiempo"

**Problema:** Las credenciales Ethereal caducan después de ~5 días.

**Solución:**
Regenera ejecutando nuevamente:

```bash
npx ts-node scripts/setup-ethereal.ts
```

## Endpoints disponibles

Todos son públicos (sin JWT requerido):

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `/api/operation/test/ethereal-credentials` | GET | Generar nuevas credenciales Ethereal |
| `/api/operation/test/send-test-email` | POST | Enviar correo de prueba |
| `/api/operation/test/test-operation-confirmation` | POST | Simular confirmación de operación |

## Notas

- Ethereal es **SOLO para desarrollo y testing**, no para producción
- Las credenciales caducan después de cierto tiempo
- Todos los correos se capturan en Ethereal (no se envían realmente)
- Ideal para validar HTML, templating, y flujo de confirmación sin SMTP real

## Siguiente paso: SMTP Real

Cuando estés listo para producción:

1. Obtén credenciales SMTP real (Gmail, SendGrid, Mailgun, etc.)
2. Actualiza variables en `.env`
3. El código no cambia, solo la configuración de SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
SMTP_FROM=tu-email@gmail.com
```

¡Listo! El flujo de confirmación está completamente funcional y testeado.
