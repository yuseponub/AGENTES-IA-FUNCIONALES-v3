# 07 - SNAPSHOT

> **Rol:** API Read-Only de Estado de Conversación
> **Endpoint:** `GET /webhook/historial-v3-snapshot`
> **Archivo:** `workflows/07-snapshot.json`

---

## 1. DESCRIPCIÓN GENERAL

Snapshot es el **endpoint de consulta de estado** del sistema v3DSL. Proporciona una vista de solo lectura del estado actual de una conversación, incluyendo datos de sesión, historial de mensajes, mensajes pendientes, y versión para control de concurrencia.

### Responsabilidades Principales
- Proveer estado actual de sesión por teléfono
- Retornar historial de mensajes (últimos 100)
- Calcular mensajes pendientes (sin responder)
- Exponer versión para detección de interrupciones
- Servir como fuente de verdad para otros agentes

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                SNAPSHOT                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐                        │
│  │ Webhook  │───▶│ Parse       │───▶│ Get Session      │                        │
│  │ GET      │    │ Phone       │    │ (PostgreSQL)     │                        │
│  └──────────┘    └─────────────┘    └────────┬─────────┘                        │
│                                               │                                  │
│                              ┌────────────────┴────────────────┐                 │
│                              ▼                                 ▼                 │
│                       [session_found]                  [session_not_found]       │
│                              │                                 │                 │
│                              ▼                                 ▼                 │
│                       ┌─────────────┐                  ┌─────────────┐           │
│                       │ Get         │                  │ No Session  │           │
│                       │ Messages    │                  │ Found       │           │
│                       └──────┬──────┘                  └──────┬──────┘           │
│                              │                                │                  │
│                              ▼                                ▼                  │
│                       ┌─────────────┐                  ┌─────────────┐           │
│                       │ Compute     │                  │ Respond     │           │
│                       │ Snapshot    │                  │ Empty       │           │
│                       └──────┬──────┘                  └─────────────┘           │
│                              │                                                   │
│                              ▼                                                   │
│                       ┌─────────────┐                                            │
│                       │ Respond     │                                            │
│                       │ Snapshot    │                                            │
│                       └─────────────┘                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook: Snapshot** | `webhook` | Recibe GET en `/historial-v3-snapshot` |
| 2 | **Parse Phone** | `code` | Extrae y valida parámetro `phone` de query |
| 3 | **Get Session** | `postgres` | Query a `sessions_v3` por teléfono y status activo |
| 4 | **Session Exists?** | `if` | Verifica si se encontró sesión |
| 5 | **Get Messages** | `postgres` | Query a `messages_v3` ordenados, límite 100 |
| 6 | **Compute Snapshot** | `code` | Construye objeto snapshot con pending calculation |
| 7 | **Respond with Snapshot** | `respondToWebhook` | Retorna JSON con snapshot completo |
| 8 | **No Session Found** | `code` | Prepara respuesta de error |
| 9 | **Respond Empty** | `respondToWebhook` | Retorna snapshot vacío/error |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
GET https://n8n.automatizacionesmorf.com/webhook/historial-v3-snapshot?phone=573001234567
```

**Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `phone` | string | Sí | Teléfono en formato 57XXXXXXXXXX |

**Headers:**
```
Accept: application/json
```

### 3.2 Respuesta Exitosa

```json
{
  "success": true,
  "version": 5,
  "session_id": "session_573001234567_1705830000000",
  "phone": "573001234567",
  "contact_id": "contact_uuid_789",
  "business_id": "business_uuid_123",
  "state": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "barrio": "Centro",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "correo": "juan@email.com",
    "pack": "2x",
    "precio": 109900,
    "_last_intent": "resumen_2x",
    "_intents_vistos": [
      {"intent": "hola", "orden": 1},
      {"intent": "precio", "orden": 2},
      {"intent": "captura_datos_si_compra", "orden": 3},
      {"intent": "ofrecer_promos", "orden": 4},
      {"intent": "resumen_2x", "orden": 5}
    ],
    "order_created": false,
    "_proactive_timer_active": true
  },
  "mode": "collecting_data",
  "tags": ["lead", "interested"],
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Hola",
      "direction": "inbound",
      "intent": "hola",
      "created_at": "2026-01-21T10:00:00.000Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "¡Hola! Soy Carolina...",
      "direction": "outbound",
      "intent": null,
      "created_at": "2026-01-21T10:00:05.000Z"
    },
    {
      "id": 3,
      "role": "user",
      "content": "Cuánto cuesta?",
      "direction": "inbound",
      "intent": "precio",
      "created_at": "2026-01-21T10:01:00.000Z"
    }
  ],
  "pending": [
    {
      "id": 3,
      "role": "user",
      "content": "Cuánto cuesta?",
      "direction": "inbound",
      "created_at": "2026-01-21T10:01:00.000Z"
    }
  ],
  "pending_count": 1,
  "last_outbound_at": "2026-01-21T10:00:05.000Z",
  "last_processed_at": "2026-01-21T10:00:05.000Z"
}
```

### 3.3 Respuesta Error (Sesión no encontrada)

```json
{
  "success": false,
  "error": "session_not_found",
  "phone": "573001234567",
  "version": 0,
  "session_id": null,
  "state": {},
  "mode": null,
  "tags": [],
  "messages": [],
  "pending": [],
  "pending_count": 0
}
```

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Query de Sesión

```sql
SELECT
  session_id,
  phone,
  contact_id,
  callbell_conversation_href,
  state,
  mode,
  tags,
  status,
  version,
  created_at,
  updated_at,
  last_activity
