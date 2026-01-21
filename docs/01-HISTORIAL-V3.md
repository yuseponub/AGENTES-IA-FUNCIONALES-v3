# 01 - HISTORIAL V3

> **Rol:** Orquestador Central del Sistema
> **Endpoint:** `POST /webhook/historial-v3-callbell-webhook`
> **Archivo:** `workflows/01-historial-v3.json`

---

## 1. DESCRIPCIÓN GENERAL

Historial V3 es el **corazón del sistema v3DSL**. Actúa como punto de entrada único para todos los mensajes de WhatsApp recibidos vía Callbell, orquestando el flujo completo de procesamiento: validación, persistencia, análisis de intención, extracción de datos y disparo de respuestas.

### Responsabilidades Principales
- Recibir y validar webhooks de Callbell
- Gestionar sesiones de conversación en PostgreSQL
- Persistir mensajes con deduplicación
- Coordinar llamadas a agentes especializados (State Analyzer, Data Extractor)
- Disparar creación de órdenes cuando se cumplen condiciones
- Activar el agente de respuestas (Carolina V3)

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HISTORIAL V3                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────────┐        │
│  │ Webhook  │───▶│ Respond  │───▶│ Parse       │───▶│ Check Blocked    │        │
│  │ Callbell │    │ 200 OK   │    │ Payload     │    │ Tags & Duplicates│        │
│  └──────────┘    └──────────┘    └─────────────┘    └────────┬─────────┘        │
│                                                               │                  │
│                         ┌─────────────────────────────────────┴───────┐          │
│                         ▼                                             ▼          │
│                  ┌─────────────┐                              ┌──────────────┐   │
│                  │ IF: Should  │──────[BLOCKED]──────────────▶│ Log Blocked  │   │
│                  │ Block?      │                              │ Message      │   │
│                  └──────┬──────┘                              └──────────────┘   │
│                         │ [CONTINUE]                                             │
│                         ▼                                                        │
│                  ┌─────────────┐                                                 │
│                  │ Find        │                                                 │
│                  │ Session     │                                                 │
│                  └──────┬──────┘                                                 │
│                         │                                                        │
│           ┌─────────────┴─────────────┐                                         │
│           ▼                           ▼                                         │
│    ┌─────────────┐             ┌─────────────┐                                  │
│    │ Merge       │             │ Create New  │                                  │
│    │ Existing    │             │ Session ID  │                                  │
│    └──────┬──────┘             └──────┬──────┘                                  │
│           └─────────────┬─────────────┘                                         │
│                         ▼                                                        │
│                  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐      │
│                  │ Insert/     │───▶│ Preserve    │───▶│ Insert          │      │
│                  │ Update Sess │    │ Message     │    │ Message         │      │
│                  └─────────────┘    └─────────────┘    └────────┬────────┘      │
│                                                                  │               │
│                                                     ┌────────────┴───────┐       │
│                                                     ▼                    ▼       │
│                                              ┌─────────────┐     ┌────────────┐  │
│                                              │ IF: Inbound?│     │ Log        │  │
│                                              │             │────▶│ Outbound   │  │
│                                              └──────┬──────┘     │ Skip       │  │
│                                                     │            └────────────┘  │
│                                                     ▼ [INBOUND]                  │
│                                              ┌─────────────┐                     │
│                                              │ Get Messages│                     │
│                                              │ for Snapshot│                     │
│                                              └──────┬──────┘                     │
│                                                     ▼                            │
│                                              ┌─────────────┐                     │
│                                              │ Format      │                     │
│                                              │ Snapshot    │                     │
│                                              └──────┬──────┘                     │
│                                                     ▼                            │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                    LLAMADAS A AGENTES EXTERNOS                            │  │
│  │                                                                           │  │
│  │  ┌─────────────────┐         ┌─────────────────┐         ┌────────────┐  │  │
│  │  │ Call State      │────────▶│ Update Session  │────────▶│ IF: Mode   │  │  │
│  │  │ Analyzer        │         │ with Results    │         │ collecting?│  │  │
│  │  └─────────────────┘         └─────────────────┘         └─────┬──────┘  │  │
│  │                                                                 │         │  │
│  │                              ┌──────────────────────────────────┴───┐     │  │
│  │                              ▼                                      ▼     │  │
│  │                       ┌─────────────────┐                    [CONTINUE]   │  │
│  │                       │ Call Data       │                          │      │  │
│  │                       │ Extractor       │                          │      │  │
│  │                       └────────┬────────┘                          │      │  │
│  │                                │                                   │      │  │
│  │                                └───────────────┬───────────────────┘      │  │
│  │                                                ▼                          │  │
│  │                                         ┌─────────────┐                   │  │
│  │                                         │ Merge Data  │                   │  │
│  │                                         └──────┬──────┘                   │  │
│  │                                                ▼                          │  │
│  │                                         ┌─────────────┐                   │  │
│  │                                         │ Update State│                   │  │
│  │                                         │ PostgreSQL  │                   │  │
│  │                                         └──────┬──────┘                   │  │
│  └───────────────────────────────────────────────┬───────────────────────────┘  │
│                                                   ▼                              │
│                                            ┌─────────────┐                       │
│                                            │ Should      │                       │
│                                            │ Create Order│                       │
│                                            └──────┬──────┘                       │
│                                    ┌──────────────┴──────────────┐               │
│                                    ▼                             ▼               │
│                             ┌─────────────┐               ┌─────────────┐        │
│                             │ Call Order  │               │ Trigger     │        │
│                             │ Manager     │──────────────▶│ Carolina V3 │        │
│                             └─────────────┘               └─────────────┘        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook Callbell** | `webhook` | Recibe POST de Callbell con mensajes entrantes |
| 2 | **Respond Immediately** | `respondToWebhook` | Retorna 200 OK inmediatamente para no bloquear Callbell |
| 3 | **Parse Payload** | `code` | Extrae y normaliza: uuid, phone, direction, tags, contact_id, conversation_href |
| 4 | **Check Blocked Tags and Duplicates** | `code` | Valida tags bloqueados y antigüedad del mensaje |
| 5 | **IF: Should Block Message?** | `if` | Bifurca: continuar o bloquear |
| 6 | **Find Session** | `postgres` | Busca sesión existente por teléfono |
| 7 | **Check Session Exists** | `if` | Determina si crear nueva o usar existente |
| 8 | **Merge Existing Session** | `code` | Combina datos existentes con nuevos tags |
| 9 | **Create New Session ID** | `code` | Genera `session_${phone}_${timestamp}` |
| 10 | **Insert/Update Session** | `postgres` | Persiste sesión en `sessions_v3` |
| 11 | **Preserve Message Data** | `code` | Recupera objeto mensaje post-insert |
| 12 | **Insert Message** | `postgres` | Persiste en `messages_v3` con deduplicación |
| 13 | **Check Direction (Inbound?)** | `if` | Filtra: solo procesa inbound |
| 14 | **Log Outbound Skip** | `code` | Registra mensajes outbound ignorados |
| 15 | **Get Messages for Snapshot** | `postgres` | Obtiene historial + state para snapshot |
| 16 | **Format Snapshot for State Analyzer** | `code` | Construye payload para análisis de intent |
| 17 | **Call State Analyzer** | `httpRequest` | POST a `/webhook/state-analyzer` |
| 18 | **Update Session with State Analyzer Results** | `postgres` | Merge de state + mode + last_activity |
| 19 | **Check Mode (collecting_data?)** | `if` | Bifurca según modo de conversación |
| 20 | **Call Data Extractor Simple** | `httpRequest` | POST a `/webhook/data-extractor` |
| 21 | **Merge Data** | `code` | Combina resultados de State Analyzer + Data Extractor |
| 22 | **Update State in PostgreSQL** | `postgres` | Actualización final con intent tracking |
| 23 | **Should Create Order?** | `if` | Evalúa condiciones de creación de orden |
| 24 | **Call Order Manager** | `httpRequest` | POST a `/webhook/order-manager` |
| 25 | **Trigger Carolina V3** | `httpRequest` | POST a `/webhook/carolina-v3-process` |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST https://n8n.automatizacionesmorf.com/webhook/historial-v3-callbell-webhook
```

**Headers requeridos:**
```json
{
  "Content-Type": "application/json"
}
```

**Payload Callbell (formato real):**
```json
{
  "event": "message_created",
  "payload": {
    "uuid": "msg_uuid_123",
    "conversationUuid": "conv_uuid_456",
    "channel": "whatsapp",
    "direction": "inbound",
    "text": "Hola, quiero comprar",
    "from": "573001234567",
    "to": "573009876543",
    "contact": {
      "uuid": "contact_uuid_789",
      "name": "Juan Pérez",
      "phone": "573001234567",
      "tags": ["lead"],
      "customFields": {}
    },
    "conversation": {
      "href": "https://dash.callbell.eu/conversations/conv_uuid_456"
    },
    "createdAt": "2026-01-21T10:30:00.000Z"
  }
}
```

**Payload Test (formato simplificado):**
```json
{
  "uuid": "test_msg_001",
  "from": "573001234567",
  "to": "573009876543",
  "text": "Quiero información del precio",
  "direction": "inbound",
  "tags": []
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Message received"
}
```

### 3.2 Endpoints Llamados (Outbound)

| Agente | Endpoint | Método |
|--------|----------|--------|
| State Analyzer | `https://n8n.automatizacionesmorf.com/webhook/state-analyzer` | POST |
| Data Extractor | `https://n8n.automatizacionesmorf.com/webhook/data-extractor` | POST |
| Order Manager | `http://localhost:5678/webhook/order-manager` | POST |
| Carolina V3 | `https://n8n.automatizacionesmorf.com/webhook/carolina-v3-process` | POST |

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Validación de Tags Bloqueados

