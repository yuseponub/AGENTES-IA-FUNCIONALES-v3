# Order Manager - Documentación Técnica

## 📋 Resumen
**Workflow:** Order Manager
**Función Principal:** Creador de pedidos en Bigin CRM
**Tipo:** Integrador CRM
**Endpoints:** `/webhook/order-manager`

## 🎯 Propósito

El Order Manager es el encargado de crear pedidos en Bigin CRM cuando un cliente completa sus datos y elige un pack. Recibe los datos capturados, los valida, prepara el pedido y lo envía al robot API que maneja Bigin.

## 🔄 Flujo de Procesamiento

### 1. Recepción de Request
```
Webhook: Order Manager → Parse Request
```

**Input esperado:**
```json
{
  "phone": "57...",
  "captured_data": {
    "nombre": "Juan",
    "apellido": "Perez",
    "telefono": "573137549286",
    "direccion": "Calle 123 #45-67",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "barrio": "Centro",
    "correo": "juan@email.com",
    "pack": "2x"
  },
  "promo_override": null,
  "source": "historial_v3",
  "callbell_conversation_href": "https://...",
  "contact_id": "..."
}
```

**Parse Request:**
```javascript
const phone = body.phone;
const capturedData = body.captured_data || {};
const promoOverride = body.promo_override || null;  // Force specific promo
const source = body.source || 'unknown';
const callbellConversationHref = body.callbell_conversation_href || '';
const contactId = body.contact_id || '';

// Determine promo: override takes priority, then captured_data.pack
let promo = promoOverride || capturedData.pack || null;
```

### 2. Validación de Datos
```
Parse Request → Validate Data
```

**Campos mínimos requeridos:**
```javascript
const minimumFields = ['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento'];
const missingFields = minimumFields.filter(f =>
  !capturedData[f] || capturedData[f].trim() === ''
);

const isValid = missingFields.length === 0;
```

### 3. IF: Valid Data?
```
Validate Data → IF: Valid Data?
  ├─ TRUE → Prepare Bigin Order
  └─ FALSE → Return Error
```

### 4. Preparación del Pedido
```
Prepare Bigin Order
```

**Mapping de promos a precios:**
```javascript
const promoAmounts = {
  '1x': 77900,
  '1X': 77900,
  '2x': 109900,
  '2X': 109900,
  '3x': 139900,
  '3X': 139900,
  'WPP': 0  // Sin promo
};

const promoNormalized = promo.toUpperCase();
const amount = promoAmounts[promoNormalized] || 0;
```

**Nombre de la orden:**
```javascript
// SOLO "Nombre Apellido" (sin promo)
const ordenName = `${captured.nombre} ${captured.apellido}`.trim();
```

**Fecha de cierre (hoy):**
```javascript
const today = new Date();
const closingDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
// Formato: DD/MM/YYYY
```

**Body del pedido:**
```json
{
  "ordenName": "Juan Perez",
  "stage": "Nuevo Ingreso",
  "closingDate": "17/01/2026",
  "amount": 109900,
  "telefono": "573137549286",
  "direccion": "Calle 123 #45-67",
  "municipio": "Bogotá",
  "departamento": "Cundinamarca",
  "email": "juan@email.com",
  "description": "WPP",
  "callBell": "https://dash.callbell.eu/..."
}
```

**Campos clave:**
- `stage`: Siempre "Nuevo Ingreso"
- `description`: Siempre "WPP" (la promo está implícita en el precio)
- `callBell`: Link a la conversación de Callbell

### 5. Creación en Bigin
```
Prepare Bigin Order → Create Order in Bigin
```

**API Call:**
```
POST http://robot-api.local:3000/bigin/create-order
Content-Type: application/json
Timeout: 180 segundos (3 minutos)

Body: {order_body}
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "ordenName": "Juan Perez",
    "orderId": "123456",
    "orderUrl": "https://crm.zoho.com/crm/.../123456"
  }
}
```

### 6. Marcar Orden Creada
```
Create Order in Bigin → Mark Order Created
```

**SQL Update:**
```sql
UPDATE sessions_v3
SET state = jsonb_set(
  jsonb_set(
    COALESCE(state, captured_data, '{}'::jsonb),
    '{order_created}',
    'true'::jsonb
  ),
  '{order_created_at}',
  to_jsonb(NOW()::text)
)
WHERE phone = '{{phone}}' AND status = 'active'
RETURNING *
```

**Efecto:**
```json
{
  "captured_data": {
    ...campos anteriores...,
    "order_created": true,
    "order_created_at": "2026-01-17T00:26:00.000Z"
  }
}
```

### 7. Return Success
```
Mark Order Created → Return Success
```

