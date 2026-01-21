# ARQUITECTURA GENERAL - SISTEMA v3DSL

> **Versión:** 3.0
> **Última actualización:** 2026-01-21
> **Propósito:** Documentación de referencia para plataforma MorfX

---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1 ¿Qué es v3DSL?

v3DSL (versión 3 Domain Specific Language) es un **sistema de agentes conversacionales autónomos** diseñado para automatizar ventas por WhatsApp. El sistema utiliza una arquitectura de microservicios orquestados donde cada agente tiene una responsabilidad específica y se comunica con los demás vía webhooks HTTP.

### 1.2 Caso de Uso: Somnio

El sistema está implementado para **Somnio** (Elixir del Sueño), un producto de bienestar vendido directamente por WhatsApp. El bot "Carolina" maneja el ciclo completo: desde el saludo inicial hasta la creación de la orden en el CRM.

### 1.3 Stack Tecnológico

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| Orquestación | n8n | Workflows visuales de automatización |
| Base de datos | PostgreSQL | Persistencia de sesiones y mensajes |
| IA | Claude API (Anthropic) | Análisis de intents y extracción de datos |
| Mensajería | Callbell | Gateway WhatsApp Business |
| CRM | Zoho Bigin | Gestión de órdenes y clientes |
| Automatización CRM | Playwright (Robot API) | Interacción programática con Bigin |

---

## 2. ARQUITECTURA DE AGENTES

### 2.1 Diagrama de Alto Nivel

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                     SISTEMA v3DSL                           │
                                    └─────────────────────────────────────────────────────────────┘

     ┌─────────────┐                                                                    ┌─────────────┐
     │   CALLBELL  │                                                                    │    BIGIN    │
     │  (WhatsApp) │                                                                    │    (CRM)    │
     └──────┬──────┘                                                                    └──────▲──────┘
            │                                                                                  │
            │ webhook                                                                          │ HTTP
            ▼                                                                                  │
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                       │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                    HISTORIAL V3                                               │   │
│   │                              (Orquestador Central)                                            │   │
│   │                                                                                               │   │
│   │  • Recibe webhooks de Callbell                                                               │   │
│   │  • Valida y filtra mensajes                                                                  │   │
│   │  • Gestiona sesiones PostgreSQL                                                              │   │
│   │  • Coordina llamadas a agentes                                                               │   │
│   │  • Dispara respuestas y órdenes                                                              │   │
│   └───────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                    │                    │                    │                    │                   │
│                    │ POST               │ POST               │ POST               │ POST              │
│                    ▼                    ▼                    ▼                    ▼                   │
│   ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│   │    STATE ANALYZER    │ │    DATA EXTRACTOR    │ │    ORDER MANAGER     │ │     CAROLINA V3      │ │
│   │                      │ │                      │ │                      │ │                      │ │
│   │  • Detecta intent    │ │  • Extrae datos      │ │  • Valida campos     │ │  • Selecciona        │ │
│   │  • Valida flujo      │ │  • Normaliza info    │ │  • Crea orden Bigin  │ │    templates         │ │
│   │  • Usa Claude AI     │ │  • Detecta negaciones│ │  • Actualiza tags    │ │  • Envía mensajes    │ │
│   │  • Retorna mode      │ │  • Mergea datos      │ │  • Marca creación    │ │  • Detecta           │ │
│   │                      │ │                      │ │                      │ │    interrupciones    │ │
│   └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│                                                                                        │              │
│                                                                                        │ GET          │
│                                                                                        ▼              │
│                                                                           ┌──────────────────────┐    │
│                                                                           │      SNAPSHOT        │    │
│                                                                           │                      │    │
│                                                                           │  • Estado read-only  │    │
│                                                                           │  • Versionamiento    │    │
│                                                                           │  • Pending messages  │    │
│                                                                           └──────────────────────┘    │
│                                                                                        ▲              │
│                                                                                        │              │
│   ┌───────────────────────────────────────────────────────────────────────────────────┘              │
│   │                                                                                                   │
│   │   ┌──────────────────────┐                                                                       │
│   │   │   PROACTIVE TIMER    │                                                                       │
│   │   │                      │                                                                       │
│   │   │  • Loop temporal     │                                                                       │
│   │   │  • Recordatorios     │                                                                       │
│   │   │  • Auto-promociones  │                                                                       │
│   │   │  • Órdenes auto      │                                                                       │
│   │   └──────────────────────┘                                                                       │
│                                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                │
                                                ▼
                                    ┌─────────────────────────────────────┐
                                    │           POSTGRESQL                │
                                    │                                     │
                                    │  ┌───────────────┐ ┌─────────────┐  │
                                    │  │ sessions_v3   │ │ messages_v3 │  │
                                    │  └───────────────┘ └─────────────┘  │
                                    └─────────────────────────────────────┘
