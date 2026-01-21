# 06 - PROACTIVE TIMER

> **Rol:** Gestor de Acciones Proactivas Basadas en Tiempo
> **Endpoint:** `POST /webhook/proactive-timer-instance`
> **Archivo:** `workflows/06-proactive-timer-instance.json`

---

## 1. DESCRIPCIÓN GENERAL

Proactive Timer es el **agente de automatización temporal** del sistema v3DSL. Ejecuta acciones proactivas basadas en el tiempo transcurrido desde eventos específicos: envía recordatorios cuando el cliente no responde, ofrece promociones cuando los datos están completos, y crea órdenes automáticas cuando el cliente abandona el proceso.

### Responsabilidades Principales
- Monitorear sesiones activas en modo collecting_data
- Enviar recordatorios de datos faltantes
- Detectar oportunidad de ofrecer promociones
- Crear órdenes automáticas por abandono
- Gestionar ciclo de vida del timer (activar/desactivar)
- Prevenir acciones duplicadas con flags de idempotencia

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PROACTIVE TIMER INSTANCE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐                        │
│  │ Webhook  │───▶│ Query       │───▶│ Check If Timer   │                        │
│  │ POST     │    │ Session     │    │ Already Active   │                        │
│  └──────────┘    └─────────────┘    └────────┬─────────┘                        │
│                                               │                                  │
│                              ┌────────────────┴────────────────┐                 │
│                              ▼                                 ▼                 │
│                       [timer_active]                    [timer_inactive]         │
│                              │                                 │                 │
│                              ▼                                 ▼                 │
│                       ┌─────────────┐                  ┌─────────────┐           │
│                       │ End -       │                  │ Mark Timer  │           │
│                       │ Already     │                  │ Active      │           │
│                       │ Active      │                  └──────┬──────┘           │
│                       └─────────────┘                         │                  │
│                                                               ▼                  │
│                                                        ┌─────────────┐           │
│                                                        │ Initialize  │           │
│                                                        │ Loop        │           │
│                                                        │ (iter=0)    │           │
│                                                        └──────┬──────┘           │
│                                                               │                  │
│  ┌───────────────────────────────────────────────────────────┴───────────────┐  │
│  │                           LOOP PRINCIPAL (max 20 iteraciones)             │  │
│  │                                                                           │  │
│  │  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐                 │  │
│  │  │ Wait     │───▶│ Query       │───▶│ Analyze          │                 │  │
│  │  │ 2 min    │    │ Session     │    │ State            │                 │  │
│  │  └──────────┘    │ State       │    └────────┬─────────┘                 │  │
│  │                  └─────────────┘              │                          │  │
│  │                                               │                          │  │
│  │       ┌───────────────┬───────────────┬──────┴──────┬───────────────┐    │  │
│  │       ▼               ▼               ▼             ▼               ▼    │  │
│  │  [reminder     [request        [ofrecer       [create        [no_action] │  │
│  │   _no_data]     _missing]       _promos]       _order]             │    │  │
│  │       │               │               │             │               │    │  │
│  │       ▼               ▼               ▼             ▼               │    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │  │
│  │  │ Send     │  │ Prepare  │  │ Format   │  │ Call     │            │    │  │
│  │  │ Reminder │  │ Missing  │  │ Ofrecer  │  │ Order    │            │    │  │
│  │  │ No Data  │  │ Data Msg │  │ Promos   │  │ Manager  │            │    │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │    │  │
│  │       │               │               │             │               │    │  │
│  │       │               ▼               ▼             │               │    │  │
│  │       │         ┌──────────┐  ┌──────────┐         │               │    │  │
│  │       │         │ Send     │  │ Call     │         │               │    │  │
│  │       │         │ Request  │  │ Carolina │         │               │    │  │
│  │       │         └────┬─────┘  └────┬─────┘         │               │    │  │
│  │       │               │               │             │               │    │  │
│  │       └───────────────┴───────────────┴─────────────┴───────────────┘    │  │
│  │                                       │                                  │  │
│  │                                       ▼                                  │  │
│  │                                ┌─────────────┐                           │  │
│  │                                │ Update      │                           │  │
│  │                                │ Timestamps  │                           │  │
│  │                                └──────┬──────┘                           │  │
│  │                                       │                                  │  │
│  │                                       ▼                                  │  │
│  │                                ┌─────────────┐                           │  │
│  │                                │ Should      │                           │  │
│  │                                │ Continue?   │                           │  │
│  │                                └──────┬──────┘                           │  │
│  │                        ┌──────────────┴──────────────┐                   │  │
│  │                        ▼                             ▼                   │  │
│  │                 [should_continue]              [should_stop]             │  │
│  │                        │                             │                   │  │
│  │                        ▼                             ▼                   │  │
│  │                 ┌─────────────┐               ┌─────────────┐            │  │
│  │                 │ Continue    │               │ Mark Timer  │            │  │
│  │                 │ Loop        │               │ Inactive    │            │  │
│  │                 │ (iter++)    │               └──────┬──────┘            │  │
│  │                 └──────┬──────┘                      │                   │  │
│  │                        │                             ▼                   │  │
│  │                        │                      ┌─────────────┐            │  │
│  │                        └───────────────────▶  │ End -       │            │  │
│  │                                               │ Complete    │            │  │
│  │                                               └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook** | `webhook` | Recibe POST en `/proactive-timer-instance` |
| 2 | **Query Session Initial** | `postgres` | Obtiene datos de sesión por teléfono |
| 3 | **Check If Timer Active** | `code` | Verifica flag `_proactive_timer_active` |
| 4 | **IF Timer Already Active** | `if` | Bifurca si timer ya está corriendo |
| 5 | **End - Already Active** | `noOp` | Termina si timer duplicado |
| 6 | **Mark Timer Active** | `postgres` | Actualiza `_proactive_timer_active = true` |
| 7 | **Initialize Loop** | `code` | Inicializa `iteration = 0`, `max_iterations = 20` |
| 8 | **Wait 2 Minutes** | `wait` | Delay de 2 minutos entre iteraciones |
| 9 | **Query Session State** | `postgres` | Obtiene estado actualizado de sesión |
| 10 | **Analyze State** | `code` | Evalúa condiciones y determina acción |
| 11 | **IF Reminder No Data** | `if` | Condición: `action === "reminder_no_data"` |
| 12 | **Send Reminder No Data** | `httpRequest` | Envía mensaje de recordatorio vía Callbell |
| 13 | **IF Request Missing Data** | `if` | Condición: `action === "request_missing_data"` |
| 14 | **Prepare Missing Data Message** | `code` | Formatea lista de campos faltantes |
| 15 | **Send Request Missing Data** | `httpRequest` | Envía solicitud de datos faltantes |
| 16 | **IF Ofrecer Promos** | `if` | Condición: `action === "ofrecer_promos"` |
| 17 | **Format Ofrecer Promos** | `code` | Prepara mensaje promocional |
| 18 | **Call Carolina - Ofrecer Promos** | `httpRequest` | Dispara Carolina con intent promos |
| 19 | **Confirma Promo** | `httpRequest` | Mensaje de confirmación post-promo |
| 20 | **IF Create Order** | `if` | Condición: `action === "create_order"` |
| 21 | **Call Order Manager** | `httpRequest` | Crea orden con promo WPP |
| 22 | **Update Timestamps** | `postgres` | Actualiza timestamps de acciones |
| 23 | **IF Should Continue** | `if` | Evalúa si continuar loop |
| 24 | **Continue Loop** | `code` | Incrementa iteración |
| 25 | **Mark Timer Inactive** | `postgres` | `_proactive_timer_active = false` |
| 26 | **End - Complete** | `noOp` | Termina loop completado |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST https://n8n.automatizacionesmorf.com/webhook/proactive-timer-instance
```

**Payload de Entrada:**
```json
{
  "phone": "573001234567"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Timer started"
}
```

### 3.2 Endpoints Consumidos

| Servicio | Endpoint | Método | Propósito |
|----------|----------|--------|-----------|
| Callbell API | `https://api.callbell.eu/v1/messages` | POST | Enviar recordatorios |
| Carolina V3 | `/webhook/carolina-v3-process` | POST | Disparar respuestas |
| Order Manager | `/webhook/order-manager` | POST | Crear orden automática |

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Configuración de Tiempos

