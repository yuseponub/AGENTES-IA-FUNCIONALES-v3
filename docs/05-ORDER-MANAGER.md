# 05 - ORDER MANAGER

> **Rol:** Integrador CRM - Creador de Órdenes en Bigin
> **Endpoint:** `POST /webhook/order-manager`
> **Archivo:** `workflows/05-order-manager.json`

---

## 1. DESCRIPCIÓN GENERAL

Order Manager es el **agente de integración CRM** del sistema v3DSL. Valida datos del cliente, prepara órdenes con precios según pack seleccionado, crea registros en Zoho Bigin vía Robot API, y actualiza contactos en Callbell con tags de seguimiento.

### Responsabilidades Principales
- Validar que la orden no exista previamente
- Verificar campos obligatorios completos
- Mapear packs a precios COP
- Crear orden en Bigin CRM
- Agregar tags de seguimiento en Callbell
- Actualizar estado de sesión en PostgreSQL

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ORDER MANAGER                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐                        │
│  │ Webhook  │───▶│ Parse       │───▶│ Check Order      │                        │
│  │ POST     │    │ Request     │    │ Exists (DB)      │                        │
│  └──────────┘    └─────────────┘    └────────┬─────────┘                        │
│                                               │                                  │
│                              ┌────────────────┴────────────────┐                 │
│                              ▼                                 ▼                 │
│                       [order_exists]                    [no_order]               │
│                              │                                 │                 │
│                              ▼                                 ▼                 │
│                       ┌─────────────┐                  ┌─────────────┐           │
│                       │ Return      │                  │ Validate    │           │
│                       │ Already     │                  │ Data        │           │
│                       │ Created     │                  └──────┬──────┘           │
│                       └─────────────┘                         │                  │
│                                               ┌───────────────┴───────────────┐  │
│                                               ▼                               ▼  │
│                                        [data_valid]                   [data_invalid]
│                                               │                               │  │
│                                               ▼                               ▼  │
│                                        ┌─────────────┐                ┌──────────┐
│                                        │ Prepare     │                │ Return   │
│                                        │ Bigin Order │                │ Error    │
│                                        └──────┬──────┘                └──────────┘
│                                               │                                  │
│                                               ▼                                  │
│                                        ┌─────────────┐                           │
│                                        │ Create in   │                           │
│                                        │ Bigin (API) │                           │
│                                        └──────┬──────┘                           │
│                                               │                                  │
│                              ┌────────────────┼────────────────┐                 │
│                              ▼                ▼                ▼                 │
│                       ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│                       │ Log Order   │  │ Update      │  │ Add Tags    │          │
│                       │ Created     │  │ Callbell    │  │ Callbell    │          │
│                       └──────┬──────┘  └──────┬──────┘  └─────────────┘          │
│                              │                │                                  │
│                              └────────┬───────┘                                  │
│                                       ▼                                          │
│                                ┌─────────────┐                                   │
│                                │ Update DB   │                                   │
│                                │ order_created│                                  │
│                                └──────┬──────┘                                   │
│                                       ▼                                          │
│                                ┌─────────────┐                                   │
│                                │ Return      │                                   │
│                                │ Success     │                                   │
│                                └─────────────┘                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook: Order Manager** | `webhook` | Recibe POST en `/order-manager` |
| 2 | **Parse Request** | `code` | Extrae phone, captured_data, promo, source, callbell_info |
| 3 | **Check Order Exists** | `postgres` | Verifica si `order_created=true` en sesión (últimos 3 días) |
| 4 | **Order Already Created?** | `if` | Condición: `skip_order === true` |
| 5 | **Validate Data** | `code` | Verifica 6 campos obligatorios |
| 6 | **IF: Valid Data?** | `if` | Bifurca según validación |
| 7 | **Prepare Bigin Order** | `code` | Construye payload con precios y fechas |
| 8 | **Create Order in Bigin** | `httpRequest` | POST a `robot-api.local:3000/bigin/create-order` |
| 9 | **Log Order Created** | `code` | Extrae order_name, order_id, order_url |
| 10 | **Arreglar Callbell** | `code` | Prepara actualización de contacto |
| 11 | **HTTP: Add RB Tag** | `httpRequest` | PATCH a Callbell API (tags + custom fields) |
| 12 | **Update Order Created Flag** | `postgres` | Actualiza state con timestamp |
| 13 | **Mark Order Created** | `postgres` | `order_created = true` en state |
| 14 | **Return Success** | `respondToWebhook` | Retorna éxito con datos de orden |
| 15 | **Return Error** | `respondToWebhook` | Retorna error con campos faltantes |
| 16 | **Return Already Created** | `respondToWebhook` | Retorna que orden ya existe |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST http://localhost:5678/webhook/order-manager
```

**Headers:**
```
Content-Type: application/json
```

**Payload de Entrada:**
```json
{
  "phone": "573001234567",
  "captured_data": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "barrio": "Centro",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "correo": "juan@email.com",
    "pack": "2x",
    "precio": 109900
  },
  "promo": "2x",
  "source": "historial_v3",
  "callbell_conversation_href": "https://dash.callbell.eu/conversations/abc123",
  "contact_id": "contact_uuid_789"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "order": {
    "id": "12345678901234567890",
    "name": "Juan Pérez",
    "url": "https://crm.zoho.com/bigin/...",
    "amount": 109900,
    "promo": "2x"
  },
  "callbell_updated": true
}
```

**Respuesta Error (datos incompletos):**
```json
{
  "success": false,
  "error": "missing_fields",
  "missing": ["direccion", "departamento"]
}
```

**Respuesta Error (orden existente):**
```json
{
  "success": false,
  "error": "order_already_exists",
  "existing_order_at": "2026-01-20T15:30:00.000Z"
}
```

### 3.2 Endpoints Consumidos

| Servicio | Endpoint | Método | Propósito |
|----------|----------|--------|-----------|
| Robot API | `http://robot-api.local:3000/bigin/create-order` | POST | Crear orden en Bigin |
| Callbell API | `https://api.callbell.eu/v1/contacts/{uuid}` | PATCH | Actualizar tags |

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Campos Obligatorios

