# 02 - CAROLINA V3

> **Rol:** Generador y Despachador de Respuestas
> **Endpoint:** `POST /webhook/carolina-v3-process`
> **Archivo:** `workflows/02-carolina-v3.json`

---

## 1. DESCRIPCIÓN GENERAL

Carolina V3 es el **agente de respuesta** del sistema. Recibe triggers desde Historial V3, selecciona las plantillas apropiadas según el intent detectado, y envía mensajes secuenciales a WhatsApp vía Callbell con control de interrupciones en tiempo real.

### Responsabilidades Principales
- Obtener snapshot de conversación actual
- Verificar que existan mensajes pendientes por responder
- Validar que el bot no esté bloqueado por tags
- Seleccionar plantillas según intent detectado
- Enviar mensajes con delays configurables
- Detectar interrupciones del cliente durante el envío
- Persistir mensajes outbound en el historial
- Agregar tag WPP cuando se confirma compra

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CAROLINA V3                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────────┐        │
│  │ Webhook  │───▶│ Respond  │───▶│ Parse       │───▶│ Get Snapshot     │        │
│  │ Trigger  │    │ 200 OK   │    │ Trigger     │    │ (HTTP Request)   │        │
│  └──────────┘    └──────────┘    └─────────────┘    └────────┬─────────┘        │
│                                                               │                  │
│                                                               ▼                  │
│                                                        ┌─────────────┐           │
│                                                        │ Check       │           │
│                                                        │ Pending > 0 │           │
│                                                        └──────┬──────┘           │
│                                          ┌───────────────────┴──────────────┐    │
│                                          ▼                                  ▼    │
│                                   [pending > 0]                      [pending = 0]│
│                                          │                                  │    │
│                                          ▼                                  ▼    │
│                                   ┌─────────────┐                   ┌──────────┐ │
│                                   │ Extract     │                   │ Log No   │ │
│                                   │ Intent      │                   │ Pending  │ │
│                                   └──────┬──────┘                   └──────────┘ │
│                                          ▼                                       │
│                                   ┌─────────────┐                                │
│                                   │ Check Tags  │                                │
│                                   │ (Bloqueado?)│                                │
│                                   └──────┬──────┘                                │
│                            ┌─────────────┴─────────────┐                         │
│                            ▼                           ▼                         │
│                     [tags OK]                   [blocked]                        │
│                            │                           │                         │
│                            │                           ▼                         │
│                            │                   ┌─────────────┐                   │
│                            │                   │ Log Bot     │                   │
│                            │                   │ Disabled    │                   │
│                            │                   └─────────────┘                   │
│                            ▼                                                     │
│                     ┌─────────────┐                                              │
│                     │ Select      │                                              │
│                     │ Templates   │                                              │
│                     └──────┬──────┘                                              │
│                            ▼                                                     │
│                     ┌─────────────┐                                              │
│                     │ Split Msgs  │                                              │
│                     │ for Loop    │                                              │
│                     └──────┬──────┘                                              │
│                            ▼                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         LOOP DE MENSAJES                                  │  │
│  │                                                                           │  │
│  │  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────────┐   │  │
│  │  │ Loop     │───▶│ Wait         │───▶│ Pre-check   │───▶│ Compare    │   │  │
│  │  │ Over     │    │ (delay_s)    │    │ Version     │    │ Versions   │   │  │
│  │  │ Items    │    └──────────────┘    └─────────────┘    └─────┬──────┘   │  │
│  │  └──────────┘                                                 │          │  │
│  │       ▲                                        ┌──────────────┴────────┐ │  │
│  │       │                                        ▼                       ▼ │  │
│  │       │                                 [should_continue]     [interrupted]│ │
│  │       │                                        │                       │ │  │
│  │       │                                        ▼                       ▼ │  │
│  │       │                                 ┌─────────────┐        ┌─────────┐│  │
│  │       │                                 │ Text or     │        │ Log     ││  │
│  │       │                                 │ Template?   │        │Interrupt││  │
│  │       │                                 └──────┬──────┘        └─────────┘│  │
│  │       │                          ┌────────────┴────────────┐             │  │
│  │       │                          ▼                         ▼             │  │
│  │       │                   [tipo=texto]              [tipo=template]      │  │
│  │       │                          │                         │             │  │
│  │       │                          ▼                         ▼             │  │
│  │       │                   ┌─────────────┐           ┌─────────────┐      │  │
│  │       │                   │ Send to     │           │ Prepare     │      │  │
│  │       │                   │ Callbell    │           │ Template    │      │  │
│  │       │                   │ (text)      │           │ Message     │      │  │
│  │       │                   └──────┬──────┘           └──────┬──────┘      │  │
│  │       │                          │                         ▼             │  │
│  │       │                          │                  ┌─────────────┐      │  │
│  │       │                          │                  │ Send        │      │  │
│  │       │                          │                  │ Template    │      │  │
│  │       │                          │                  │ to Callbell │      │  │
│  │       │                          │                  └──────┬──────┘      │  │
│  │       │                          └────────────┬────────────┘             │  │
│  │       │                                       ▼                          │  │
│  │       │                                ┌─────────────┐                   │  │
│  │       │                                │ Save        │                   │  │
│  │       │                                │ Outbound    │                   │  │
│  │       │                                │ to Historial│                   │  │
│  │       │                                └──────┬──────┘                   │  │
│  │       │                                       ▼                          │  │
│  │       │                                ┌─────────────┐                   │  │
│  │       │                                │ Log Success │                   │  │
│  │       │                                └──────┬──────┘                   │  │
│  │       └───────────────────────────────────────┘                          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│                            ┌─────────────┐                                       │
│                            │ Is          │                                       │
│                            │ Confirmation│                                       │
│                            └──────┬──────┘                                       │
│                     ┌─────────────┴─────────────┐                                │
│                     ▼                           ▼                                │
│              [compra_confirmada]          [other intent]                         │
│                     │                                                            │
│                     ▼                                                            │
│              ┌─────────────┐                                                     │
│              │ Wait 10s    │                                                     │
│              └──────┬──────┘                                                     │
│                     ▼                                                            │
│              ┌─────────────┐                                                     │
│              │ Add WPP Tag │                                                     │
│              └─────────────┘                                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook Trigger** | `webhook` | Recibe trigger de Historial V3 |
| 2 | **Respond Immediately** | `respondToWebhook` | Retorna `{"success": true, "message": "Processing"}` |
| 3 | **Parse Trigger** | `code` | Extrae `phone` del body; lanza error si falta |
| 4 | **Get Snapshot** | `httpRequest` | GET a `/webhook/historial-v3-snapshot?phone=...` |
| 5 | **Check Pending > 0** | `if` | Condición: `pending_count > 0` |
| 6 | **Extract Intent from State** | `code` | Lee `_last_intent` del state del snapshot |
| 7 | **Check Tags (Bot Bloqueado?)** | `code` | Identifica tags bloqueados: WPP, P/W, bot_off, RECO |
| 8 | **IF: Tags Allow Bot?** | `if` | Condición: `has_blocked_tag === false` |
| 9 | **Log Bot Disabled** | `code` | Registra razón: "bot_disabled_by_tags" |
| 10 | **Select Templates** | `code` | Lee plantillas JSON, filtra duplicados, sustituye variables |
| 11 | **Split Messages for Loop** | `code` | Convierte array de mensajes en items para loop |
| 12 | **Loop Over Items** | `splitInBatches` | Procesa mensajes secuencialmente |
| 13 | **Wait** | `wait` | Delay configurable: `{{$json.mensaje.delay_s}}` segundos |
| 14 | **Pre-check Version** | `httpRequest` | GET snapshot para verificar versión |
| 15 | **Compare Versions** | `code` | Detecta interrupción comparando versiones |
| 16 | **Should Send?** | `if` | Condición: `should_continue === true` |
| 17 | **Text or Template?** | `if` | Condición: `mensaje.tipo === "texto"` |
| 18 | **Send to Callbell** | `httpRequest` | POST mensaje de texto a Callbell API |
| 19 | **Prepare Template Message** | `code` | Mapea UUID de template a URL de imagen |
| 20 | **Send Template to Callbell** | `httpRequest` | POST mensaje con imagen a Callbell API |
| 21 | **Prepare Outbound Message** | `code` | Estructura mensaje para historial (texto) |
| 22 | **Prepare Outbound Message (Template)** | `code` | Estructura mensaje para historial (template) |
| 23 | **Save Outbound to Historial** | `httpRequest` | POST a historial-v3-callbell-webhook |
| 24 | **Log Success** | `code` | Registra envío exitoso |
| 25 | **Log No Pending** | `code` | Registra: "already_processed_by_another_instance" |
| 26 | **Log Interrupted** | `code` | Registra detalles de interrupción |
| 27 | **Is Confirmation?** | `if` | Condición: `intent === "compra_confirmada"` |
| 28 | **Wait1** | `wait` | Delay 10 segundos antes de agregar tag |
| 29 | **HTTP: Add WPP Tag** | `httpRequest` | PATCH contacto en Callbell para agregar tag "WPP" |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST https://n8n.automatizacionesmorf.com/webhook/carolina-v3-process
```

**Payload:**
```json
{
  "phone": "573001234567"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Processing"
}
```

### 3.2 Endpoints Consumidos

| Servicio | Endpoint | Método | Propósito |
|----------|----------|--------|-----------|
| Snapshot | `/webhook/historial-v3-snapshot` | GET | Obtener estado actual |
| Callbell API | `https://api.callbell.eu/v1/messages` | POST | Enviar mensajes |
| Callbell API | `https://api.callbell.eu/v1/contacts/{uuid}` | PATCH | Actualizar tags |
| Historial V3 | `/webhook/historial-v3-callbell-webhook` | POST | Persistir outbound |

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Sistema de Detección de Interrupciones