```javascript
const TIMER_CONFIG = {
  // Intervalo entre iteraciones del loop
  LOOP_INTERVAL_MINUTES: 2,

  // Máximo de iteraciones (2min × 20 = 40min total)
  MAX_ITERATIONS: 20,

  // Tiempo sin datos antes de recordatorio inicial
  NO_DATA_REMINDER_MINUTES: 10,

  // Tiempo con datos parciales antes de solicitar faltantes
  FIRST_DATA_REMINDER_MINUTES: 6,

  // Tiempo con datos mínimos antes de segundo recordatorio
  MIN_DATA_REMINDER_MINUTES: 2,

  // Tiempo esperando selección de promo antes de crear orden
  PROMO_WAIT_MINUTES: 10
};
```

### 4.2 Campos Monitoreados

```javascript
const FIELDS = {
  // Campos mínimos para crear orden
  MINIMUM: ['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento'],

  // Todos los campos de captura
  ALL: ['nombre', 'apellido', 'telefono', 'direccion', 'barrio', 'ciudad', 'departamento', 'correo']
};
```

### 4.3 Lógica de Análisis de Estado

```javascript
function analyzeState(session, state) {
  const now = new Date();

  // Parsear timestamps
  const proactiveStartedAt = parseTimestamp(state._proactive_started_at) || now;
  const firstDataAt = parseTimestamp(state._first_data_at);
  const minDataAt = parseTimestamp(state._min_data_at);
  const ofrecerPromosAt = parseTimestamp(state._ofrecer_promos_at);
  const lastActivity = parseTimestamp(session.last_activity);

  // Calcular minutos transcurridos
  const minSinceStart = (now - proactiveStartedAt) / 60000;
  const minSinceFirstData = firstDataAt ? (now - firstDataAt) / 60000 : 0;
  const minSinceMinData = minDataAt ? (now - minDataAt) / 60000 : 0;
  const minSinceOfrecerPromos = ofrecerPromosAt ? (now - ofrecerPromosAt) / 60000 : 0;
  const minSinceLastActivity = (now - lastActivity) / 60000;

  // Evaluar estado de datos
  const presentMinFields = FIELDS.MINIMUM.filter(f =>
    state[f] && String(state[f]).trim() !== '' && state[f] !== 'N/A'
  );
  const hasAnyData = presentMinFields.length > 0;
  const hasMinData = presentMinFields.length >= 6;
  const missingFields = FIELDS.ALL.filter(f =>
    !state[f] || String(state[f]).trim() === '' || state[f] === 'N/A'
  );

  // Flags de acciones ya realizadas
  const noDataSent = state._action_no_data_sent || false;
  const missingDataSent = state._action_missing_data_sent || false;
  const ofrecerPromosDone = state._action_ofrecer_promos_done || false;
  const orderCreated = state.order_created || false;

  // Detectar si cliente respondió recientemente
  const clientResponded = minSinceLastActivity < 2;

  // REGLAS DE DECISIÓN
  let action = 'no_action';
  let shouldContinue = true;

  // Si cliente respondió, reset y continuar
  if (clientResponded) {
    return { action: 'no_action', shouldContinue: true, reason: 'client_responded' };
  }

  // Si orden ya creada, terminar
  if (orderCreated) {
    return { action: 'no_action', shouldContinue: false, reason: 'order_created' };
  }

  // CASO 1: Sin datos después de 10 minutos
  if (!hasAnyData && minSinceStart >= 10 && !noDataSent) {
    action = 'reminder_no_data';
  }

  // CASO 2: Datos parciales después de 6 minutos
  else if (hasAnyData && !hasMinData && minSinceFirstData >= 6 && !missingDataSent) {
    action = 'request_missing_data';
  }

  // CASO 3: Datos completos, ofrecer promos
  else if (hasMinData && !ofrecerPromosDone) {
    action = 'ofrecer_promos';
  }

  // CASO 4: Promos ofrecidas, crear orden automática después de 10 min
  else if (ofrecerPromosDone && minSinceOfrecerPromos >= 10 && !orderCreated) {
    action = 'create_order';
    shouldContinue = false;
  }

  // Determinar si continuar el loop
  if (minSinceStart >= 40) {
    shouldContinue = false; // Timeout general
  }

  return {
    action,
    shouldContinue,
    data: {
      missingFields,
      minSinceStart,
      presentFields: presentMinFields.length
    }
  };
}
```