```

### 2.2 Tabla de Agentes

| Agente | Endpoint | Responsabilidad | Trigger |
|--------|----------|-----------------|---------|
| **Historial V3** | `POST /historial-v3-callbell-webhook` | Orquestación central | Webhook Callbell |
| **State Analyzer** | `POST /state-analyzer` | Detección de intents | Historial V3 |
| **Data Extractor** | `POST /data-extractor` | Extracción de datos | Historial V3 |
| **Order Manager** | `POST /order-manager` | Creación de órdenes | Historial V3 |
| **Carolina V3** | `POST /carolina-v3-process` | Envío de respuestas | Historial V3 |
| **Snapshot** | `GET /historial-v3-snapshot` | Consulta de estado | Carolina V3, Timer |
| **Proactive Timer** | `POST /proactive-timer-instance` | Acciones temporales | Historial V3 |

---

## 3. FLUJO DE DATOS COMPLETO

### 3.1 Flujo de Mensaje Entrante

```
1. RECEPCIÓN
   Cliente → WhatsApp → Callbell → Webhook Historial V3

2. VALIDACIÓN
   Historial V3:
   ├── Valida tags (WPP, P/W, RECO, bot_off)
   ├── Valida antigüedad (<2 min)
   ├── Valida dirección (inbound)
   └── Si bloqueado → LOG y FIN

3. PERSISTENCIA
   Historial V3:
   ├── Busca/Crea sesión en sessions_v3
   ├── Incrementa version
   └── Inserta mensaje en messages_v3

4. ANÁLISIS
   Historial V3 → State Analyzer:
   ├── Envía historial + pending
   ├── Claude detecta intent
   ├── Valida transiciones
   └── Retorna intent + mode

5. EXTRACCIÓN (si mode = collecting_data)
   Historial V3 → Data Extractor:
   ├── Envía último mensaje
   ├── Claude extrae datos
   ├── Normaliza y mergea
   └── Retorna datos actualizados

6. ORDEN (si condiciones cumplidas)
   Historial V3 → Order Manager:
   ├── Valida campos mínimos
   ├── Crea orden en Bigin
   ├── Actualiza Callbell tags
   └── Marca order_created

7. RESPUESTA
   Historial V3 → Carolina V3:
   ├── Obtiene snapshot
   ├── Selecciona templates por intent
   ├── Loop de envío con delays
   ├── Detecta interrupciones
   └── Persiste outbound en historial
```

### 3.2 Flujo de Detección de Interrupciones

```
Carolina V3:
1. Obtiene snapshot (version: 5)
2. Entra al loop de mensajes

   Para cada mensaje:
   a. Wait (delay configurado)
   b. GET snapshot → version actual
   c. Si version ≠ 5 → INTERRUMPIR
   d. Si version = 5 → Enviar mensaje
   e. Persistir outbound en Historial

3. Si interrumpido:
   - Log interrupción
   - Terminar loop
   - Historial procesará nuevo mensaje
   - Carolina se re-disparará con nuevo contexto
```

### 3.3 Flujo del Proactive Timer

```
Proactive Timer:
1. Activación: Historial dispara cuando mode = collecting_data

2. Loop (cada 2 min, max 20 iteraciones):
   a. Query session state
   b. Analizar condiciones:

      Si 10 min sin datos:
      → Enviar recordatorio_no_data

      Si 6 min con datos parciales:
      → Enviar request_missing_data

      Si datos completos:
      → Trigger Carolina con ofrecer_promos

      Si 10 min sin selección de pack:
      → Crear orden con promo WPP

   c. Actualizar timestamps y flags
   d. Evaluar should_continue

