# Guía: Implementar Flujo de Operaciones Especiales en Frontend

## Overview
Las operaciones especiales en el backend se completan **automáticamente** cuando se finalizan todos los grupos. El frontend debe:
1. Detectar cuándo está completa la operación
2. Obtener el link de confirmación con token
3. Mostrar el link en QR al cliente

---

## Paso 1: Finalizar Cada Grupo

**Endpoint**: `POST /operation-worker/finalize-group/:id`

### Estructura del Request:
```typescript
interface FinalizeGroupRequest {
  id_group: string;      // ID único del grupo (ej: "grupo_1", "GRUPO_SITE_001")
  dateEnd: string;       // Formato: "YYYY-MM-DD" (ej: "2026-04-09")
  timeEnd: string;       // Formato: "HH:mm" (ej: "17:30")
}
```

### Ejemplo en Frontend (TypeScript/Angular/React):
```typescript
// Para cada grupo en la operación
const finalizeGroup = async (operationId: number, groupId: string, dateEnd: string, timeEnd: string) => {
  try {
    const response = await fetch(`/api/operation-worker/finalize-group/${operationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Si requiere autenticación
      },
      body: JSON.stringify({
        id_group: groupId,
        dateEnd: dateEnd,        // "2026-04-09"
        timeEnd: timeEnd          // "17:30"
      })
    });

    const result = await response.json();
    
    // ⚠️ IMPORTANTE: Verificar si la operación se completó
    if (result.operationCompleted) {
      return {
        completed: true,
        isSpecial: result.isSpecial,
        newStatus: result.newStatus
      };
    }

    return {
      completed: false,
      groupUpdated: result.count > 0
    };

  } catch (error) {
    console.error('Error finalizando grupo:', error);
    throw error;
  }
};
```

---

## Paso 2: Detectar Completación de Operación

**Monitorear la respuesta de `finalize-group`**:

```typescript
// Después de llamar finalizeGroup para cada grupo
const onGroupFinalized = async (operationId: number, groupId: string, dateEnd: string, timeEnd: string) => {
  const result = await finalizeGroup(operationId, groupId, dateEnd, timeEnd);
  
  if (result.completed && result.isSpecial) {
    // 🎉 TODOS los grupos están finalizados y es operación especial
    // Pasar a paso 3: Obtener link de confirmación
    await fetchAndShowConfirmationLink(operationId);
    
  } else if (result.completed && !result.isSpecial) {
    // ✅ Operación NO especial completada normalmente
    console.log('Operación completada:', result.newStatus);
    // Actualizar UI: mostrar que operación está COMPLETED
    
  } else {
    // ⏳ Todavía hay grupos incompletos
    console.log('Grupo actualizado, esperando más grupos...');
  }
};
```

---

## Paso 3: Obtener Link de Confirmación

**Endpoint**: `GET /operation/{operationId}/confirmation-link`

### Estructura de Response:
```typescript
interface ConfirmationLinkResponse {
  operationId: number;
  link: string;                           // URL completo con token (ej: https://cargoban.com.co/confirm?token=...)
  status: string;                         // Siempre "TO_APPROVED" si se retorna correctamente
}
```

### Ejemplo en Frontend:
```typescript
const fetchAndShowConfirmationLink = async (operationId: number) => {
  try {
    const response = await fetch(`/api/operation/${operationId}/confirmation-link`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error obteniendo link:', error.message);
      return;
    }

    const data: ConfirmationLinkResponse = await response.json();

    console.log('Link obtenido:', data.link);
    console.log('Estado operación:', data.status);

    // ✅ Pasar al paso 4: Mostrar QR
    displayConfirmationQR(operationId, data.link);

  } catch (error) {
    console.error('Error en fetch de confirmation link:', error);
  }
};
```

---

## Paso 4: Mostrar Link en QR

### Opción A: Usando librería QR (Recomendado)

**Instalar qrcode.js**:
```bash
npm install qrcode
# o
yarn add qrcode
```

**Implementación**:
```typescript
import QRCode from 'qrcode';

const displayConfirmationQR = async (operationId: number, confirmationLink: string) => {
  try {
    // Generar QR como imagen Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(confirmationLink, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000',
        light: '#fff'
      }
    });

    // Mostrar en modal o sección
    const qrContainer = document.getElementById('qr-confirmation-container');
    if (qrContainer) {
      qrContainer.innerHTML = `
        <div class="confirmation-qr-section">
          <h3>Operación Lista para Confirmación</h3>
          <p>ID Operación: ${operationId}</p>
          
          <div class="qr-image-container">
            <img src="${qrCodeDataUrl}" alt="Código QR de confirmación" />
          </div>
          
          <div class="qr-link-section">
            <p>O copiar el link:</p>
            <input 
              type="text" 
              value="${confirmationLink}" 
              readonly 
              class="link-input"
            />
            <button onclick="copyToClipboard('${confirmationLink}')">Copiar</button>
          </div>
          
          <div class="qr-instructions">
            <p><strong>Indicaciones para el cliente:</strong></p>
            <ol>
              <li>Escanea el código QR con tu teléfono</li>
              <li>O copia y abre el link en tu navegador</li>
              <li>Selecciona APROBAR o RECHAZAR la operación</li>
              <li>Los cambios se reflejarán inmediatamente</li>
            </ol>
          </div>
        </div>
      `;
    }

  } catch (error) {
    console.error('Error generando QR:', error);
  }
};