### 4.4 Mensajes Proactivos

#### Recordatorio Sin Datos (10 min sin respuesta)

```javascript
const REMINDER_NO_DATA = `
¡Hola! 👋

Noté que no hemos recibido tus datos para procesar tu pedido.

¿Sigues interesado en el Elixir del Sueño?

Solo necesito:
✅ Nombre completo
✅ Teléfono
✅ Dirección de entrega
✅ Ciudad y departamento

¡Estoy aquí para ayudarte! 💫
`;
```

#### Solicitud de Datos Faltantes (6 min con datos parciales)

```javascript
function buildMissingDataMessage(missingFields, nombre) {
  const fieldLabels = {
    nombre: 'Nombre',
    apellido: 'Apellido',
    telefono: 'Teléfono',
    direccion: 'Dirección completa',
    barrio: 'Barrio',
    ciudad: 'Ciudad',
    departamento: 'Departamento',
    correo: 'Correo electrónico'
  };

  const missingList = missingFields
    .map((f, i) => `${i + 1}. ${fieldLabels[f]}`)
    .join('\n');

  return `
¡Hola ${nombre || ''}! 👋

Para completar tu pedido, solo me faltan estos datos:

${missingList}

¿Me los puedes compartir? 📝
`;
}
```

---

## 5. FLAGS DE IDEMPOTENCIA