FROM sessions_v3
WHERE phone = $1
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 1;
```

### 4.2 Query de Mensajes

```sql
SELECT
  id,
  role,
  content,
  direction,
  intent,
  created_at
FROM messages_v3
WHERE session_id = $1
ORDER BY created_at ASC
LIMIT 100;
```

### 4.3 Cálculo de Mensajes Pendientes

```javascript
function calculatePending(messages) {
  // Encontrar índice del último mensaje outbound
  let lastOutboundIndex = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'outbound') {
      lastOutboundIndex = i;
      break;
    }
  }

  // Pendientes = inbound después del último outbound
  const pending = [];

  for (let i = lastOutboundIndex + 1; i < messages.length; i++) {
    if (messages[i].direction === 'inbound') {
      pending.push(messages[i]);
    }
  }

  return pending;
}
```

### 4.4 Construcción del Snapshot

```javascript
function buildSnapshot(session, messages) {
  const pending = calculatePending(messages);

  // Encontrar timestamps relevantes
  const outboundMessages = messages.filter(m => m.direction === 'outbound');
  const lastOutbound = outboundMessages[outboundMessages.length - 1];

  return {
    success: true,
    version: session.version,
    session_id: session.session_id,
    phone: session.phone,
    contact_id: session.contact_id,
    business_id: extractBusinessId(session.callbell_conversation_href),
    state: session.state || {},
    mode: session.mode,
    tags: session.tags || [],
    messages: messages,
    pending: pending,
    pending_count: pending.length,
    last_outbound_at: lastOutbound?.created_at || null,
    last_processed_at: session.last_activity
  };
}
```

---

## 5. SISTEMA DE VERSIONES

### 5.1 Propósito del Versionamiento

La versión se usa para **detección de interrupciones** en Carolina V3:

```javascript
// Carolina obtiene snapshot inicial
const snapshot1 = await getSnapshot(phone); // version: 5

// Carolina envía mensaje 1
await sendMessage(phone, mensaje1);

// MIENTRAS TANTO: Cliente envía mensaje nuevo
// Historial incrementa version → 6

// Carolina pre-check antes de mensaje 2
const snapshot2 = await getSnapshot(phone); // version: 6

// Detectar interrupción
if (snapshot2.version !== snapshot1.version) {
  // Cliente envió mensaje → INTERRUMPIR
  return { interrupted: true };
}
```

### 5.2 Incremento de Versión

La versión se incrementa en Historial V3 cada vez que:
- Se inserta un nuevo mensaje inbound
- Se actualiza el state de la sesión
- Se modifica el mode de la conversación

```sql
-- En Historial V3 al procesar mensaje
UPDATE sessions_v3
SET
  version = version + 1,
  updated_at = NOW()