3. Terminación:
   - order_created = true
   - max_iterations alcanzado
   - timeout general (40 min)
```

---

## 4. MODELO DE DATOS

### 4.1 Tabla sessions_v3

```sql
CREATE TABLE sessions_v3 (
  -- Identificadores
  session_id VARCHAR(100) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  contact_id VARCHAR(100),
  callbell_conversation_href TEXT,

  -- Estado de conversación
  state JSONB DEFAULT '{}',
  mode VARCHAR(50) DEFAULT 'conversacion',
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',

  -- Control de concurrencia
  version INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sessions_phone ON sessions_v3(phone);
CREATE INDEX idx_sessions_status ON sessions_v3(status);
CREATE INDEX idx_sessions_last_activity ON sessions_v3(last_activity);
```

### 4.2 Estructura del campo `state` (JSONB)

```typescript
interface SessionState {
  // === DATOS DEL CLIENTE ===
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  barrio?: string;
  ciudad?: string;
  departamento?: string;
  correo?: string;

  // === DATOS DE COMPRA ===
  pack?: '1x' | '2x' | '3x';
  precio?: number;

  // === TRACKING DE INTENTS ===
  _last_intent?: string;
  _intents_vistos?: Array<{
    intent: string;
    orden: number;
  }>;

  // === FLAGS DE ORDEN ===
  order_created?: boolean;
  order_created_at?: string;
  order_id?: string;
  order_url?: string;
  order_promo?: string;
  order_amount?: number;

  // === PROACTIVE TIMER ===
  _proactive_timer_active?: boolean;
  _proactive_started_at?: string;
  _first_data_at?: string;
  _min_data_at?: string;
  _ofrecer_promos_at?: string;
  _action_no_data_sent?: boolean;
  _action_missing_data_sent?: boolean;
  _action_ofrecer_promos_done?: boolean;
}
```

### 4.3 Tabla messages_v3

```sql
CREATE TABLE messages_v3 (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) REFERENCES sessions_v3(session_id),
  role VARCHAR(20) NOT NULL,        -- 'user' | 'assistant'
  content TEXT NOT NULL,
  direction VARCHAR(20) NOT NULL,   -- 'inbound' | 'outbound'
  callbell_message_id VARCHAR(100) UNIQUE,
  intent VARCHAR(100),
  payload_raw JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_messages_session ON messages_v3(session_id);
CREATE INDEX idx_messages_callbell_id ON messages_v3(callbell_message_id);
CREATE INDEX idx_messages_created ON messages_v3(created_at);
```

---

## 5. SISTEMA DE INTENTS

### 5.1 Catálogo Completo de Intents

#### Informativos (Sin restricciones)

| Intent | Descripción | Templates asociados |
|--------|-------------|---------------------|
| `hola` | Saludo inicial | Bienvenida, presentación Carolina |
| `precio` | Consulta de precios | Información de precios por pack |
| `envio` | Consulta de envío | Tiempos, costos, cobertura |
| `modopago` | Métodos de pago | Contraentrega, transferencia |
| `ingredientes` | Composición producto | Lista de ingredientes naturales |
| `funcionamiento` | Cómo funciona | Instrucciones de uso |
| `testimonios` | Casos de éxito | Testimonios de clientes |
| `garantia` | Política de garantía | Devoluciones y reembolsos |
| `otro` | No clasificable | Respuesta genérica |

#### Transaccionales (Con validaciones)

| Intent | Prerequisitos | Acción |
|--------|---------------|--------|
| `captura_datos_si_compra` | Ninguno | Activa mode collecting_data |
| `ofrecer_promos` | 8 campos completos | Muestra opciones de pack |
| `resumen_1x` | ofrecer_promos visto | Resumen pack 1 ($77,900) |
| `resumen_2x` | ofrecer_promos visto | Resumen pack 2 ($109,900) |
| `resumen_3x` | ofrecer_promos visto | Resumen pack 3 ($139,900) |
| `compra_confirmada` | resumen_Xx visto | Confirma y crea orden |

#### Combinados

| Intent | Componentes | Comportamiento |
|--------|-------------|----------------|
| `hola+precio` | hola + precio | Saludo con info de precios |
| `hola+captura` | hola + interés compra | Saludo e inicia captura |
| `precio+captura` | precio + interés compra | Precios e inicia captura |

### 5.2 Máquina de Estados de Intents

```
                                    ┌─────────────────────────────────────┐
                                    │            INFORMATIVOS             │
                                    │  hola, precio, envio, modopago...   │
                                    └──────────────────┬──────────────────┘
                                                       │
                                                       │ "quiero comprar"
                                                       ▼
                              ┌─────────────────────────────────────────────────┐
                              │           captura_datos_si_compra               │
                              │         mode: collecting_data                   │
                              └────────────────────────┬────────────────────────┘
                                                       │
                                                       │ 8 campos completos
                                                       ▼
                              ┌─────────────────────────────────────────────────┐
                              │               ofrecer_promos                    │
                              │            (auto-detectado)                     │
                              └────────────────────────┬────────────────────────┘
                                                       │
                               ┌───────────────────────┼───────────────────────┐
                               ▼                       ▼                       ▼
                        ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
                        │ resumen_1x  │         │ resumen_2x  │         │ resumen_3x  │
                        │  $77,900    │         │  $109,900   │         │  $139,900   │
                        └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
                               │                       │                       │
                               └───────────────────────┼───────────────────────┘
                                                       │
                                                       │ "sí, confirmo"
                                                       ▼
                              ┌─────────────────────────────────────────────────┐
                              │              compra_confirmada                  │
                              │    → Order Manager → Bigin → Tag WPP           │
                              └─────────────────────────────────────────────────┘
```

---

## 6. INTEGRACIONES EXTERNAS

### 6.1 Callbell API

**Base URL:** `https://api.callbell.eu/v1`

| Operación | Método | Endpoint | Propósito |
|-----------|--------|----------|-----------|
| Enviar mensaje texto | POST | `/messages` | Respuestas del bot |
| Enviar mensaje imagen | POST | `/messages` | Templates con imagen |
| Actualizar contacto | PATCH | `/contacts/{uuid}` | Agregar tags |
| Webhook entrante | POST | n8n webhook | Recibir mensajes |

**Headers:**
```
Authorization: Bearer {CALLBELL_API_KEY}
Content-Type: application/json
```

### 6.2 Anthropic Claude API

**Base URL:** `https://api.anthropic.com/v1`

| Operación | Método | Endpoint | Propósito |
|-----------|--------|----------|-----------|
| Chat completion | POST | `/messages` | Intent detection, data extraction |

**Configuración:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "headers": {
    "anthropic-version": "2023-06-01"
  }
}
```

### 6.3 Robot API (Bigin)

**Base URL:** `http://robot-api.local:3000`