```javascript
const BLOCKED_TAGS = ['WPP', 'P/W', 'RECO', 'bot_off'];

function shouldBlock(tags) {
  return tags.some(tag => BLOCKED_TAGS.includes(tag.toUpperCase()));
}
```

| Tag | Significado | Acción |
|-----|-------------|--------|
| `WPP` | Compra completada vía WhatsApp | Bloquea procesamiento |
| `P/W` | Proceso web activo | Bloquea procesamiento |
| `RECO` | Modo remarketing | Bloquea procesamiento |
| `bot_off` | Bot deshabilitado manualmente | Bloquea procesamiento |

### 4.2 Validación de Antigüedad

```javascript
const MAX_MESSAGE_AGE_SECONDS = 120; // 2 minutos

function isMessageTooOld(createdAt) {
  const messageTime = new Date(createdAt);
  const now = new Date();
  const ageSeconds = (now - messageTime) / 1000;
  return ageSeconds > MAX_MESSAGE_AGE_SECONDS;
}
```

### 4.3 Normalización de Teléfono

```javascript
function normalizePhone(phone) {
  // Remover caracteres no numéricos
  let clean = phone.replace(/\D/g, '');

  // Agregar prefijo colombiano si falta
  if (clean.length === 10 && clean.startsWith('3')) {
    clean = '57' + clean;
  }

  return clean;
}
```