// Función auxiliar para copiar al portapapeles
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Link copiado al portapapeles');
  });
}
```

---

## Paso 5: Monitorear Estado de Confirmación (Opcional)

**Para actualizar UI cuando el cliente confirme**, haz polling o usa WebSocket:

```typescript
const monitorConfirmationStatus = async (operationId: number) => {
  const checkInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/operation/${operationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const operation = await response.json();

      // Si cambió de estado, actualizar UI
      if (operation.status === 'APPROVED') {
        clearInterval(checkInterval);
        showSuccessMessage('✅ Operación APROBADA por el cliente');
        // Actualizar UI según sea necesario
        
      } else if (operation.status === 'REJECTED') {
        clearInterval(checkInterval);
        showErrorMessage('❌ Operación RECHAZADA por el cliente');
        // Actualizar UI según sea necesario
      }

    } catch (error) {
      console.error('Error monitoreando estado:', error);
    }
  }, 3000); // Verificar cada 3 segundos
};
```

---

## Flujo Completo Integrado

```typescript
/**
 * Flujo principal para completar una operación especial
 */
async function completeSpecialOperation(
  operationId: number,
  groupsToFinalize: Array<{ id_group: string; dateEnd: string; timeEnd: string }>
) {
  try {
    // 1️⃣ Finalizar cada grupo
    let operationCompleted = false;
    let isSpecial = false;

    for (const group of groupsToFinalize) {
      console.log(`Finalizando grupo ${group.id_group}...`);
      
      const response = await fetch(`/api/operation-worker/finalize-group/${operationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(group)
      });

      const result = await response.json();

      if (result.operationCompleted) {
        operationCompleted = true;
        isSpecial = result.isSpecial;
        console.log('✅ Operación completada:', result.newStatus);
        break; // Salir del loop si ya se completó
      }
    }

    // 2️⃣ Si es especial y se completó, obtener link de confirmación
    if (operationCompleted && isSpecial) {
      console.log('Obteniendo link de confirmación...');
      await fetchAndShowConfirmationLink(operationId);
      
      // 3️⃣ Opcional: Monitorear cambios de estado
      monitorConfirmationStatus(operationId);
    }

  } catch (error) {
    console.error('Error en flujo de operación especial:', error);
    showErrorMessage('No se pudo completar la operación');
  }
}
```

---

## Estructura HTML Recomendada

```html
<!-- Sección para mostrar QR -->
<div id="qr-confirmation-container" class="modal hidden">
  <!-- Se rellena dinámicamente por displayConfirmationQR -->
</div>

<!-- CSS Básico -->
<style>
  .confirmation-qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 30px;
    border: 2px solid #4CAF50;
    border-radius: 8px;
    background-color: #f9f9f9;
  }

  .qr-image-container {
    display: flex;
    justify-content: center;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .qr-image-container img {
    width: 300px;
    height: 300px;
  }

  .qr-link-section {
    display: flex;
    gap: 10px;
    width: 100%;
    justify-content: center;
    align-items: center;
  }

  .link-input {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    width: 300px;
    font-size: 12px;
  }

  .qr-instructions {
    background-color: #e8f5e9;
    padding: 15px;
    border-radius: 4px;
    width: 100%;
  }
</style>
```

---

## Manejo de Errores

```typescript
// Errores comunes y cómo manejarlos

// Error 400: ID inválido
if (response.status === 400) {
  showErrorMessage('ID de operación inválido');
}

// Error 404: Operación no encontrada
if (response.status === 404) {
  showErrorMessage('No se encontró la operación');
}

// Error 409: No es especial o no está en TO_APPROVED
if (response.status === 409) {
  const error = await response.json();
  showErrorMessage(error.message);
  // NO mostrar QR en este caso
}
```

---

## Resumen de Endpoints Usados

| Método | Endpoint | Propósito | Auth |
|--------|----------|----------|------|
| POST | `/operation-worker/finalize-group/:id` | Finalizar grupo | ✅ Requerida |
| GET | `/operation/:id/confirmation-link` | Obtener link con token | ✅ Requerida |
| GET | `/operation/:id` | Verificar estado actual | ✅ Requerida |

---

## Checklist para Frontend

- [ ] Implementar `finalizeGroup()` para actualizar grupos
- [ ] Detectar `operationCompleted` y `isSpecial` en respuesta
- [ ] Implementar `fetchAndShowConfirmationLink()` 
- [ ] Integrar librería QRCode
- [ ] Mostrar QR en modal/sección dedicada
- [ ] Agregar instrucciones para el cliente
- [ ] Implementar monitoring de cambios de estado (opcional)
- [ ] Manejar errores 400, 404, 409
- [ ] Probar flujo completo end-to-end

---

## Testing del Flujo

```bash
# 1. Crear operación con tarifa especial (desde API)
POST /operation/create
{
  "id_operation": 1,
  "client": "Cliente Test",
  "tariff": { "isSpecial": "YES" }
}

# 2. Asignar trabajadores a grupos

# 3. Finalizar cada grupo (x3 en frontend)
POST /operation-worker/finalize-group/1
{
  "id_group": "grupo_1",
  "dateEnd": "2026-04-09",
  "timeEnd": "17:30"
}

# 4. Verificar respuesta última (debe tener operationCompleted: true)

# 5. Obtener link
GET /operation/1/confirmation-link
# Respuesta: { link: "https://..." }

# 6. Verificar estado en TO_APPROVED
GET /operation/1
# Debe mostrar status: "TO_APPROVED"
```

---

## Notas Importantes

⚠️ **El link es único y contiene el token plano** - No exponerlo en logs públicos
⚠️ **El token tiene TTL configurable** - Regenerar si expira
⚠️ **Mismo grupo no debe finalizarse dos veces** - Validar en frontend
⚠️ **Email se envía automáticamente** del lado del backend (próximamente)
⚠️ **El endpoint de confirmación es público** - Se protege por posesión del token