WHERE session_id = $1;
```

---

## 6. CASOS DE USO

### 6.1 Carolina V3 - Estado Inicial

```javascript
// Obtener estado antes de responder
async function getConversationState(phone) {
  const response = await fetch(
    `/webhook/historial-v3-snapshot?phone=${phone}`
  );
  const snapshot = await response.json();

  if (!snapshot.success) {
    throw new Error('Session not found');
  }

  return {
    intent: snapshot.state._last_intent,
    hasPending: snapshot.pending_count > 0,
    version: snapshot.version,
    tags: snapshot.tags
  };
}
```

### 6.2 Carolina V3 - Detección de Interrupciones

```javascript
// Pre-check antes de cada mensaje
async function shouldContinueSending(phone, initialVersion) {
  const snapshot = await fetch(
    `/webhook/historial-v3-snapshot?phone=${phone}`
  ).then(r => r.json());

  return snapshot.version === initialVersion;
}
```

### 6.3 Proactive Timer - Monitoreo de Estado

```javascript
// Verificar estado en cada iteración del timer
async function checkSessionState(phone) {
  const snapshot = await fetch(
    `/webhook/historial-v3-snapshot?phone=${phone}`
  ).then(r => r.json());

  return {
    hasData: Object.keys(snapshot.state).length > 0,
    mode: snapshot.mode,
    orderCreated: snapshot.state.order_created || false,
    lastActivity: snapshot.last_processed_at
  };
}
```

### 6.4 Debugging y Monitoreo

```javascript
// Herramienta de debugging
async function debugSession(phone) {
  const snapshot = await fetch(
    `/webhook/historial-v3-snapshot?phone=${phone}`
  ).then(r => r.json());

  console.log('=== SESSION DEBUG ===');
  console.log('Session ID:', snapshot.session_id);
  console.log('Version:', snapshot.version);
  console.log('Mode:', snapshot.mode);
  console.log('Tags:', snapshot.tags);
  console.log('State:', JSON.stringify(snapshot.state, null, 2));
  console.log('Messages:', snapshot.messages.length);
  console.log('Pending:', snapshot.pending_count);
}
```

---

## 7. CARACTERÍSTICAS DE RENDIMIENTO

### 7.1 Optimizaciones

| Aspecto | Implementación |
|---------|----------------|
| Límite de mensajes | Máximo 100 mensajes retornados |
| Índices DB | `phone` y `session_id` indexados |
| Single query | Sesión y mensajes en queries separadas pero simples |
| No joins complejos | Queries directas a tablas individuales |

### 7.2 Tiempos Esperados

| Operación | Tiempo esperado |
|-----------|-----------------|
| Query sesión | < 10ms |
| Query mensajes | < 20ms |
| Total endpoint | < 50ms |

---

## 8. MANEJO DE ERRORES

### 8.1 Errores Esperados

| Error | Causa | Respuesta |
|-------|-------|-----------|
| `missing_phone` | Parámetro phone faltante | 400 Bad Request |
| `session_not_found` | Teléfono sin sesión activa | Snapshot vacío |
| `database_error` | PostgreSQL no disponible | 500 Internal Error |

### 8.2 Validación de Phone

```javascript
function validatePhone(phone) {
  if (!phone) {
    throw new Error('missing_phone');
  }

  // Limpiar y validar formato
  const clean = phone.replace(/\D/g, '');

  if (clean.length !== 12 || !clean.startsWith('57')) {
    throw new Error('invalid_phone_format');
  }

  return clean;
}
```

---

## 9. MÉTRICAS Y LOGGING

### 9.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `snapshot_requested` | phone, caller_agent |
| `snapshot_found` | phone, version, pending_count |
| `snapshot_not_found` | phone |
| `snapshot_error` | phone, error_type |

---

## 10. CONSIDERACIONES PARA MORFX

### 10.1 API de Snapshot Extensible

```typescript
interface SnapshotService {
  getSnapshot(sessionId: string): Promise<Snapshot>;
  getSnapshotByPhone(phone: string): Promise<Snapshot>;
  subscribeToChanges(sessionId: string, callback: ChangeCallback): Unsubscribe;
}

interface Snapshot {
  success: boolean;
  version: number;
  session: SessionData;
  messages: Message[];
  pending: Message[];
  metadata: SnapshotMetadata;
}

interface SnapshotMetadata {
  queriedAt: Date;
  queryLatencyMs: number;
  cacheHit: boolean;
}
```

### 10.2 Real-time Updates (WebSocket)

```typescript
interface RealtimeSnapshot {
  subscribe(sessionId: string): Observable<SnapshotUpdate>;
  unsubscribe(sessionId: string): void;
}

interface SnapshotUpdate {
  type: 'message_added' | 'state_updated' | 'version_changed';
  previousVersion: number;
  currentVersion: number;
  delta: Partial<Snapshot>;
}

// Uso en Carolina
const updates$ = realtimeSnapshot.subscribe(sessionId);

updates$.subscribe(update => {
  if (update.type === 'message_added' && update.delta.pending?.length > 0) {
    // Cliente envió mensaje, interrumpir
    cancelCurrentResponse();
  }
});
```

### 10.3 Caché Distribuido

```typescript
interface SnapshotCache {
  get(key: string): Promise<Snapshot | null>;
  set(key: string, snapshot: Snapshot, ttl: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidateByPhone(phone: string): Promise<void>;
}

// Implementación con Redis
class RedisSnapshotCache implements SnapshotCache {
  async get(key: string): Promise<Snapshot | null> {
    const cached = await redis.get(`snapshot:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, snapshot: Snapshot, ttl: number): Promise<void> {
    await redis.setex(`snapshot:${key}`, ttl, JSON.stringify(snapshot));
  }
}
```

### 10.4 Proyecciones de Snapshot

```typescript
// Proyecciones ligeras para casos específicos
interface SnapshotProjection {
  minimal: (s: Snapshot) => MinimalSnapshot;
  forCarolina: (s: Snapshot) => CarolinaSnapshot;
  forTimer: (s: Snapshot) => TimerSnapshot;
  forDashboard: (s: Snapshot) => DashboardSnapshot;
}

interface MinimalSnapshot {
  version: number;
  pending_count: number;
  mode: string;
}

interface CarolinaSnapshot {
  version: number;
  pending_count: number;
  tags: string[];
  last_intent: string;
  state: Record<string, any>;
}
```
