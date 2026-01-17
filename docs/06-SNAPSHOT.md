# Snapshot Historial v3 Endpoint - Documentación Técnica

## 📋 Resumen
**Workflow:** Snapshot Historial v3 Endpoint DSL
**Función Principal:** API endpoint para obtener estado actual de conversación
**Tipo:** Read-only API
**Endpoints:** `/webhook/historial-v3-snapshot?phone=57...`

## 🎯 Propósito

El Snapshot es un endpoint de **solo lectura** que retorna el estado completo y actualizado de una conversación: sesión, mensajes, mensajes pendientes, tags, mode, etc. Es usado por Carolina v3 y para debug.

## 🔄 Flujo de Procesamiento

### 1. Recepción de Request
```
Webhook: Snapshot → Parse Phone
```

**Request:**
```
GET /webhook/historial-v3-snapshot?phone=573137549286
```

**Parse Phone:**
```javascript
const phone = $json.query.phone || '';
if (!phone) throw new Error('Phone parameter required');
return { phone };
```

### 2. Obtener Sesión
```
Parse Phone → Get Session
```

**SQL Query:**
```sql
SELECT
  session_id,
  phone,
  contact_id,
  business_id,
  status,
  state as captured_data,
  mode,
  tags,
  version,
  last_processed_at,
  created_at,
  last_activity
FROM sessions_v3
WHERE phone = '{{phone}}'
  AND status = 'active'
ORDER BY last_activity DESC
LIMIT 1
```

**Output:**
```json
{
  "session_id": "session_57..._1234567890",
  "phone": "573137549286",
  "contact_id": "abc123",
  "business_id": "somnio",
  "status": "active",
  "captured_data": {
    "nombre": "Juan",
    "pack": "2x",
    "_last_intent": "resumen_2x",
    "_intents_vistos": ["hola", "precio", "ofrecer_promos", "resumen_2x"]
  },
  "mode": "collecting_data",
  "tags": ["bot_on"],
  "version": 42,
  "last_processed_at": "2026-01-17T00:20:00Z",
  "created_at": "2026-01-17T00:10:00Z",
  "last_activity": "2026-01-17T00:25:00Z"
}
```

### 3. Session Exists?
```
Get Session → Session Exists?
  ├─ TRUE → Get Messages
  └─ FALSE → No Session Found
```

### 4. Obtener Mensajes
```
Get Messages
```

**SQL Query:**
```sql
SELECT
  id,
  session_id,
  role,
  content,
  direction,
  intent,
  callbell_message_id,
  created_at
FROM messages_v3
WHERE session_id = '{{session_id}}'
ORDER BY created_at ASC
LIMIT 100
```

**Output:**
```json
[
  {
    "id": 1,
    "session_id": "session_...",
    "role": "user",
    "content": "hola",
    "direction": "inbound",
    "intent": null,
    "callbell_message_id": "uuid1",
    "created_at": "2026-01-17T00:10:00Z"
  },
  {
    "id": 2,
    "role": "assistant",
    "content": "¡Hola! Bienvenido...",
    "direction": "outbound",
    "intent": null,
    "callbell_message_id": "uuid2",
    "created_at": "2026-01-17T00:10:05Z"
  }
]
```

### 5. Compute Snapshot
```
Get Messages → Compute Snapshot
```

**Cálculo de pending:**
```javascript
// Mensajes inbound después del último outbound
let lastOutboundIdx = -1;
for (let i = messages.length - 1; i >= 0; i--) {
  if (messages[i].direction === 'outbound') {
    lastOutboundIdx = i;
    break;
  }
}

const pending = [];
for (let i = lastOutboundIdx + 1; i < messages.length; i++) {
  if (messages[i].direction === 'inbound') {
    pending.push(messages[i]);
  }
}
```

**Ejemplo:**
```
Mensajes:
1. [inbound] "hola"
2. [outbound] "¡Hola!"
3. [inbound] "cuánto cuesta?"
4. [inbound] "tienes envío?"

lastOutboundIdx = 1
pending = [mensaje 3, mensaje 4]
```

**Output:**
```javascript
return {
  success: true,
  version: sessionData.version,
  session_id: sessionData.session_id,
  phone: sessionData.phone,
  contact_id: sessionData.contact_id || '',
  business_id: sessionData.business_id,
  state: sessionData.captured_data || {},
  mode: sessionData.mode || 'conversacion',
  tags: sessionData.tags || [],
  messages,
  pending,
  pending_count: pending.length,
  last_outbound_at: lastOutboundAt,
  last_processed_at: sessionData.last_processed_at
};
```

### 6. Respond with Snapshot
```
Compute Snapshot → Respond with Snapshot
```