**Response:**
```json
{
  "success": true,
  "order_created": true,
  "order_name": "Juan Perez",
  "phone": "57...",
  "amount": 109900,
  "source": "historial_v3",
  "bigin_response": {
    "data": {
      "ordenName": "Juan Perez",
      "orderId": "123456",
      "orderUrl": "https://..."
    }
  }
}
```

### 8. Return Error (Si falla validación)
```
Return Error
```

**Response:**
```json
{
  "success": false,
  "order_created": false,
  "error": "Invalid data: missing required fields",
  "missing_fields": ["ciudad", "departamento"],
  "phone": "57..."
}
```

## 💰 Tabla de Precios

| Pack | Precio COP |
|------|-----------|
| 1x   | $77,900   |
| 2x   | $109,900  |
| 3x   | $139,900  |
| WPP  | $0        |

**WPP:** Cliente con datos completos pero sin pack seleccionado.

## 🎯 Casos de Uso

### Caso 1: Orden Normal (con pack)
```
Input:
  pack: "2x"
  captured_data: {nombre, apellido, telefono, direccion, ciudad, departamento, correo}

Validation: ✅ Campos completos
Prepare: ordenName = "Juan Perez", amount = 109900
Create: POST a robot-api.local
Mark: order_created = true
Output: {success: true, order_name: "Juan Perez"}
```

### Caso 2: Orden sin Pack (WPP)
```
Input:
  promo_override: "WPP"
  captured_data: {nombre, apellido, telefono, direccion, ciudad, departamento}

Validation: ✅ Campos mínimos completos
Prepare: ordenName = "Juan Perez", amount = 0, description = "WPP"
Create: POST a robot-api.local
Output: {success: true, order_name: "Juan Perez"}
```

### Caso 3: Datos Incompletos
```
Input:
  captured_data: {nombre, apellido}  // ⚠️ Falta telefono, direccion, etc.

Validation: ❌ Missing fields
Output: {success: false, error: "Invalid data", missing_fields: [...]}
```

## 🔗 Integraciones

### Robot API (Bigin CRM)
- **Endpoint:** `http://robot-api.local:3000/bigin/create-order`
- **Method:** POST
- **Timeout:** 180 segundos
- **Purpose:** Crear pedido en Bigin CRM (Zoho)

### PostgreSQL
- **Update:** sessions_v3 table
- **Purpose:** Marcar order_created flag

## 📊 Flujo de Datos

```
Historial v3 (Should Create Order?)
  ↓
Order Manager (valida + prepara)
  ↓
Robot API (crea en Bigin CRM)
  ↓
PostgreSQL (marca order_created)
  ↓
Response → Historial v3
```

## ⚙️ Configuración

### Credenciales n8n
- **Postgres:** `Postgres Historial v3`

### Variables de Entorno (Robot API)
```bash
ROBOT_API_URL=http://robot-api.local:3000
BIGIN_API_KEY=...
BIGIN_ORG_ID=...
```

## 📈 Métricas y Logs

### Console Logs
- `📥 ORDER MANAGER TRIGGERED` - Request recibido
- `Source: historial_v3` - Fuente del request
- `Phone: 57...` - Teléfono del cliente
- `✅ VALIDATING DATA FOR ORDER` - Validación iniciada
- `Minimum fields complete: true/false` - Estado de validación
- `Missing fields: [...]` - Campos faltantes
- `📦 PREPARING BIGIN ORDER` - Preparación del pedido
- `Promo: 2x` - Promo/Pack detectado
- `Callbell link: https://...` - Link de conversación

## 🚨 Errores Comunes

### Error: "Missing required fields"
**Causa:** Datos incompletos
**Solución:** Retorna error 400, no crea orden

### Error: "Robot API timeout"
**Causa:** Bigin API lenta o caída
**Solución:** Timeout 180s, retry manual si falla

### Error: "Order already created"
**Causa:** order_created === true
**Solución:** Historial v3 verifica antes de llamar

## 🔗 Dependencias

**Order Manager depende de:**
- Robot API (Bigin CRM)
- PostgreSQL (sessions_v3)
- Historial v3 (llamado por)

**Workflows que dependen de Order Manager:**
- Historial v3 (llama cuando crear orden)
- Proactive Timers (llama para órdenes pendientes)

## 📝 Notas Importantes

1. **Validación estricta:** 6 campos mínimos requeridos
2. **Promo override:** Permite forzar promo específica (ej: WPP)
3. **Idempotencia:** order_created flag evita duplicados
4. **Link de Callbell:** Guardado en campo callBell de Bigin
5. **Timeout generoso:** 180s para esperar respuesta de Bigin
6. **Description siempre WPP:** La promo está implícita en el precio
7. **Fecha automática:** Usa fecha actual como closing date
