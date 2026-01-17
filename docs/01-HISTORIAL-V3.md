# Historial v3 - Documentación Técnica

## 📋 Resumen
**Workflow:** Agente Historial v3
**Función Principal:** Receptor y procesador central de mensajes de Callbell
**Tipo:** Webhook receptor + Orquestador
**Endpoints:** `/webhook/historial-v3-callbell-webhook`

## 🎯 Propósito

El Historial v3 es el **corazón del sistema**. Recibe todos los mensajes entrantes desde Callbell (WhatsApp), los procesa, mantiene el estado de las conversaciones en PostgreSQL, y orquesta la llamada a los demás agentes del sistema (State Analyzer, Data Extractor, Order Manager, Carolina v3).

## 🔄 Flujo de Procesamiento

### 1. Recepción del Mensaje (Webhook)
```
Callbell → Webhook Callbell → Respond Immediately
```
- **Nodo:** `Webhook Callbell`
- **Trigger:** POST desde Callbell cuando hay un mensaje nuevo
- **Respuesta:** Inmediata (200 OK) para no bloquear a Callbell

### 2. Parse y Validación
```
Respond → Parse Payload → Check Blocked Tags
```

**Parse Payload:**
- Extrae datos del webhook de Callbell
- Soporta dos formatos:
  - Formato test: `{uuid, from, to, text...}`
  - Formato Callbell real: `{event: "message_created", payload: {...}}`
- Normaliza teléfonos (agrega prefijo 57 si falta)
- Extrae: `callbell_message_id`, `phone`, `contact_id`, `conversation_href`, `tags`, `direction`

**Check Blocked Tags and Duplicates:**
- Verifica tags bloqueados: `['WPP', 'P/W', 'RECO', 'bot_off']`
- Verifica si el mensaje es antiguo (> 2 minutos)
- Si está bloqueado → va a `Log Blocked Message` y termina
- Si pasa → continúa el flujo

### 3. Gestión de Sesiones
```
Find Session → Check Session Exists
  ├─ TRUE → Merge Existing Session
  └─ FALSE → Create New Session ID
```

**Find Session:**
```sql
SELECT session_id, state, contact_id, tags, mode
FROM sessions_v3
WHERE phone = '{{phone}}'
LIMIT 1
```

**Merge Existing Session:**
- Prioriza tags nuevos de Callbell
- Mantiene session_id existente
- Preserva state anterior

**Create New Session ID:**
- Genera: `session_${phone}_${timestamp}`
- Inicia con `state: {}`, `mode: 'conversacion'`
- Guarda `contact_id`, `conversation_href`, `tags`

**Insert/Update Session:**
```sql
INSERT INTO sessions_v3 (
  session_id, phone, contact_id,
  callbell_conversation_href, state, tags,
  mode, status, created_at, last_activity
) VALUES (...)
```

### 4. Guardar Mensaje
```
Preserve Message Data → Insert Message
```

**Insert Message:**
```sql
INSERT INTO messages_v3 (
  session_id, role, content, direction,
  callbell_message_id, business_id,
  payload_raw, created_at
) VALUES (...)
ON CONFLICT (callbell_message_id) DO NOTHING
```

**Campos clave:**
- `role`: "user" (inbound) | "assistant" (outbound)
- `direction`: "inbound" | "outbound"
- `callbell_message_id`: ID único del mensaje en Callbell (evita duplicados)

### 5. Filtro de Dirección
```
Check Direction (Inbound?)
  ├─ INBOUND → Continúa procesamiento
  └─ OUTBOUND → Log Outbound Skip (termina)
```

**Razón:** Solo procesamos mensajes entrantes del usuario. Los mensajes salientes (del bot) no necesitan análisis.

### 6. Análisis de Intención (State Analyzer)
```
Get Messages for Snapshot → Format Snapshot → Call State Analyzer
```

**Get Messages for Snapshot:**
```sql
SELECT m.id, m.role, m.content, m.direction, m.created_at,
       s.session_id, s.phone, s.state as captured_data
FROM messages_v3 m
JOIN sessions_v3 s ON m.session_id = s.session_id
WHERE s.phone = '{{phone}}'
ORDER BY m.created_at ASC
```

**Format Snapshot for State Analyzer:**
- Calcula mensajes pendientes: mensajes inbound después del último outbound
- Extrae `_intents_vistos` del state
- Construye el objeto:
```json
{
  "phone": "57...",
  "messages": [...],
  "pending": [...],
  "state": {...},
  "intents_vistos": [...]
}
```

