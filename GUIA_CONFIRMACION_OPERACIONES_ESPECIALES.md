# Guia del modulo: Confirmacion de operaciones especiales

## Objetivo
Documentar exclusivamente el flujo y la implementacion de confirmacion para operaciones especiales.

## Alcance del modulo
Este modulo cubre:
- Deteccion de operacion especial por tarifas.
- Cambio de estado al intentar completar una operacion especial.
- Creacion de confirmacion y token.
- Generacion de link de confirmacion.
- Confirmacion por token con accion APPROVE o REJECT.

No cubre:
- Flujo general de login/autenticacion JWT del sistema.
- Facturacion, reportes, o logica de cron no relacionada con confirmaciones.

## Regla de negocio principal
Una operacion se considera especial si alguna tarifa asociada a sus registros en Operation_Worker tiene Tariff.isSpecial = YES.

Comportamiento esperado:
1. Si la operacion NO es especial y se completa, pasa a COMPLETED.
2. Si la operacion SI es especial y se completa, pasa a TO_APPROVED.
3. Para una operacion especial se crea/reutiliza OperationConfirmation.
4. Se genera Token de confirmacion y link.
5. La operacion se confirma por token con accion:
   - APPROVE -> APPROVED
   - REJECT -> REJECTED

## Modelos de datos involucrados
- Operation
- Operation_Worker
- Tariff
- OperationConfirmation
- Token

## Estados de Operation usados en este modulo
- TO_APPROVED
- APPROVED
- REJECTED
- COMPLETED

## Implementacion actual

### 1) Deteccion de operacion especial
Servicio: src/operation/operation.service.ts
Metodo: isOperationSpecial(operationId, operation?)

Responsabilidad:
- Valida operationId.
- Verifica existencia de operacion (o reutiliza la operacion recibida por argumento).
- Cuenta Operation_Worker con relacion a tarifa especial.

### 2) Completar operacion con bifurcacion especial/no especial
Servicio: src/operation/operation.service.ts
Metodo: completeOperation(operationId)

Responsabilidad:
- Carga operacion una sola vez.
- Si NO es especial:
  - status -> COMPLETED
  - dateEnd/timeEnd -> fecha y hora actual
  - ejecuta cierre operativo:
    - completeClientProgramming
    - releaseAllWorkersFromOperation
    - addWorkedHoursOnOperationEnd
- Si SI es especial:
  - status -> TO_APPROVED
  - llama createConfirmation(operationId, operation)
  - retorna datos de confirmacion, token y link

### 3) Creacion de confirmacion + token + link
Servicio: src/operation/operation.service.ts
Metodo: createConfirmation(operationId, operation?)

Responsabilidad:
- Valida operationId.
- Verifica existencia de operacion (o reutiliza argumento).
- Verifica que la operacion sea especial.
- Crea/reutiliza OperationConfirmation con upsert (idempotente por id_operation unico).
- Genera token unico y lo persiste con reintentos ante colision.
- Construye link de confirmacion.

### 4) Servicio dedicado para token y link
Servicio: src/operation/services/operation-token.service.ts

Responsabilidad:
- generateTokenValue(): genera valor aleatorio seguro.
- buildConfirmationLink(token): arma URL de confirmacion.

Variables usadas para base URL:
1. FRONTEND_URL
2. CLIENT_URL
3. fallback: https://cargoban.com.co

### 5) Confirmacion por token
Servicio: src/operation/operation.service.ts
Metodo: confirmOperation(token, action)

Responsabilidad:
- Valida token y accion.
- Busca token y su relacion con confirmation + operation.
- Exige estado actual TO_APPROVED.
- Aplica transicion de estado:
  - APPROVE -> APPROVED
  - REJECT -> REJECTED
- Actualiza confirmedAt en OperationConfirmation.

## Excepciones y errores del modulo

### Excepciones personalizadas
- src/operation/exceptions/operation-not-found.exception.ts
- src/operation/exceptions/token-generation-failed.exception.ts

### Errores funcionales frecuentes
- operationId invalido -> BadRequestException
- operacion no encontrada -> OperationNotFoundException
- token invalido o vacio -> BadRequestException
- accion invalida -> BadRequestException
- operacion no especial en createConfirmation -> ConflictException
- operacion fuera de TO_APPROVED al confirmar -> ConflictException
- fallo de generacion/persistencia de token -> TokenGenerationFailedException

## Endpoints del modulo

### 1) Completar operacion
- Metodo: POST
- Ruta: /operation/complete/:id
- Autenticacion: protegida por JWT + Roles del controlador

Respuesta esperada:
- Operacion no especial: movedTo = COMPLETED
- Operacion especial: movedTo = TO_APPROVED + confirmation + token + link

### 2) Confirmar por token
- Metodo: POST
- Ruta: /operation/confirm
- Autenticacion: PUBLICO (sin JWT)
- Body:
  - token: string
  - action: APPROVE | REJECT

Respuesta esperada:
- movedTo = APPROVED o REJECTED
- confirmation con confirmedAt actualizado

## Seguridad y decisiones
- El endpoint /operation/confirm es publico por diseno para habilitar confirmacion mediante link.
- La seguridad del endpoint se apoya en posesion de token valido.
- El token se almacena en base de datos y se resuelve por busqueda exacta.

## Logging y auditoria
En OperationService se registran eventos:
- Operacion completada (no especial).
- Operacion movida a TO_APPROVED.
- Confirmacion creada/reutilizada.
- Token creado.
- Confirmacion final con accion y estado final.

## Flujo recomendado de uso
1. Crear operacion con tarifas.
2. Intentar completar via POST /operation/complete/:id.
3. Si es especial, tomar link retornado y enviarlo al cliente.
4. Cliente ejecuta POST /operation/confirm con token y accion.
5. Validar estado final de la operacion.

## Pendientes recomendados (siguientes pasos)
1. Expiracion de tokens (TTL).
2. Invalidacion por uso unico del token.
3. DTO para validar body de /operation/confirm.
4. E2E tests del flujo completo:
   - especial -> TO_APPROVED -> APPROVED/REJECTED
   - no especial -> COMPLETED
5. Guardar metadata opcional en confirmacion (ipAddress, device, observation).

## Archivos clave
- src/operation/operation.service.ts
- src/operation/operation.controller.ts
- src/operation/services/operation-token.service.ts
- src/operation/exceptions/operation-not-found.exception.ts
- src/operation/exceptions/token-generation-failed.exception.ts
- prisma/schema.prisma

## Estado actual
Implementacion base funcional completada para:
- deteccion de operacion especial
- completion condicional
- confirmacion y token
- endpoint publico de confirmacion

Este documento debe mantenerse actualizado ante cualquier cambio de reglas de negocio del flujo de confirmacion.