```javascript
const REQUIRED_FIELDS = [
  'nombre',
  'apellido',
  'telefono',
  'direccion',
  'ciudad',
  'departamento'
];

function validateRequiredFields(data) {
  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || data[field].trim() === '' || data[field] === 'N/A') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
```

### 4.2 Mapeo de Precios

```javascript
const PROMO_PRICES = {
  '1x': 77900,
  '1X': 77900,
  '2x': 109900,
  '2X': 109900,
  '3x': 139900,
  '3X': 139900,
  'WPP': 0  // Sin pack seleccionado
};

function getPrice(promo) {
  return PROMO_PRICES[promo] || 0;
}
```

### 4.3 Preparación de Orden Bigin

```javascript
function prepareBiginOrder(data, promo) {
  const today = new Date();
  const closingDate = formatDate(today, 'DD/MM/YYYY');

  return {
    order_name: `${data.nombre} ${data.apellido}`,
    stage: 'Nuevo Ingreso',
    closing_date: closingDate,
    amount: getPrice(promo),
    description: 'WPP',
    contact: {
      nombre: data.nombre,
      apellido: data.apellido,
      telefono: data.telefono,
      email: data.correo || '',
      direccion: data.direccion,
      barrio: data.barrio || '',
      ciudad: data.ciudad,
      departamento: data.departamento
    },
    metadata: {
      source: 'v3dsl_bot',
      promo: promo,
      callbell_href: data.callbell_conversation_href
    }
  };
}
```

### 4.4 Verificación de Orden Existente

```javascript
// Query PostgreSQL
const CHECK_ORDER_QUERY = `
  SELECT
    session_id,
    state->>'order_created' as order_created,
    state->>'order_created_at' as order_created_at
  FROM sessions_v3
  WHERE phone = $1
    AND status = 'active'
    AND created_at > NOW() - INTERVAL '3 days'
    AND (state->>'order_created')::boolean = true
  LIMIT 1
`;

function shouldSkipOrder(result) {
  if (result && result.order_created === 'true') {
    return {
      skip: true,
      existing_at: result.order_created_at
    };
  }
  return { skip: false };
}
```

### 4.5 Actualización de Callbell

```javascript
// Tags a agregar
const TAGS_TO_ADD = ['WPP', 'RB'];

// Custom fields a actualizar
function prepareCallbellUpdate(orderData) {
  return {
    tags: TAGS_TO_ADD,
    custom_fields: {
      bigin_order_url: orderData.url,
      order_amount: orderData.amount,
      order_date: new Date().toISOString()
    }
  };
}

// PATCH request
async function updateCallbellContact(contactUuid, updateData) {
  const response = await fetch(
    `https://api.callbell.eu/v1/contacts/${contactUuid}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CALLBELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    }
  );
  return response.json();
}
```

---

## 5. INTEGRACIÓN CON ROBOT API

### 5.1 Endpoint Robot API

```
POST http://robot-api.local:3000/bigin/create-order
```

**Timeout:** 180 segundos (Bigin automation es lenta)

### 5.2 Payload a Robot API

```json
{
  "order_name": "Juan Pérez",
  "stage": "Nuevo Ingreso",
  "closing_date": "21/01/2026",
  "amount": 109900,
  "description": "WPP",
  "contact": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "email": "juan@email.com",
    "direccion": "Calle 123 #45-67",
    "barrio": "Centro",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca"
  },
  "metadata": {
    "source": "v3dsl_bot",
    "promo": "2x",
    "callbell_href": "https://dash.callbell.eu/conversations/abc123"
  }
}
```

### 5.3 Respuesta de Robot API

```json
{
  "success": true,
  "order": {
    "id": "12345678901234567890",
    "name": "Juan Pérez",
    "url": "https://crm.zoho.com/bigin/org123/tab/Potentials/12345678901234567890"
  }
}
```

### 5.4 Manejo de Errores Robot API

| Error | Causa | Manejo |
|-------|-------|--------|
| Timeout | Bigin lento | Reintentar 1 vez |
| Session expired | Bigin login expirado | Robot API hace re-login |
| Duplicate | Orden ya existe en Bigin | Marcar como creada |
| Validation | Datos inválidos para Bigin | Retornar error |

---

## 6. ACTUALIZACIÓN DE BASE DE DATOS

### 6.1 Query de Actualización

```sql
UPDATE sessions_v3
SET
  state = state || jsonb_build_object(
    'order_created', true,
    'order_created_at', NOW()::text,
    'order_id', $2,
    'order_url', $3,
    'order_promo', $4,
    'order_amount', $5
  ),
  updated_at = NOW()