| Operación | Método | Endpoint | Propósito |
|-----------|--------|----------|-----------|
| Crear orden | POST | `/bigin/create-order` | Nueva orden en CRM |

**Timeout:** 180 segundos (Playwright automation es lenta)

---

## 7. PATRONES Y MECANISMOS CLAVE

### 7.1 Optimistic Locking (Versionamiento)

```javascript
// Cada modificación incrementa version
UPDATE sessions_v3
SET
  state = $1,
  version = version + 1,
  updated_at = NOW()
WHERE session_id = $2;

// Carolina verifica version antes de cada envío
const shouldContinue = currentVersion === initialVersion;
```

### 7.2 Idempotencia de Mensajes

```sql
-- Constraint UNIQUE previene duplicados
INSERT INTO messages_v3 (session_id, content, callbell_message_id)
VALUES ($1, $2, $3)
ON CONFLICT (callbell_message_id) DO NOTHING;
```

### 7.3 Flags de Acciones Únicas

```javascript
// Prevenir acciones duplicadas
const FLAGS = {
  '_action_no_data_sent': Boolean,      // Recordatorio enviado
  '_action_missing_data_sent': Boolean,  // Solicitud de datos enviada
  '_action_ofrecer_promos_done': Boolean, // Promos ofrecidas
  'order_created': Boolean               // Orden creada
};

// Verificar antes de ejecutar
if (!state._action_no_data_sent) {
  await sendReminder();
  await updateState({ _action_no_data_sent: true });
}
```

### 7.4 Tag-Based Flow Control

```javascript
const BLOCKED_TAGS = ['WPP', 'P/W', 'RECO', 'bot_off'];

function shouldProcessMessage(tags) {
  return !tags.some(tag => BLOCKED_TAGS.includes(tag));
}
```