### 5.1 Flags en State

```javascript
const IDEMPOTENCY_FLAGS = {
  // Timer activo
  '_proactive_timer_active': Boolean,

  // Timestamp de inicio
  '_proactive_started_at': 'ISO timestamp',

  // Timestamp del primer dato recibido
  '_first_data_at': 'ISO timestamp',

  // Timestamp de datos mínimos completos
  '_min_data_at': 'ISO timestamp',

  // Timestamp de cuando se ofrecieron promos
  '_ofrecer_promos_at': 'ISO timestamp',

  // Acciones ya ejecutadas
  '_action_no_data_sent': Boolean,
  '_action_missing_data_sent': Boolean,
  '_action_ofrecer_promos_done': Boolean
};
```

### 5.2 Actualización de Flags

```sql
-- Después de enviar recordatorio sin datos
UPDATE sessions_v3
SET state = state || '{"_action_no_data_sent": true}'::jsonb
WHERE phone = $1;

-- Después de solicitar datos faltantes
UPDATE sessions_v3
SET state = state || '{"_action_missing_data_sent": true}'::jsonb
WHERE phone = $1;

-- Después de ofrecer promos
UPDATE sessions_v3
SET state = state || jsonb_build_object(
  '_action_ofrecer_promos_done', true,
  '_ofrecer_promos_at', NOW()::text
)
WHERE phone = $1;
```

---

## 6. CICLO DE VIDA DEL TIMER

### 6.1 Activación

```javascript
// Disparado desde Historial V3 cuando:
// 1. Usuario indica interés en comprar (captura_datos_si_compra)
// 2. Modo cambia a 'collecting_data'

async function startProactiveTimer(phone) {
  await fetch('/webhook/proactive-timer-instance', {
    method: 'POST',
    body: JSON.stringify({ phone })
  });
}
```

### 6.2 Desactivación

El timer se desactiva cuando:
1. **Orden creada:** `order_created = true`
2. **Cliente agregó tag bloqueado:** WPP, P/W, bot_off
3. **Timeout general:** 40 minutos sin completar
4. **Max iteraciones:** 20 iteraciones alcanzadas

### 6.3 Prevención de Duplicados

```javascript
// Al inicio del timer
const isActive = state._proactive_timer_active === true;

if (isActive) {
  return { status: 'already_running' };
}

// Marcar como activo
await updateState(phone, { _proactive_timer_active: true });
```

---

## 7. INTEGRACIÓN CON OTROS AGENTES

### 7.1 Trigger a Carolina (Ofrecer Promos)