WHERE phone = $1
  AND status = 'active';
```

### 6.2 Campos Actualizados en State

```json
{
  "order_created": true,
  "order_created_at": "2026-01-21T10:30:00.000Z",
  "order_id": "12345678901234567890",
  "order_url": "https://crm.zoho.com/bigin/...",
  "order_promo": "2x",
  "order_amount": 109900
}
```

---

## 7. MANEJO DE ERRORES

### 7.1 Errores Esperados

| Error | Causa | Respuesta |
|-------|-------|-----------|
| `missing_fields` | Campos obligatorios faltantes | `{ success: false, missing: [...] }` |
| `order_already_exists` | Orden creada previamente | `{ success: false, existing_order_at: "..." }` |
| `bigin_timeout` | Robot API timeout | Retry o error |
| `bigin_error` | Error en creación CRM | `{ success: false, error: "bigin_failed" }` |
| `callbell_error` | Error actualizando contacto | Log pero no falla la orden |

### 7.2 Estrategia de Retry

```javascript
const RETRY_CONFIG = {
  bigin: {
    maxAttempts: 2,
    delay: 5000 // 5 segundos entre intentos
  },
  callbell: {
    maxAttempts: 3,
    delay: 1000
  }
};
```

---

## 8. MÉTRICAS Y LOGGING

### 8.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `order_requested` | phone, promo, source |
| `validation_failed` | phone, missing_fields |
| `order_skipped` | phone, reason (already_exists) |
| `bigin_request` | order_name, amount |
| `bigin_success` | order_id, order_url, latency_ms |
| `bigin_error` | error_type, error_message |
| `callbell_updated` | contact_uuid, tags_added |
| `db_updated` | session_id, fields_updated |

---

## 9. CONSIDERACIONES PARA MORFX

### 9.1 Abstracción de CRM

```typescript
interface CRMIntegration {
  createOrder(order: Order): Promise<CreateOrderResult>;
  updateOrder(orderId: string, updates: Partial<Order>): Promise<void>;
  getOrder(orderId: string): Promise<Order | null>;
}

interface Order {
  name: string;
  stage: string;
  amount: number;
  closingDate: Date;
  contact: Contact;
  metadata: Record<string, any>;
}

// Implementaciones por CRM
class BiginCRM implements CRMIntegration { ... }
class HubspotCRM implements CRMIntegration { ... }
class SalesforceCRM implements CRMIntegration { ... }
class CustomCRM implements CRMIntegration { ... }
```

### 9.2 Configuración de Productos por Tenant

```typescript
interface ProductConfig {
  tenantId: string;
  products: Product[];
  pricingRules: PricingRule[];
  stages: Stage[];
}

interface Product {
  sku: string;
  name: string;
  basePrice: number;
  variants: ProductVariant[];
}

interface ProductVariant {
  code: string; // "1x", "2x", "3x"
  quantity: number;
  price: number;
  discount: number;
}
```

### 9.3 Pipeline de Órdenes

```typescript
interface OrderPipeline {
  stages: PipelineStage[];
  transitions: StageTransition[];
  automations: StageAutomation[];
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  actions: StageAction[];
}

// Ejemplo de pipeline Somnio
const SOMNIO_PIPELINE: OrderPipeline = {
  stages: [
    { id: 'nuevo', name: 'Nuevo Ingreso', order: 1, probability: 10 },
    { id: 'confirmado', name: 'Confirmado', order: 2, probability: 50 },
    { id: 'enviado', name: 'Enviado', order: 3, probability: 80 },
    { id: 'entregado', name: 'Entregado', order: 4, probability: 100 },
    { id: 'cancelado', name: 'Cancelado', order: 99, probability: 0 }
  ],
  transitions: [
    { from: 'nuevo', to: 'confirmado', trigger: 'manual' },
    { from: 'confirmado', to: 'enviado', trigger: 'shipping_created' },
    { from: 'enviado', to: 'entregado', trigger: 'delivery_confirmed' }
  ]
};
```

### 9.4 Webhooks de Eventos

```typescript
interface OrderWebhook {
  event: 'order.created' | 'order.updated' | 'order.stage_changed';
  payload: OrderEventPayload;
  timestamp: Date;
  signature: string;
}

interface OrderEventPayload {
  orderId: string;
  tenantId: string;
  previousState?: Partial<Order>;
  currentState: Order;
  triggeredBy: string;
}

// Endpoints para recibir eventos de CRM
const ORDER_WEBHOOKS = {
  'bigin.order.updated': '/webhooks/bigin/order-updated',
  'bigin.stage.changed': '/webhooks/bigin/stage-changed'
};
```