El mecanismo clave que diferencia a Carolina V3 es su capacidad de detectar cuando el cliente envía un nuevo mensaje mientras el bot está respondiendo.

```javascript
// Antes de enviar cada mensaje del loop:
const versionInicial = snapshot.version;
const snapshotActual = await getSnapshot(phone);

if (snapshotActual.version !== versionInicial) {
  // Cliente envió mensaje → INTERRUMPIR
  return { should_continue: false, reason: 'client_interrupted' };
}
```

**Flujo de versiones:**
```
1. Carolina obtiene snapshot (version: 5)
2. Carolina envía mensaje 1/3
3. Cliente envía "Espera, tengo una pregunta"
4. Historial incrementa version → 6
5. Carolina pre-check antes de mensaje 2/3
6. Carolina detecta version 6 ≠ 5 → INTERRUMPE
7. Historial procesa nuevo mensaje del cliente
8. Carolina se re-dispara con nuevo contexto
```

### 4.2 Selección de Plantillas

```javascript
function selectTemplates(intent, state, mensajesYaEnviados) {
  // 1. Cargar plantillas desde archivo JSON
  const plantillas = loadPlantillas();

  // 2. Filtrar por intent
  let candidatas = plantillas.filter(p => p.intents.includes(intent));

  // 3. Evitar duplicados (comparar primeros 50 chars)
  candidatas = candidatas.filter(p => {
    const preview = p.contenido.substring(0, 50);
    return !mensajesYaEnviados.some(m =>
      m.content.substring(0, 50) === preview
    );
  });

  // 4. Sustituir variables
  return candidatas.map(p => ({
    ...p,
    contenido: substituirVariables(p.contenido, state)
  }));
}
```