**Response:**
```json
{
  "success": true,
  "version": 42,
  "session_id": "session_...",
  "phone": "573137549286",
  "contact_id": "abc123",
  "business_id": "somnio",
  "state": {
    "nombre": "Juan",
    "pack": "2x",
    "_last_intent": "resumen_2x",
    "_intents_vistos": ["hola", "precio", "ofrecer_promos", "resumen_2x"]
  },
  "mode": "collecting_data",
  "tags": ["bot_on"],
  "messages": [
    {"id": 1, "role": "user", "content": "hola", "direction": "inbound", "created_at": "..."},
    {"id": 2, "role": "assistant", "content": "¡Hola!", "direction": "outbound", "created_at": "..."}
  ],
  "pending": [
    {"id": 3, "role": "user", "content": "cuánto cuesta?", "direction": "inbound", "created_at": "..."}
  ],
  "pending_count": 1,
  "last_outbound_at": "2026-01-17T00:10:05Z",
  "last_processed_at": "2026-01-17T00:20:00Z"
}
```

### 7. No Session Found
```
No Session Found → Respond Empty
```

**Response:**
```json
{
  "success": false,
  "error": "Session not found",
  "phone": "573137549286",
  "messages": [],
  "pending": [],
  "pending_count": 0,
  "state": {},
  "mode": "conversacion",
  "tags": []
}
```

## 🎯 Casos de Uso

### Caso 1: Carolina obtiene snapshot
```
Request: GET /snapshot?phone=573137549286
Response: {success: true, pending_count: 2, ...}
Carolina: "Tengo 2 mensajes pendientes, voy a procesar"
```

### Caso 2: Prevención de interrupciones
```
Carolina (inicio): GET /snapshot → version: 42
Carolina (loop, antes de cada mensaje): GET /snapshot → version: 42 (no cambió)
Carolina: "OK, puedo enviar mensaje"

Cliente escribe nuevo mensaje:
Carolina (loop, siguiente mensaje): GET /snapshot → version: 43 (cambió!)
Carolina: "⚠️ INTERRUMPIDO, abortar envío"
```

### Caso 3: Debug de conversación
```
Developer: GET /snapshot?phone=573137549286
Response: {messages: [...], pending: [...], state: {...}}
Developer: "Veo que el cliente tiene pending_count=0, ya respondimos todo"
```

### Caso 4: Sesión no existe
```
Request: GET /snapshot?phone=57999999999
Response: {success: false, error: "Session not found"}
```

## 📊 Estructura de Datos

### Snapshot Completo
```typescript
{
  success: boolean,
  version: number,
  session_id: string,
  phone: string,
  contact_id: string,
  business_id: string,
  state: {
    nombre?: string,
    apellido?: string,
    telefono?: string,
    direccion?: string,
    ciudad?: string,
    departamento?: string,
    barrio?: string,
    correo?: string,
    pack?: '1x' | '2x' | '3x',
    precio?: number,
    order_created?: boolean,
    _last_intent?: string,
    _intents_vistos?: string[]
  },
  mode: 'conversacion' | 'collecting_data',
  tags: string[],
  messages: Message[],
  pending: Message[],
  pending_count: number,
  last_outbound_at: string | null,
  last_processed_at: string | null
}
```

### Message
```typescript
{
  id: number,
  role: 'user' | 'assistant',
  content: string,
  direction: 'inbound' | 'outbound',
  intent: string | null,
  created_at: string
}
```

## ⚙️ Configuración

### Credenciales n8n
- **Postgres:** `Postgres Historial v3`

## 📈 Métricas y Logs

### Console Logs
- `📸 Snapshot requested for phone: 57...` - Request recibido
- `⚠️ Session not found for phone: 57...` - Sesión no encontrada
- `📸 Snapshot computed: {...}` - Snapshot construido

## 🚨 Errores Comunes

### Error: "Phone parameter required"
**Causa:** No se pasó query param `?phone=...`
**Solución:** Agregar phone en query string

### Error: "Session not found"
**Causa:** No existe sesión activa para ese phone
**Solución:** Normal, retorna empty snapshot

## 🔗 Dependencias

**Snapshot depende de:**
- PostgreSQL (sessions_v3, messages_v3)

**Workflows que dependen de Snapshot:**
- Carolina v3 (obtiene estado inicial y pre-check)
- State Analyzer (indirectamente vía Historial)
- Debug/Testing (developers)

## 📝 Notas Importantes

1. **Read-only:** No modifica nada, solo lee
2. **pending_count crítico:** Carolina decide si procesar
3. **version tracking:** Detecta cambios en la sesión
4. **Limit 100 mensajes:** Historial completo hasta 100 msgs
5. **pending calculation:** Solo mensajes inbound después del último outbound
6. **tags exposure:** Tags de Callbell disponibles
7. **fast query:** Optimizado para respuesta rápida