### 4.4 Generación de Session ID

```javascript
function generateSessionId(phone) {
  const timestamp = Date.now();
  return `session_${phone}_${timestamp}`;
}
```

### 4.5 Condiciones para Crear Orden

```javascript
const ORDER_INTENTS = ['resumen_1x', 'resumen_2x', 'resumen_3x'];

function shouldCreateOrder(state, intent) {
  return (
    ORDER_INTENTS.includes(intent) &&
    !state.order_created &&
    hasMinimumFields(state)
  );
}

function hasMinimumFields(state) {
  const REQUIRED = ['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento'];
  return REQUIRED.every(field => state[field] && state[field].trim() !== '');
}
```

---

## 5. MODELO DE DATOS

### 5.1 Tabla `sessions_v3`

```sql
CREATE TABLE sessions_v3 (
  session_id VARCHAR(100) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  contact_id VARCHAR(100),
  callbell_conversation_href TEXT,
  state JSONB DEFAULT '{}',
  mode VARCHAR(50) DEFAULT 'conversacion',
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_phone ON sessions_v3(phone);
CREATE INDEX idx_sessions_status ON sessions_v3(status);
```

**Campos del objeto `state` (JSONB):**

```json
{
  // Datos personales capturados
  "nombre": "Juan",
  "apellido": "Pérez",
  "telefono": "573001234567",
  "direccion": "Calle 123 #45-67",
  "barrio": "Centro",
  "ciudad": "Bogotá",
  "departamento": "Cundinamarca",
  "correo": "juan@email.com",

  // Datos de compra
  "pack": "2x",
  "precio": 109900,

  // Tracking de intents
  "_last_intent": "ofrecer_promos",
  "_intents_vistos": [
    {"intent": "hola", "orden": 1},
    {"intent": "captura_datos_si_compra", "orden": 2}
  ],

  // Flags de acciones
  "order_created": false,
  "order_created_at": null,

  // Metadata proactiva
  "_proactive_timer_active": false,
  "_proactive_started_at": null,
  "_first_data_at": null,
  "_min_data_at": null,
  "_ofrecer_promos_at": null,
  "_action_no_data_sent": false,
  "_action_missing_data_sent": false,
  "_action_ofrecer_promos_done": false
}
```