**Call State Analyzer:**
- POST a `https://n8n.automatizacionesmorf.com/webhook/state-analyzer`
- Recibe: intent detectado, new_mode, captured_data actualizado

### 7. Extracción de Datos (Si aplica)
```
Update Session with State Analyzer Results → Check Mode (collecting_data?)
  ├─ TRUE → Call Data Extractor
  └─ FALSE → Salta Data Extractor
```

**Call Data Extractor Simple:**
- Solo se llama si `mode === 'collecting_data'`
- POST a `https://n8n.automatizacionesmorf.com/webhook/data-extractor`
- Extrae: nombre, apellido, teléfono, dirección, ciudad, departamento, barrio, correo
- Usa Claude API para extracción inteligente con LLM

### 8. Merge de Datos
```
Merge Data → Check if All Fields Complete → Update State in PostgreSQL
```

**Merge Data:**
- Combina datos de State Analyzer + Data Extractor
- Verifica campos mínimos completos: `['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento']`
- Establece flags: `campos_minimos_completos`, `order_created`

**Check if All Fields Complete:**
- Verifica 8 campos completos (incluyendo barrio, correo)
- Lógica de cambio de modo:
  - **Todos 8 campos** → `mode: 'conversacion'`
  - **Campos mínimos sin pack** → `intent: 'ofrecer_promos'`, mantiene `mode: 'collecting_data'`
- Actualiza `_last_intent` dentro de captured_data

**Update State in PostgreSQL:**
```sql
UPDATE sessions_v3
SET state = '{{captured_data}}'::jsonb,
    mode = '{{final_mode}}',
    last_activity = NOW()
WHERE phone = '{{phone}}'
```

### 9. Creación de Orden (Condicional)
```
Should Create Order?
  ├─ TRUE (pack + campos + !order_created) → Trigger Carolina v → Call Order Manager → Update Order Created Flag
  └─ FALSE → Trigger Carolina v3 (normal)
```

**Should Create Order?**
Condiciones:
1. `pack_detectado` no vacío (1x, 2x, 3x)
2. `campos_minimos_completos === true`
3. `order_created === false`

**Call Order Manager:**
- POST a `http://localhost:5678/webhook/order-manager`
- Body:
```json
{
  "phone": "57...",
  "captured_data": {...},
  "callbell_conversation_href": "https://...",
  "source": "historial_v3"
}
```

**Arreglar Callbell + HTTP: Add RB Tag:**
- Actualiza contacto en Callbell con tags `["WPP", "RB"]`
- Agrega el `bigin orden` URL en custom_fields
- PATCH a `https://api.callbell.eu/v1/contacts/{{contact_id}}`

### 10. Trigger de Respuesta (Carolina v3)
```
Trigger Carolina v3
```
- POST a `https://n8n.automatizacionesmorf.com/webhook/carolina-v3-process`
- Carolina v3 se encarga de generar y enviar las respuestas al usuario

## 📊 Base de Datos

### Tabla: sessions_v3
```sql
CREATE TABLE sessions_v3 (
  session_id VARCHAR PRIMARY KEY,
  phone VARCHAR NOT NULL,
  contact_id VARCHAR,
  callbell_conversation_href TEXT,
  business_id VARCHAR DEFAULT 'somnio',
  state JSONB DEFAULT '{}',
  mode VARCHAR DEFAULT 'conversacion',
  tags TEXT[],
  status VARCHAR DEFAULT 'active',
  version INTEGER DEFAULT 0,
  last_processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);
```

**Campos clave:**
- `state`: Datos capturados (nombre, apellido, pack, etc.)
- `mode`: 'conversacion' | 'collecting_data'
- `tags`: Tags de Callbell (WPP, P/W, RECO, bot_off)
- `version`: Contador para detectar interrupciones en cadenas de mensajes