---

## 8. CONFIGURACIÓN Y PRECIOS

### 8.1 Configuración de Tiempos

```javascript
const TIMING_CONFIG = {
  // Validación de mensajes
  MAX_MESSAGE_AGE_SECONDS: 120,

  // Timeouts de agentes
  STATE_ANALYZER_TIMEOUT_MS: 30000,
  DATA_EXTRACTOR_TIMEOUT_MS: 30000,
  ORDER_MANAGER_TIMEOUT_MS: 180000,

  // Proactive Timer
  TIMER_LOOP_INTERVAL_MINUTES: 2,
  TIMER_MAX_ITERATIONS: 20,
  NO_DATA_REMINDER_MINUTES: 10,
  PARTIAL_DATA_REMINDER_MINUTES: 6,
  PROMO_WAIT_MINUTES: 10,

  // Carolina delays
  FIRST_MESSAGE_DELAY: 0,
  SUBSEQUENT_MESSAGE_DELAY_MIN: 2,
  SUBSEQUENT_MESSAGE_DELAY_MAX: 6
};
```

### 8.2 Configuración de Precios

```javascript
const PRICING_CONFIG = {
  '1x': {
    code: '1x',
    quantity: 1,
    price: 77900,
    currency: 'COP'
  },
  '2x': {
    code: '2x',
    quantity: 2,
    price: 109900,
    currency: 'COP'
  },
  '3x': {
    code: '3x',
    quantity: 3,
    price: 139900,
    currency: 'COP'
  },
  'WPP': {
    code: 'WPP',
    quantity: 0,
    price: 0,
    currency: 'COP',
    description: 'Sin pack seleccionado'
  }
};
```

### 8.3 Campos Requeridos

```javascript
const FIELD_CONFIG = {
  // Campos mínimos para crear orden
  MINIMUM_FIELDS: [
    'nombre',
    'apellido',
    'telefono',
    'direccion',
    'ciudad',
    'departamento'
  ],

  // Todos los campos de captura
  ALL_FIELDS: [
    'nombre',
    'apellido',
    'telefono',
    'direccion',
    'barrio',
    'ciudad',
    'departamento',
    'correo'
  ],

  // Campos tolerados vacíos
  OPTIONAL_FIELDS: ['barrio', 'correo']
};
```

---

## 9. CONSIDERACIONES DE ESCALABILIDAD

### 9.1 Puntos de Bottleneck

| Componente | Bottleneck | Mitigación |
|------------|------------|------------|
| Claude API | Rate limits, latencia | Caché de intents frecuentes |
| PostgreSQL | Conexiones concurrentes | Connection pooling |
| Callbell API | Rate limits | Queue con backoff |
| Robot API | Playwright sessions | Pool de browsers |

### 9.2 Recomendaciones para Alta Escala

1. **Redis Cache** para snapshots y sesiones activas
2. **Message Queue** (RabbitMQ/SQS) para procesamiento asíncrono
3. **Read Replicas** PostgreSQL para queries de solo lectura
4. **Horizontal Scaling** de workers n8n
5. **CDN** para templates estáticos

---

## 10. REFERENCIA PARA MORFX

### 10.1 Contratos de API Estables

