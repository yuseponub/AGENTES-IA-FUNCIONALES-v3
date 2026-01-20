# 🏗️ Arquitectura General - Sistema v3DSL

## 📋 Índice

1. [Visión General](#visión-general)
2. [Componentes del Sistema](#componentes-del-sistema)
3. [Flujo de Datos Completo](#flujo-de-datos-completo)
4. [Base de Datos](#base-de-datos)
5. [Integraciones Externas](#integraciones-externas)
6. [Diagramas de Arquitectura](#diagramas-de-arquitectura)
7. [Gestión de Estado](#gestión-de-estado)
8. [Sistema de Intents](#sistema-de-intents)

---

## 1. Visión General

### 🎯 Propósito del Sistema

Sistema de bot conversacional inteligente para **Somnio** (Elixir del Sueño) que automatiza la atención al cliente, captura de datos, y creación de pedidos en WhatsApp.

### 🛠️ Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                    STACK TECNOLÓGICO                        │
├─────────────────────────────────────────────────────────────┤
│  • n8n              → Orquestación de workflows             │
│  • PostgreSQL       → Base de datos principal               │
│  • Claude AI        → LLM para detección de intents        │
│  • Callbell API     → Gestión de WhatsApp                   │
│  • Bigin CRM        → Sistema de pedidos (Zoho)             │
│  • Playwright       → Automatización del CRM                │
└─────────────────────────────────────────────────────────────┘
```

### 📊 Métricas Clave

- **Tiempo de respuesta:** < 3 segundos (promedio)
- **Tasa de conversión:** ~70% (de hola → compra confirmada)
- **Capacidad:** Múltiples conversaciones simultáneas
- **Disponibilidad:** 24/7 con recuperación automática

---

## 2. Componentes del Sistema

### 2.1 Workflows Principales

```
┌────────────────────────────────────────────────────────────┐
│                   WORKFLOWS PRINCIPALES                    │
└────────────────────────────────────────────────────────────┘

1. HISTORIAL V3 (Orquestador)
   ├─ Receptor de mensajes de Callbell
   ├─ Gestor de sesiones en PostgreSQL
   ├─ Orquestador de flujo completo
   └─ Trigger de workflows secundarios

2. CAROLINA V3 (Generador de Respuestas)
   ├─ Selector de plantillas según intent
   ├─ Enviador de mensajes con delays
   ├─ Prevención de interrupciones
   └─ Gestión de tags de Callbell
```

### 2.2 Workflows Auxiliares

```
┌────────────────────────────────────────────────────────────┐
│                  WORKFLOWS AUXILIARES                      │
└────────────────────────────────────────────────────────────┘

3. STATE ANALYZER
   ├─ Detecta intenciones con Claude AI
   ├─ Valida flujo transaccional
   └─ Actualiza intents_vistos

4. DATA EXTRACTOR
   ├─ Extrae datos personales con Claude AI
   ├─ Limpia y normaliza datos
   └─ Detecta negaciones

5. ORDER MANAGER
   ├─ Valida datos mínimos
   ├─ Crea pedidos en Bigin CRM
   └─ Marca order_created

6. SNAPSHOT
   ├─ API de solo lectura
   ├─ Retorna estado actual
   └─ Calcula pending messages

7. PROACTIVE TIMERS (⚠️ NO ACTIVAR aún)
   ├─ Recordatorios automáticos
   ├─ Órdenes automáticas
   └─ Gestión de timers
```

---

## 3. Flujo de Datos Completo

### 3.1 Vista de Alto Nivel

```
┌───────────────────────────────────────────────────────────────┐
│                    FLUJO DE DATOS COMPLETO                     │
└───────────────────────────────────────────────────────────────┘

ENTRADA (Cliente envía mensaje)
   │
   ▼
┌──────────────────────────────────┐
│  1. Callbell Webhook             │
│     POST /historial-v3-webhook   │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  2. HISTORIAL V3 (Orquestador)                               │
├──────────────────────────────────────────────────────────────┤
│  ✓ Filtros Iniciales:                                        │
│    ├─ Direction = "inbound" (solo mensajes entrantes)       │
│    ├─ Tags bloqueados (WPP, P/W, RECO, bot_off)             │
│    └─ Timestamp (< 2 min, evita duplicados)                 │
│                                                              │
│  ✓ Gestión de Sesión:                                       │
│    ├─ Buscar sesión existente por phone                     │
│    ├─ Crear nueva sesión si no existe                       │
│    └─ Actualizar last_activity                              │
│                                                              │
│  ✓ Guardar Mensaje:                                         │
│    ├─ INSERT en messages_v3                                 │
│    ├─ Validar callbell_message_id UNIQUE                    │
│    └─ Incrementar version counter                           │
└──────────┬───────────────────────────────────────────────────┘
           │
           ├──────────────────────────────────────────────────┐
           │                                                  │
           ▼                                                  ▼
┌────────────────────────┐                    ┌────────────────────────┐
│  3A. STATE ANALYZER    │                    │  3B. DATA EXTRACTOR    │
│  (Siempre se ejecuta)  │                    │  (Solo si collecting)  │
├────────────────────────┤                    ├────────────────────────┤
│  INPUT:                │                    │  INPUT:                │
│  • Historial completo  │                    │  • Mensaje actual      │
│  • Pending messages    │                    │  • State existente     │
│  • Intents vistos      │                    │                        │
│  • Captured data       │                    │  PROCESS:              │
│                        │                    │  • Claude extrae 8     │
│  PROCESS:              │                    │    campos              │
│  • Claude detecta      │                    │  • Limpia datos        │
│    intent actual       │                    │  • Normaliza formato   │
│  • Valida flujo        │                    │  • Detecta negaciones  │
│  • Auto-detecta        │                    │                        │
│    transaccionales     │                    │  OUTPUT:               │
│                        │                    │  • Datos extraídos     │
│  OUTPUT:               │                    │    y limpios           │
│  • Intent detectado    │                    └────────────┬───────────┘
│  • Intents vistos      │                                 │
│    actualizados        │                                 │
│  • Pack detectado      │                                 │
│  • Campos completos    │                                 │
└────────────┬───────────┘                                 │
             │                                             │
             └───────────────────┬─────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│  4. MERGE DATA                                               │
│     Combina: State Analyzer + Data Extractor                 │
│     → state = {                                              │
│         _last_intent,                                        │
│         _intents_vistos,                                     │
│         pack,                                                │
│         nombre, apellido, telefono, ...                      │
│       }                                                      │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  5. UPDATE STATE                                             │
│     UPDATE sessions_v3                                       │
│     SET state = $state,                                      │
│         mode = $mode,                                        │
│         version = version + 1                                │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  6. DECISION: ¿Crear Orden?                                  │
│     IF pack detectado + 6 campos mínimos + NOT order_created│
│        → Call Order Manager                                  │
└──────────┬───────────────────────────────────────────────────┘
           │ (solo si aplica)
           ▼
┌────────────────────────┐
│  7. ORDER MANAGER      │
│     (Opcional)         │
├────────────────────────┤
│  • Valida datos        │
│  • Llama Robot API     │
│  • Crea orden en Bigin │
│  • Marca order_created │
└────────────┬───────────┘
             │
             └─────────────────────────┐
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│  8. TRIGGER CAROLINA V3                                      │
│     POST /carolina-v3-process                                │
│     Body: { phone: "573..." }                                │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  9. CAROLINA V3 (Generador de Respuestas)                    │
├──────────────────────────────────────────────────────────────┤
│  ✓ Get Snapshot:                                             │
│    ├─ Obtiene sesión + mensajes                             │
│    ├─ Calcula pending_count                                 │
│    └─ Verifica version                                       │
│                                                              │
│  ✓ Validaciones:                                             │
│    ├─ pending_count > 0 (hay mensajes sin responder)        │
│    ├─ Tags NO bloqueados                                    │
│    └─ Intent válido en state                                │
│                                                              │
│  ✓ Selección de Templates:                                  │
│    ├─ Lee intent del state                                  │
│    ├─ Determina si primera_vez o siguientes                 │
│    ├─ Filtra templates ya enviados                          │
│    └─ Obtiene lista de templates a enviar                   │
│                                                              │
│  ✓ Loop de Envío (con prevención de interrupciones):        │
│    FOR EACH template:                                        │
│      1. Wait (delay configurable)                           │
│      2. Get Snapshot Fresh (version check)                  │
│      3. IF version changed → ABORT (cliente interrumpió)    │
│      4. Send to Callbell API                                │
│      5. Save outbound en messages_v3                        │
│      6. Increment version                                   │
│                                                              │
│  ✓ Post-Envío:                                              │
│    ├─ Si confirmación → Add tag WPP (desactiva bot)         │
│    └─ Log de finalización                                   │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────┐
│  10. Callbell API      │
│      Envía a cliente   │
└────────────────────────┘
```

### 3.2 Flujo Transaccional (Compra)

```
CLIENTE                  SISTEMA                    CRM
  │                        │                         │
  ├─ "Quiero comprar" ───→│                         │
  │                        ├─ Intent: captura_datos │
  │                        ├─ Mode: collecting_data │
  │                        │                         │
  │←─ "¿Cuál es tu nombre?"│                         │
  │                        │                         │
  ├─ "Juan Pérez..." ────→│                         │
  │                        ├─ Data Extractor ───────┤
  │                        │   (extrae 8 campos)    │
  │                        │                         │
  │                        ├─ IF 8 campos completos │
  │                        ├─ Intent: ofrecer_promos│
  │                        │                         │
  │←─ [Imagen 1x/2x/3x] ──│                         │
  │                        │                         │
  ├─ "El 2x" ────────────→│                         │
  │                        ├─ Pack: "2x" detectado  │
  │                        ├─ Intent: resumen_2x    │
  │                        │                         │
  │←─ "Confirma tu orden"─│                         │
  │   "Nombre: Juan..."    │                         │
  │   "Total: $XXX"        │                         │
  │                        │                         │
  ├─ "Sí confirmo" ──────→│                         │
  │                        ├─ Intent: compra_conf.. │
  │                        ├─ Call Order Manager ───┤
  │                        │                         ├─ Crea orden
  │                        │                         │   en Bigin
  │                        │                         │
  │←─ "Orden creada #123"─│←─ Order ID ─────────────┤
  │   + Tag WPP (bot OFF)  │                         │
  │                        │                         │
```

---

## 4. Base de Datos

### 4.1 Esquema PostgreSQL

#### Tabla: `sessions_v3`

```sql
CREATE TABLE sessions_v3 (
  session_id VARCHAR PRIMARY KEY,              -- phone
  phone VARCHAR NOT NULL,
  contact_id VARCHAR,                          -- Callbell contact UUID
  callbell_conversation_href TEXT,             -- Link a conversación
  business_id VARCHAR DEFAULT 'somnio',

  -- Estado de la conversación
  state JSONB DEFAULT '{}',                    -- Datos capturados + metadata
  mode VARCHAR DEFAULT 'conversacion',         -- 'conversacion' | 'collecting_data'
  tags TEXT[],                                 -- Tags de Callbell
  status VARCHAR DEFAULT 'active',             -- 'active' | 'inactive'

  -- Control de versión (prevención de race conditions)
  version INTEGER DEFAULT 0,

  -- Timestamps
  last_processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_phone ON sessions_v3(phone);
CREATE INDEX idx_sessions_status ON sessions_v3(status);
CREATE INDEX idx_sessions_last_activity ON sessions_v3(last_activity);
```

**Campos clave de `state` (JSONB):**

```json
{
  "_last_intent": "resumen_2x",
  "_intents_vistos": ["hola", "precio", "captura_datos_si_compra", "ofrecer_promos", "resumen_2x"],
  "_templates_enviados": ["/bienvenida", "/precio_estandar"],

  "nombre": "Juan",
  "apellido": "Pérez",
  "telefono": "573001234567",
  "direccion": "Cra 123 #45-67",
  "barrio": "Laureles",
  "ciudad": "Medellín",
  "departamento": "Antioquia",
  "correo": "juan@example.com",

  "pack": "2x",
  "order_created": false
}
```

#### Tabla: `messages_v3`

```sql
CREATE TABLE messages_v3 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR REFERENCES sessions_v3(session_id),

  -- Mensaje
  role VARCHAR NOT NULL,                       -- 'user' | 'assistant'
  content TEXT NOT NULL,
  direction VARCHAR NOT NULL,                  -- 'inbound' | 'outbound'

  -- Metadata
  callbell_message_id VARCHAR UNIQUE,          -- Para evitar duplicados
  business_id VARCHAR DEFAULT 'somnio',
  intent VARCHAR,                              -- Intent detectado

  -- Raw data
  payload_raw JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages_v3(session_id);
CREATE INDEX idx_messages_callbell_id ON messages_v3(callbell_message_id);
CREATE INDEX idx_messages_created ON messages_v3(created_at DESC);
CREATE UNIQUE INDEX idx_messages_callbell_unique ON messages_v3(callbell_message_id);
```

### 4.2 Queries Importantes

#### Obtener Snapshot de Conversación

```sql
-- Usado por: Carolina v3, Snapshot endpoint
SELECT
  s.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', m.id,
        'role', m.role,
        'content', m.content,
        'direction', m.direction,
        'created_at', m.created_at
      )
      ORDER BY m.created_at ASC
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'
  ) as messages
FROM sessions_v3 s
LEFT JOIN messages_v3 m ON s.session_id = m.session_id
WHERE s.phone = $1
GROUP BY s.session_id;
```

#### Calcular Pending Messages

```sql
-- Mensajes inbound después del último outbound
WITH last_outbound AS (
  SELECT MAX(created_at) as last_time
  FROM messages_v3
  WHERE session_id = $1
    AND direction = 'outbound'
)
SELECT COUNT(*)
FROM messages_v3 m, last_outbound lo
WHERE m.session_id = $1
  AND m.direction = 'inbound'
  AND (lo.last_time IS NULL OR m.created_at > lo.last_time);
```

#### Buscar Sesiones Inactivas (Proactive Timers)

```sql
-- Sesiones activas sin actividad reciente
SELECT *
FROM sessions_v3
WHERE status = 'active'
  AND last_activity < NOW() - INTERVAL '6 minutes'
  AND (state->>'_recordatorio_enviado')::boolean IS NOT TRUE;
```

---

## 5. Integraciones Externas

### 5.1 Callbell API

```
┌─────────────────────────────────────────────────────────┐
│                    CALLBELL API                         │
├─────────────────────────────────────────────────────────┤
│  Webhook (Inbound):                                     │
│    POST /webhook/historial-v3-callbell-webhook         │
│    Headers: Content-Type: application/json             │
│    Body: {                                              │
│      uuid: "msg-123",                                   │
│      from: "573001234567",                              │
│      text: "Hola",                                      │
│      direction: "inbound",                              │
│      createdAt: 1234567890000,                          │
│      contact: {                                         │
│        uuid: "contact-456",                             │
│        tags: ["WPP", "bot_off"]                         │
│      }                                                  │
│    }                                                    │
│                                                         │
│  Send Message (Outbound):                               │
│    POST https://api.callbell.eu/v1/messages/send       │
│    Headers:                                             │
│      Authorization: Bearer {token}                      │
│    Body: {                                              │
│      to: "573001234567",                                │
│      from: "whatsapp",                                  │
│      type: "text",                                      │
│      content: {                                         │
│        text: "Mensaje a enviar"                         │
│      }                                                  │
│    }                                                    │
│                                                         │
│  Tags Management:                                       │
│    POST /v1/contacts/{uuid}/tags                        │
│    Body: { tag: "WPP" }                                 │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Claude API (Anthropic)

```
┌─────────────────────────────────────────────────────────┐
│                     CLAUDE API                          │
├─────────────────────────────────────────────────────────┤
│  Modelo: claude-sonnet-4-5-20250929                     │
│  Uso: State Analyzer + Data Extractor                   │
│                                                         │
│  Request:                                               │
│    POST https://api.anthropic.com/v1/messages          │
│    Headers:                                             │
│      x-api-key: {api_key}                               │
│      anthropic-version: 2023-06-01                      │
│    Body: {                                              │
│      model: "claude-sonnet-4-5-20250929",               │
│      max_tokens: 1024,                                  │
│      messages: [                                        │
│        {                                                │
│          role: "user",                                  │
│          content: "Prompt + Historial"                  │
│        }                                                │
│      ]                                                  │
│    }                                                    │
│                                                         │
│  Response:                                              │
│    {                                                    │
│      content: [{                                        │
│        text: "Respuesta de Claude"                      │
│      }],                                                │
│      usage: {                                           │
│        input_tokens: 500,                               │
│        output_tokens: 100                               │
│      }                                                  │
│    }                                                    │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Bigin CRM (Robot API)

```
┌─────────────────────────────────────────────────────────┐
│                   BIGIN CRM (Robot)                     │
├─────────────────────────────────────────────────────────┤
│  Robot API (Playwright + TypeScript):                   │
│    POST http://robot-api:3000/api/bigin/create-order   │
│    Body: {                                              │
│      ordenName: "Orden #123",                           │
│      telefono: "573001234567",                          │
│      direccion: "Cra 123 #45-67",                       │
│      municipio: "Medellín",                             │
│      departamento: "Antioquia",                         │
│      email: "juan@example.com",                         │
│      description: "2x Elixir + Envío",                  │
│      amount: 200000,                                    │
│      closingDate: "20/01/2026",                         │
│      stage: "NUEVO INGRESO",                            │
│      callBell: "https://dash.callbell.eu/chat/..."     │
│    }                                                    │
│                                                         │
│  Response: {                                            │
│    success: true,                                       │
│    orderId: "6331846000012345678",                      │
│    orderUrl: "https://bigin.zoho.com/..."              │
│  }                                                      │
│                                                         │
│  Funcionalidades del Robot:                             │
│    • Timeout de sesión (30 min)                         │
│    • Verificación de ventanas cerradas                  │
│    • Relogin automático                                 │
│    • Retry con backoff exponencial                      │
│    • Notificaciones en caso de fallo                    │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Diagramas de Arquitectura

### 6.1 Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────┐
│                      SISTEMA v3DSL                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Callbell   │────────→│ Historial v3 │                    │
│  │   (WhatsApp) │         │ (Orquestador)│                    │
│  └──────────────┘         └──────┬───────┘                    │
│                                   │                            │
│                    ┌──────────────┼──────────────┐             │
│                    ▼              ▼              ▼             │
│           ┌───────────────┐  ┌─────────┐  ┌──────────┐        │
│           │ State Analyzer│  │   Data  │  │  Order   │        │
│           │  (Claude AI)  │  │Extractor│  │ Manager  │        │
│           └───────────────┘  └─────────┘  └────┬─────┘        │
│                    │              │             │              │
│                    └──────────────┼─────────────┘              │
│                                   │                            │
│                                   ▼                            │
│                          ┌─────────────────┐                   │
│                          │  PostgreSQL DB  │                   │
│                          │  • sessions_v3  │                   │
│                          │  • messages_v3  │                   │
│                          └─────────────────┘                   │
│                                   │                            │
│                                   ▼                            │
│                          ┌─────────────────┐                   │
│                          │   Carolina v3   │                   │
│                          │  (Respuestas)   │                   │
│                          └────────┬────────┘                   │
│                                   │                            │
│                                   ▼                            │
│                          ┌─────────────────┐                   │
│                          │  Callbell API   │                   │
│                          │  (Send Message) │                   │
│                          └─────────────────┘                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Servicios Externos:
┌────────────┐  ┌──────────┐  ┌────────────┐
│ Claude API │  │ Callbell │  │  Bigin CRM │
│ (Anthropic)│  │   API    │  │  (Robot)   │
└────────────┘  └──────────┘  └────────────┘
```

### 6.2 Diagrama de Flujo de Intents

Ver: [FLUJO-DE-INTENTS.md](./FLUJO-DE-INTENTS.md)

### 6.3 Diagrama de Base de Datos

Ver: [BASE-DE-DATOS.md](./BASE-DE-DATOS.md)

---

## 7. Gestión de Estado

### 7.1 Máquina de Estados (Mode)

```
┌────────────────────────────────────────────────────────┐
│                  MÁQUINA DE ESTADOS                    │
└────────────────────────────────────────────────────────┘

Estado Inicial: "conversacion"

conversacion
    │
    ├─ (intent: captura_datos_si_compra)
    │
    ▼
collecting_data
    │
    ├─ (8 campos completos)
    │
    ▼
conversacion
```

### 7.2 Lifecycle de Sesión

```
1. CREATED
   ├─ Nuevo mensaje de cliente desconocido
   ├─ INSERT en sessions_v3
   └─ state = {}, mode = 'conversacion'

2. ACTIVE
   ├─ Intercambio de mensajes
   ├─ State se va actualizando
   └─ version incrementa con cada cambio

3. COLLECTING_DATA
   ├─ Intent especial detectado
   ├─ Data Extractor se activa
   └─ Captura de 8 campos

4. READY_FOR_ORDER
   ├─ Pack detectado
   ├─ 6 campos mínimos completos
   └─ Order Manager se activa

5. ORDER_CREATED
   ├─ order_created = true en state
   ├─ Tag WPP agregado
   └─ Bot se desactiva

6. INACTIVE
   ├─ Sin actividad > 24 horas
   └─ status = 'inactive'
```

---

## 8. Sistema de Intents

### 8.1 Categorías de Intents

#### Informativos (sin restricciones)

```
hola
precio
info_promociones
contenido_envase
como_se_toma
modopago
envio
invima
ubicacion
contraindicaciones
fallback
```

#### Combinados

```
hola+precio
hola+como_se_toma
hola+envio
hola+modopago
hola+captura_datos_si_compra
```

#### Transaccionales (con validaciones)

```
captura_datos_si_compra   → Inicia capturing
ofrecer_promos            → Requiere 8 campos
resumen_1x/2x/3x          → Requiere ofrecer_promos visto
compra_confirmada         → Requiere resumen_Xx visto
no_confirmado             → Requiere resumen_Xx visto
```

### 8.2 Flujo de Validación de Intents

```python
def validar_intent(intent_detectado, intents_vistos, state):
    """
    Valida si el intent puede ejecutarse según el contexto
    """

    # Reglas de validación
    validaciones = {
        'ofrecer_promos': {
            'requiere': lambda: len(campos_completos(state)) == 8
        },
        'resumen_1x': {
            'requiere': lambda: 'ofrecer_promos' in intents_vistos
        },
        'resumen_2x': {
            'requiere': lambda: 'ofrecer_promos' in intents_vistos
        },
        'resumen_3x': {
            'requiere': lambda: 'ofrecer_promos' in intents_vistos
        },
        'compra_confirmada': {
            'requiere': lambda: any(x in intents_vistos for x in ['resumen_1x', 'resumen_2x', 'resumen_3x'])
        },
        'no_confirmado': {
            'requiere': lambda: any(x in intents_vistos for x in ['resumen_1x', 'resumen_2x', 'resumen_3x'])
        }
    }

    if intent_detectado in validaciones:
        return validaciones[intent_detectado]['requiere']()

    return True  # Informativos siempre válidos
```

### 8.3 Auto-Detección Transaccional

```javascript
// State Analyzer detecta automáticamente:

// 1. Si 8 campos completos + sin pack → ofrecer_promos
if (campos_completos_count === 8 && !state.pack) {
  intent = 'ofrecer_promos';
}

// 2. Si pack detectado + resumen no visto → resumen_{pack}
if (state.pack && !intents_vistos.includes(`resumen_${state.pack}`)) {
  intent = `resumen_${state.pack}`;
}
```

---

## 9. Seguridad y Confiabilidad

### 9.1 Prevención de Race Conditions

```sql
-- Version counter previene conflictos
UPDATE sessions_v3
SET
  state = $new_state,
  version = version + 1
WHERE session_id = $id
  AND version = $expected_version;  -- Optimistic locking

-- En Carolina v3:
-- 1. Get snapshot (version = 5)
-- 2. Wait 2 seconds
-- 3. Get snapshot again (version = 6?)
-- 4. Si version cambió → ABORT (cliente interrumpió)
```

### 9.2 Idempotencia

```javascript
// Mensajes de Callbell se guardan con ID único
INSERT INTO messages_v3 (callbell_message_id, ...)
ON CONFLICT (callbell_message_id) DO NOTHING;

// Evita duplicados si Callbell reenvía webhook
```

### 9.3 Manejo de Errores

```javascript
// Robot de Bigin:
// • Retry con backoff exponencial (1s, 2s, 4s)
// • Notificación al equipo después de 3 fallos
// • Relogin automático si sesión expirada
// • Recuperación de ventanas cerradas

// State Analyzer / Data Extractor:
// • Timeout de 30 segundos en Claude API
// • Fallback a intent "fallback" si falla
// • Log de errores para debugging
```

---

## 10. Monitoreo y Observabilidad

### 10.1 Métricas Clave

```
Conversión:
├─ hola → captura_datos_si_compra: XX%
├─ captura_datos → 8 campos: XX%
├─ ofrecer_promos → pack seleccionado: XX%
└─ resumen_Xx → compra_confirmada: XX%

Performance:
├─ Tiempo respuesta promedio: < 3s
├─ Claude API latency: ~1-2s
└─ Callbell API latency: ~500ms

Volumen:
├─ Mensajes/día
├─ Conversaciones activas
└─ Órdenes creadas/día

Errores:
├─ Rate de errores de Claude API
├─ Rate de errores de Callbell API
└─ Rate de errores de Robot Bigin
```

### 10.2 Logs Importantes

```
📥 WEBHOOK RECEIVED - Mensaje recibido
🏷️ CHECKING TAGS - Verificación de tags
🤖 INTENT FROM STATE - Intent detectado
📸 Snapshot built - Snapshot construido
✅ MESSAGE SENT SUCCESSFULLY - Mensaje enviado
⚠️ INTERRUPTED - Cliente interrumpió
📦 ORDER CREATED - Orden creada
❌ ERROR - Error ocurrido
```

---

## 11. Escalabilidad

### 11.1 Capacidad Actual

```
┌────────────────────────────────────────────────────┐
│  Conversaciones simultáneas: Ilimitadas           │
│  Limitado solo por:                                │
│    • Rate limits de APIs externas                  │
│    • Capacidad de PostgreSQL                       │
│    • Recursos de n8n                               │
└────────────────────────────────────────────────────┘
```

### 11.2 Optimizaciones

```
1. PostgreSQL:
   ├─ Índices en phone, created_at, callbell_message_id
   ├─ JSONB para state (flexible + rápido)
   └─ Particionado por fecha (futuro)

2. n8n:
   ├─ Workflows independientes (paralelizables)
   ├─ Caché de conexiones a BD
   └─ Timeout configurables

3. APIs Externas:
   ├─ Retry con backoff exponencial
   ├─ Circuit breaker (futuro)
   └─ Rate limiting awareness
```

---

## 12. Futuras Mejoras

### 12.1 Corto Plazo

- [ ] Activar Proactive Timers (testing completo primero)
- [ ] Directorio de municipios con tiempos de entrega
- [ ] Completar intents faltantes
- [ ] Dashboard de métricas en tiempo real

### 12.2 Mediano Plazo

- [ ] Multi-tenant (múltiples negocios)
- [ ] A/B testing de templates
- [ ] Analytics avanzado (Mixpanel/Amplitude)
- [ ] Notificaciones al equipo (Slack)

### 12.3 Largo Plazo

- [ ] Voice notes support
- [ ] Multi-canal (Instagram, Telegram)
- [ ] IA generativa para respuestas (sin templates)
- [ ] CRM propio (reemplazar Bigin)

---

## 📚 Referencias

- **Documentación Técnica:** `/docs/`
- **Workflows:** `/workflows/`
- **Robot de Bigin:** `/bigin-robot/`
- **Lista de Tareas:** `/TODO.md`

---

**Última actualización:** 17 de Enero 2026
**Versión del Sistema:** v3.0.0
**Autor:** Claude Sonnet 4.5

---

**🎉 Fin del Documento de Arquitectura General**