### Tabla: messages_v3
```sql
CREATE TABLE messages_v3 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR REFERENCES sessions_v3(session_id),
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  direction VARCHAR NOT NULL,
  callbell_message_id VARCHAR UNIQUE,
  business_id VARCHAR DEFAULT 'somnio',
  intent VARCHAR,
  payload_raw JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Campos clave:**
- `callbell_message_id`: UNIQUE constraint para evitar duplicados
- `role`: "user" | "assistant"
- `direction`: "inbound" | "outbound"

## 🚫 Filtros y Validaciones

### 1. Tags Bloqueados
```javascript
const blockedTags = ['WPP', 'P/W', 'RECO', 'bot_off'];
```
- **WPP:** Cliente ya en proceso de compra/pedido registrado
- **P/W:** Cliente en proceso web
- **RECO:** Cliente en recorrido/remarketing
- **bot_off:** Bot deshabilitado manualmente

### 2. Mensajes Antiguos
```javascript
const ageInSeconds = (now - messageTimestamp) / 1000;
const isOldMessage = ageInSeconds > 120; // 2 minutos
```
Evita procesar mensajes históricos cuando se reconecta el webhook.

### 3. Mensajes Duplicados
```sql
ON CONFLICT (callbell_message_id) DO NOTHING
```
Usa el UUID de Callbell para detectar y descartar duplicados.

## 🔗 Integraciones

### Callbell API
- **Webhook recibido:** `POST /webhook/historial-v3-callbell-webhook`
- **API Key:** Bearer token en headers
- **Endpoints llamados:**
  - PATCH `/v1/contacts/{{contact_id}}` - Actualizar tags y custom fields

### Agentes Internos
1. **State Analyzer:** Detecta intent del usuario
2. **Data Extractor:** Extrae datos personales con Claude
3. **Order Manager:** Crea pedidos en Bigin CRM
4. **Carolina v3:** Genera y envía respuestas

## 📈 Métricas y Logs

### Console Logs Principales:
- `📥 WEBHOOK RECEIVED` - Mensaje recibido
- `🏷️ CHECKING TAGS` - Verificación de tags
- `⏰ CHECKING MESSAGE AGE` - Edad del mensaje
- `🚫 MESSAGE BLOCKED` - Mensaje bloqueado
- `✅ Session exists` - Sesión encontrada
- `🆕 Creating new session` - Nueva sesión
- `📸 Snapshot built` - Snapshot construido
- `🔄 MERGING DATA` - Combinando datos
- `📦 ORDER CREATED` - Orden creada

## ⚙️ Configuración

### Variables de Entorno
```bash
POSTGRES_HOST=...
POSTGRES_DB=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
```

### Credenciales n8n
- **Postgres:** `Postgres Historial v3`
- **Callbell API:** Header Auth con Bearer token

## 🛠️ Mantenimiento

### Nodo Temporal: "eliminar temporal"
```sql
DELETE FROM messages_v3
WHERE session_id IN (
  SELECT session_id FROM sessions_v3
  WHERE phone = '573137549286'
);

DELETE FROM sessions_v3
WHERE phone = '573137549286';
```
**Uso:** Limpiar sesiones de testing. **Eliminar en producción.**

## 🎯 Casos de Uso

### 1. Nuevo Cliente (Primera vez)
```
Mensaje → Parse → Sin sesión → Create Session → Guardar → State Analyzer → Carolina responde
```

### 2. Cliente Existente (Conversación continua)
```
Mensaje → Parse → Sesión existe → Merge → Guardar → State Analyzer → Carolina responde
```

### 3. Cliente Completa Datos + Elige Pack
```
Mensaje → Parse → Data Extractor → Campos completos + Pack detectado → Create Order → Carolina confirma
```

### 4. Cliente con Tag WPP (Ya procesado)
```
Mensaje → Parse → Tag WPP detectado → BLOQUEADO (no procesa)
```

## 🚨 Errores Comunes

### Error: "Session not found"
**Causa:** Phone no existe en sessions_v3
**Solución:** Se crea automáticamente

### Error: "Duplicate callbell_message_id"
**Causa:** Mensaje ya procesado
**Solución:** Ignora con ON CONFLICT DO NOTHING

### Error: "Timeout en State Analyzer"
**Causa:** Claude API lenta
**Solución:** Timeout configurado a 30 segundos

## 📝 Notas Importantes

1. **Respuesta inmediata:** Siempre responde 200 OK a Callbell para no perder mensajes
2. **Procesamiento asíncrono:** Todo el flujo es asíncrono después de la respuesta
3. **Idempotencia:** Usa callbell_message_id para evitar duplicados
4. **State persistence:** El state se guarda en cada paso para no perder datos
5. **Mode transitions:** collecting_data ↔ conversacion se maneja automáticamente

## 🔄 Dependencias

**Workflows que dependen de Historial v3:**
- Carolina v3 (triggereado al final)
- State Analyzer (llamado para análisis)
- Data Extractor (llamado si collecting_data)
- Order Manager (llamado si crear orden)
- Snapshot (lee de sessions_v3 y messages_v3)

**Historial v3 depende de:**
- Callbell Webhook (trigger)
- PostgreSQL (persistencia)
- APIs externas (Claude via State Analyzer/Data Extractor)