```typescript
// === HISTORIAL V3 ===
interface HistorialWebhook {
  POST: '/webhook/historial-v3-callbell-webhook'
  body: CallbellWebhookPayload | TestPayload
  response: { success: boolean, message: string }
}

// === STATE ANALYZER ===
interface StateAnalyzerAPI {
  POST: '/webhook/state-analyzer'
  body: {
    phone: string
    historial: Message[]
    pending_messages: Message[]
    captured_data: SessionState
  }
  response: {
    success: boolean
    intent: string
    campos_completos: boolean
    campos_faltantes: string[]
    pack_detectado: string | null
    mode: 'conversacion' | 'collecting_data'
    intents_vistos: IntentRecord[]
  }
}

// === DATA EXTRACTOR ===
interface DataExtractorAPI {
  POST: '/webhook/data-extractor'
  body: {
    phone: string
    last_message: string
    captured_data: Partial<SessionState>
  }
  response: {
    success: boolean
    extracted: Partial<SessionState>
    merged: Partial<SessionState>
    fields_updated: string[]
    negations_detected: string[]
  }
}

// === ORDER MANAGER ===
interface OrderManagerAPI {
  POST: '/webhook/order-manager'
  body: {
    phone: string
    captured_data: SessionState
    promo?: string
    promo_override?: string
    source: string
    callbell_conversation_href?: string
    contact_id?: string
  }
  response: {
    success: boolean
    order?: {
      id: string
      name: string
      url: string
      amount: number
      promo: string
    }
    error?: string
    missing?: string[]
  }
}

// === CAROLINA V3 ===
interface CarolinaAPI {
  POST: '/webhook/carolina-v3-process'
  body: {
    phone: string
    force_intent?: string
  }
  response: { success: boolean, message: string }
}

// === SNAPSHOT ===
interface SnapshotAPI {
  GET: '/webhook/historial-v3-snapshot?phone={phone}'
  response: Snapshot
}

// === PROACTIVE TIMER ===
interface ProactiveTimerAPI {
  POST: '/webhook/proactive-timer-instance'
  body: { phone: string }
  response: { success: boolean, message: string }
}
```

### 10.2 Extensiones para Multi-Tenant

```typescript
interface TenantConfig {
  tenantId: string;
  name: string;

  // Canales
  channels: ChannelConfig[];

  // Producto
  product: ProductConfig;

  // Flujo conversacional
  intents: IntentConfig;
  templates: TemplateConfig;

  // Integraciones
  crm: CRMConfig;
  messaging: MessagingConfig;
  ai: AIConfig;

  // Tiempos
  timing: TimingConfig;
}

interface ChannelConfig {
  type: 'whatsapp' | 'telegram' | 'webchat' | 'instagram';
  provider: string;
  credentials: Record<string, string>;
  webhookUrl: string;
}
```

### 10.3 Abstracción de Agentes

```typescript
interface Agent {
  name: string;
  endpoint: string;
  process(input: AgentInput): Promise<AgentOutput>;
  healthCheck(): Promise<boolean>;
}

interface AgentOrchestrator {
  register(agent: Agent): void;
  route(message: IncomingMessage): Promise<Agent[]>;
  execute(agents: Agent[], context: ConversationContext): Promise<void>;
}
```

### 10.4 Event Bus para Observabilidad

```typescript
interface SystemEvent {
  eventId: string;
  timestamp: Date;
  tenantId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, any>;
}

type EventTypes =
  | 'message.received'
  | 'message.sent'
  | 'intent.detected'
  | 'data.extracted'
  | 'order.created'
  | 'timer.started'
  | 'timer.action'
  | 'error.occurred';

interface EventBus {
  publish(event: SystemEvent): Promise<void>;
  subscribe(eventType: EventTypes, handler: EventHandler): Unsubscribe;
}
```

---

## 11. RESUMEN EJECUTIVO

### 11.1 Fortalezas del Sistema

1. **Arquitectura desacoplada:** Cada agente es independiente y escalable
2. **Control de concurrencia:** Versionamiento previene race conditions
3. **Detección de interrupciones:** UX natural cuando cliente interrumpe
4. **Acciones proactivas:** Timer automatiza seguimiento
5. **Idempotencia:** Flags previenen acciones duplicadas

### 11.2 Áreas de Mejora para MorfX

1. **Multi-tenant nativo:** Actualmente single-tenant
2. **Multi-canal:** Expandir más allá de WhatsApp
3. **Analytics en tiempo real:** Dashboard de métricas
4. **A/B Testing:** Experimentación de templates
5. **CRM genérico:** Abstracción más allá de Bigin

### 11.3 Métricas Clave a Monitorear

| Métrica | Descripción | Target |
|---------|-------------|--------|
| Response Time | Tiempo hasta primera respuesta | < 3 segundos |
| Conversion Rate | Saludos → Órdenes | > 70% |
| Data Capture Rate | Campos capturados por sesión | > 90% |
| Interruption Rate | Loops interrumpidos | < 20% |
| Timer Effectiveness | Órdenes por timer | > 30% |

---

**Este documento sirve como referencia maestra para la implementación de la plataforma MorfX, preservando los patrones y arquitectura probados del sistema v3DSL.**