```javascript
// Cuando datos completos, disparar Carolina con intent específico
await fetch('/webhook/carolina-v3-process', {
  method: 'POST',
  body: JSON.stringify({
    phone,
    force_intent: 'ofrecer_promos'
  })
});
```

### 7.2 Trigger a Order Manager (Orden Automática)

```javascript
// Crear orden con promo WPP (sin pack seleccionado)
await fetch('/webhook/order-manager', {
  method: 'POST',
  body: JSON.stringify({
    phone,
    captured_data: state,
    promo_override: 'WPP', // Forzar promo sin pack
    source: 'proactive_timer'
  })
});
```

---

## 8. MANEJO DE ERRORES

### 8.1 Errores Esperados

| Error | Causa | Manejo |
|-------|-------|--------|
| Session not found | Teléfono no existe | Terminar timer |
| Callbell error | API caída | Retry en próxima iteración |
| Order Manager error | Error creando orden | Log y continuar |
| Timeout excedido | Loop muy largo | Terminar gracefully |

### 8.2 Cleanup en Error

```javascript
// En caso de error fatal, limpiar flags
async function cleanupTimer(phone, error) {
  await updateState(phone, {
    _proactive_timer_active: false,
    _proactive_error: error.message,
    _proactive_ended_at: new Date().toISOString()
  });
}
```

---

## 9. MÉTRICAS Y LOGGING

### 9.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `timer_started` | phone, iteration |
| `timer_skipped` | phone, reason (already_active) |
| `action_executed` | phone, action, iteration |
| `reminder_sent` | phone, type (no_data/missing_data) |
| `promos_offered` | phone, fields_complete |
| `auto_order_created` | phone, promo (WPP) |
| `timer_completed` | phone, total_iterations, reason |

---

## 10. CONSIDERACIONES PARA MORFX

### 10.1 Sistema de Timers Configurable

```typescript
interface ProactiveTimerConfig {
  tenantId: string;
  enabled: boolean;
  timings: TimingConfig;
  actions: ActionConfig[];
  messages: MessageTemplates;
}

interface TimingConfig {
  loopIntervalMinutes: number;
  maxIterations: number;
  noDataReminderMinutes: number;
  partialDataReminderMinutes: number;
  promoWaitMinutes: number;
  totalTimeoutMinutes: number;
}

interface ActionConfig {
  trigger: 'no_data' | 'partial_data' | 'complete_data' | 'promo_timeout';
  action: 'send_message' | 'trigger_flow' | 'create_order';
  condition: (state: State) => boolean;
  payload: Record<string, any>;
}
```

### 10.2 Scheduler Distribuido

```typescript
interface TimerScheduler {
  start(sessionId: string, config: ProactiveTimerConfig): Promise<string>;
  stop(timerId: string): Promise<void>;
  pause(timerId: string): Promise<void>;
  resume(timerId: string): Promise<void>;
  getStatus(timerId: string): Promise<TimerStatus>;
}

// Implementación con Redis para distribución
class RedisTimerScheduler implements TimerScheduler {
  // Usar sorted sets para programar ejecuciones
  // Locks distribuidos para evitar duplicados
  // Pub/sub para notificaciones
}
```

### 10.3 Workflow Visual de Timers

```typescript
interface TimerWorkflow {
  nodes: TimerNode[];
  edges: TimerEdge[];
  triggers: TimerTrigger[];
}

interface TimerNode {
  id: string;
  type: 'wait' | 'condition' | 'action' | 'end';
  config: Record<string, any>;
}

interface TimerTrigger {
  event: 'session_created' | 'mode_changed' | 'data_updated';
  condition: (event: Event) => boolean;
  startNode: string;
}
```

### 10.4 Métricas de Conversión

```typescript
interface TimerMetrics {
  tenantId: string;
  period: DateRange;

  // Funnel de conversión
  timersStarted: number;
  remindersNoDataSent: number;
  remindersMissingDataSent: number;
  promosOffered: number;
  ordersAutoCreated: number;
  ordersManualCreated: number;

  // Tiempos promedio
  avgTimeToFirstData: number;
  avgTimeToComplete: number;
  avgTimeToOrder: number;

  // Tasas
  conversionRate: number;
  abandonmentRate: number;
  reminderResponseRate: number;
}
```