### 5.2 Tabla `messages_v3`

```sql
CREATE TABLE messages_v3 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) REFERENCES sessions_v3(session_id),
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  direction VARCHAR(20) NOT NULL, -- 'inbound' | 'outbound'
  callbell_message_id VARCHAR(100) UNIQUE,
  intent VARCHAR(100),
  payload_raw JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages_v3(session_id);
CREATE INDEX idx_messages_callbell_id ON messages_v3(callbell_message_id);
```

---

## 6. INTEGRACIÓN CON OTROS AGENTES

### 6.1 Payload a State Analyzer

```json
{
  "phone": "573001234567",
  "historial": [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy Carolina..."},
    {"role": "user", "content": "Cuánto cuesta?"}
  ],
  "pending_messages": [
    {"role": "user", "content": "Cuánto cuesta?"}
  ],
  "captured_data": {
    "nombre": "Juan",
    "_intents_vistos": [{"intent": "hola", "orden": 1}]
  }
}
```

### 6.2 Payload a Data Extractor

```json
{
  "phone": "573001234567",
  "last_message": "Me llamo Juan Pérez, vivo en Bogotá",
  "captured_data": {
    "nombre": null,
    "apellido": null,
    "ciudad": null
  }
}
```

### 6.3 Payload a Order Manager

```json
{
  "phone": "573001234567",
  "captured_data": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "pack": "2x"
  },
  "source": "historial_v3",
  "callbell_conversation_href": "https://dash.callbell.eu/conversations/..."
}
```

### 6.4 Payload a Carolina V3

```json
{
  "phone": "573001234567"
}
```

---

## 7. MANEJO DE ERRORES

### 7.1 Errores Esperados

| Error | Causa | Manejo |
|-------|-------|--------|
| Mensaje duplicado | `callbell_message_id` ya existe | `ON CONFLICT DO NOTHING` |
| Sesión no encontrada | Teléfono nuevo | Crear nueva sesión |
| State Analyzer timeout | Demora >30s | Continuar sin intent (fallback) |
| Data Extractor falla | API Anthropic caída | Continuar con datos existentes |

### 7.2 Configuración de Timeouts

```javascript
const TIMEOUTS = {
  stateAnalyzer: 30000,    // 30 segundos
  dataExtractor: 30000,    // 30 segundos
  orderManager: 180000,    // 3 minutos (Bigin es lento)
  carolina: 10000          // 10 segundos
};
```

---

## 8. MÉTRICAS Y LOGGING

### 8.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `message_received` | phone, direction, has_tags |
| `message_blocked` | phone, reason (tag/age) |
| `session_created` | session_id, phone |
| `session_updated` | session_id, mode, version |
| `intent_detected` | session_id, intent |
| `data_extracted` | session_id, fields_updated |
| `order_triggered` | session_id, pack, precio |

### 8.2 Puntos de Observabilidad

Para integración futura con MorfX:

```javascript
// Hook para métricas
const METRICS_HOOKS = {
  onMessageReceived: (data) => {},
  onIntentDetected: (session, intent) => {},
  onDataCaptured: (session, fields) => {},
  onOrderCreated: (session, order) => {},
  onResponseSent: (session, templates) => {}
};
```

---

## 9. CONSIDERACIONES PARA MORFX

### 9.1 Puntos de Extensión

1. **Multi-tenant:** El `session_id` puede incluir `tenant_id` como prefijo
2. **Multi-canal:** El campo `source` puede diferenciar WhatsApp, Telegram, Web
3. **A/B Testing:** El state puede incluir `experiment_variant`
4. **Analytics:** Cada nodo puede emitir eventos a un bus de mensajes

### 9.2 Contratos de API Estables

```typescript
interface HistorialWebhookPayload {
  // Formato Callbell
  event?: 'message_created';
  payload?: CallbellPayload;

  // Formato directo/test
  uuid?: string;
  from?: string;
  to?: string;
  text?: string;
  direction?: 'inbound' | 'outbound';
  tags?: string[];
}

interface HistorialResponse {
  success: boolean;
  message: string;
}
```

### 9.3 Recomendaciones de Escalabilidad

- **Redis Cache:** Para sesiones activas (reduce latencia de lectura)
- **Queue System:** Para procesamiento asíncrono de mensajes
- **Read Replicas:** PostgreSQL para snapshots de solo lectura
- **Rate Limiting:** Por teléfono para evitar spam