### 4.3 Sustitución de Variables

```javascript
const VARIABLES = {
  '{{nombre}}': (state) => state.nombre || 'amigo',
  '{{precio}}': (state) => formatCurrency(state.precio),
  '{{pack}}': (state) => state.pack || '',
  '{{ciudad}}': (state) => state.ciudad || '',
  '{{direccion}}': (state) => state.direccion || ''
};

function substituirVariables(texto, state) {
  let resultado = texto;
  for (const [variable, getter] of Object.entries(VARIABLES)) {
    resultado = resultado.replace(new RegExp(variable, 'g'), getter(state));
  }
  return resultado;
}
```

### 4.4 Tags Bloqueados

| Tag | Significado | Acción |
|-----|-------------|--------|
| `WPP` | Compra completada | No responder |
| `P/W` | Proceso web activo | No responder |
| `bot_off` | Deshabilitado manual | No responder |
| `RECO` | Modo remarketing | No responder |

### 4.5 Configuración de Delays

```javascript
const DELAY_CONFIG = {
  primerMensaje: 0,        // Inmediato
  mensajesSiguientes: {
    min: 2,                // 2 segundos mínimo
    max: 6                 // 6 segundos máximo
  }
};

// Delay por mensaje definido en plantilla:
{
  "contenido": "¡Hola! Soy Carolina...",
  "delay_s": 0,
  "tipo": "texto"
}
```

---

## 5. ESTRUCTURA DE PLANTILLAS

### 5.1 Formato de Plantilla de Texto

```json
{
  "id": "saludo_inicial",
  "intents": ["hola", "saludo"],
  "tipo": "texto",
  "contenido": "¡Hola {{nombre}}! Soy Carolina, tu asesora de Somnio. ¿En qué puedo ayudarte hoy?",
  "delay_s": 0,
  "orden": 1
}
```

### 5.2 Formato de Plantilla de Imagen/Template

```json
{
  "id": "promo_2x",
  "intents": ["ofrecer_promos", "resumen_2x"],
  "tipo": "template",
  "template_uuid": "tpl_abc123",
  "image_url": "https://cdn.somnio.com/promos/2x.jpg",
  "contenido": "[Imagen promocional 2x]",
  "delay_s": 3,
  "orden": 2
}
```

### 5.3 Archivo de Plantillas

Las plantillas se cargan desde:
```
/plantillas/
  ├── conversacion.json    # Intents informativos
  ├── captura.json         # Recolección de datos
  ├── promos.json          # Ofertas y promociones
  └── confirmacion.json    # Cierre de venta
```

---

## 6. INTEGRACIÓN CON CALLBELL

### 6.1 Envío de Mensaje de Texto

```javascript
// POST https://api.callbell.eu/v1/messages
const payload = {
  to: phone,
  from: "whatsapp",
  type: "text",
  content: {
    text: mensaje.contenido
  }
};

const headers = {
  'Authorization': `Bearer ${CALLBELL_API_KEY}`,
  'Content-Type': 'application/json'
};
```

### 6.2 Envío de Mensaje con Imagen

```javascript
// POST https://api.callbell.eu/v1/messages
const payload = {
  to: phone,
  from: "whatsapp",
  type: "image",
  content: {
    url: mensaje.image_url
  }
};
```

### 6.3 Actualización de Tags

```javascript
// PATCH https://api.callbell.eu/v1/contacts/{contact_uuid}
const payload = {
  tags: [...existingTags, "WPP", "RB"]
};
```

---

## 7. PERSISTENCIA DE MENSAJES OUTBOUND

Cada mensaje enviado se persiste en Historial V3 para mantener el historial completo:

```javascript
// POST /webhook/historial-v3-callbell-webhook
const outboundPayload = {
  uuid: `outbound_${Date.now()}`,
  from: BOT_PHONE,
  to: clientPhone,
  text: mensaje.contenido,
  direction: "outbound",
  tags: []
};
```

---

## 8. MANEJO DE ERRORES

### 8.1 Errores Esperados

| Error | Causa | Manejo |
|-------|-------|--------|
| No pending messages | Ya procesado por otra instancia | Log y terminar |
| Tags bloqueados | Cliente en otro flujo | Log y terminar |
| Callbell API error | Rate limit o servicio caído | Retry con backoff |
| Interrupción detectada | Cliente envió mensaje | Terminar loop gracefully |

### 8.2 Retry Configuration

```javascript
const CALLBELL_RETRY = {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
};
```

---

## 9. MÉTRICAS Y LOGGING

### 9.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `carolina_triggered` | phone, intent |
| `templates_selected` | phone, count, intents |
| `message_sent` | phone, tipo, orden |
| `client_interrupted` | phone, version_inicial, version_actual |
| `bot_blocked_by_tags` | phone, tags |
| `wpp_tag_added` | phone, contact_uuid |

### 9.2 Formato de Log

```javascript
{
  timestamp: "2026-01-21T10:30:00.000Z",
  workflow: "carolina_v3",
  event: "message_sent",
  data: {
    phone: "573001234567",
    tipo: "texto",
    orden: 2,
    latency_ms: 150
  }
}
```

---

## 10. CONSIDERACIONES PARA MORFX

### 10.1 Abstracción de Canal

```typescript
interface MessageSender {
  sendText(to: string, content: string): Promise<MessageResult>;
  sendImage(to: string, url: string): Promise<MessageResult>;
  sendTemplate(to: string, templateId: string, vars: Record<string, string>): Promise<MessageResult>;
}

// Implementaciones por canal
class CallbellSender implements MessageSender { ... }
class TelegramSender implements MessageSender { ... }
class WebChatSender implements MessageSender { ... }
```

### 10.2 Sistema de Plantillas Dinámico

```typescript
interface TemplateEngine {
  loadTemplates(tenantId: string): Promise<Template[]>;
  selectByIntent(intent: string, context: ConversationContext): Template[];
  render(template: Template, variables: Record<string, any>): string;
}
```

### 10.3 Hooks de Extensión

```typescript
interface CarolinaHooks {
  beforeSend: (message: OutboundMessage) => Promise<OutboundMessage | null>;
  afterSend: (message: OutboundMessage, result: SendResult) => Promise<void>;
  onInterruption: (context: InterruptionContext) => Promise<void>;
  onComplete: (session: Session, messagesSent: number) => Promise<void>;
}
```

### 10.4 A/B Testing de Respuestas

```typescript
interface ABTestConfig {
  experimentId: string;
  variants: {
    control: Template[];
    variant_a: Template[];
    variant_b: Template[];
  };
  trafficAllocation: Record<string, number>;
}

function selectVariant(userId: string, config: ABTestConfig): string {
  const hash = deterministicHash(userId + config.experimentId);
  return allocateByHash(hash, config.trafficAllocation);
}
```
