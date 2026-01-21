# 03 - STATE ANALYZER

> **Rol:** Cerebro Analítico - Detector de Intenciones
> **Endpoint:** `POST /webhook/state-analyzer`
> **Archivo:** `workflows/03-state-analyzer.json`
> **Modelo IA:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

---

## 1. DESCRIPCIÓN GENERAL

State Analyzer es el **cerebro analítico** del sistema v3DSL. Utiliza Claude AI para analizar el historial de conversación y detectar la intención del usuario, validando transiciones de estado y manteniendo coherencia en el flujo conversacional.

### Responsabilidades Principales
- Recibir historial de conversación y mensajes pendientes
- Normalizar mensajes de landing pages
- Construir contexto para Claude AI
- Detectar intención del usuario
- Validar transiciones de intent según reglas de negocio
- Detectar automáticamente oportunidades de venta
- Sincronizar historial de intents vistos

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            STATE ANALYZER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │ Webhook  │───▶│ Parse       │───▶│ Prepare Claude   │───▶│ Call Claude    │  │
│  │ POST     │    │ Input       │    │ Messages         │    │ API            │  │
│  └──────────┘    └─────────────┘    └──────────────────┘    └───────┬────────┘  │
│                                                                      │           │
│                                                                      ▼           │
│                                                              ┌─────────────┐     │
│                                                              │ Extract     │     │
│                                                              │ Response    │     │
│                                                              └──────┬──────┘     │
│                                                                     │            │
│                                                                     ▼            │
│                                                              ┌─────────────┐     │
│                                                              │ Respond     │     │
│                                                              │ JSON        │     │
│                                                              └─────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook** | `webhook` | Recibe POST en `/state-analyzer` con responseNode |
| 2 | **Parse Input** | `code` | Extrae phone, historial, pending_messages, captured_data, intents_vistos |
| 3 | **Prepare Claude Messages** | `code` | Construye system prompt y mensajes para Claude |
| 4 | **Call Claude API** | `httpRequest` | POST a `api.anthropic.com/v1/messages` |
| 5 | **Extract Response** | `code` | Parsea JSON de Claude, aplica validaciones de negocio |
| 6 | **Respond** | `respondToWebhook` | Retorna resultado JSON |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST https://n8n.automatizacionesmorf.com/webhook/state-analyzer
```

**Headers:**
```
Content-Type: application/json
```

**Payload de Entrada:**
```json
{
  "phone": "573001234567",
  "historial": [
    {
      "role": "user",
      "content": "Hola"
    },
    {
      "role": "assistant",
      "content": "¡Hola! Soy Carolina, tu asesora de Somnio..."
    },
    {
      "role": "user",
      "content": "Cuánto cuesta el producto?"
    }
  ],
  "pending_messages": [
    {
      "role": "user",
      "content": "Cuánto cuesta el producto?"
    }
  ],
  "captured_data": {
    "nombre": "Juan",
    "apellido": null,
    "telefono": "573001234567",
    "direccion": null,
    "barrio": null,
    "ciudad": null,
    "departamento": null,
    "correo": null,
    "_intents_vistos": [
      {"intent": "hola", "orden": 1}
    ],
    "_last_intent": "hola"
  }
}
```

**Payload de Respuesta:**
```json
{
  "success": true,
  "intent": "precio",
  "campos_completos": false,
  "campos_faltantes": ["apellido", "direccion", "barrio", "ciudad", "departamento", "correo"],
  "pack_detectado": null,
  "mode": "conversacion",
  "intents_vistos": [
    {"intent": "hola", "orden": 1},
    {"intent": "precio", "orden": 2}
  ]
}
```

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Catálogo de Intents

#### Intents Informativos (Sin restricciones)

| Intent | Trigger | Descripción |
|--------|---------|-------------|
| `hola` | Saludo inicial | Bienvenida y presentación |
| `precio` | Pregunta de precio | Información de costos |
| `envio` | Pregunta de envío | Tiempos y costos de delivery |
| `modopago` | Pregunta de pago | Métodos aceptados |
| `ingredientes` | Pregunta de composición | Información del producto |
| `funcionamiento` | Cómo funciona | Explicación de uso |
| `testimonios` | Casos de éxito | Evidencia social |
| `garantia` | Política de garantía | Devoluciones |
| `otro` | No clasificable | Fallback informativo |

#### Intents Transaccionales (Con validaciones)

| Intent | Prerequisitos | Descripción |
|--------|---------------|-------------|
| `captura_datos_si_compra` | Ninguno | Usuario indica interés en comprar |
| `ofrecer_promos` | 8 campos completos | Mostrar opciones de pack |
| `resumen_1x` | `ofrecer_promos` visto | Resumen pack 1 unidad |
| `resumen_2x` | `ofrecer_promos` visto | Resumen pack 2 unidades |
| `resumen_3x` | `ofrecer_promos` visto | Resumen pack 3 unidades |
| `compra_confirmada` | `resumen_Xx` visto | Confirmación final |

#### Intents Combinados

| Intent | Componentes |
|--------|-------------|
| `hola+precio` | Saludo + pregunta de precio |
| `hola+captura` | Saludo + interés de compra |
| `precio+captura` | Precio + interés de compra |

### 4.2 Sistema de Validación de Transiciones

```javascript
const TRANSITION_RULES = {
  // Intents que requieren prerequisitos
  'ofrecer_promos': {
    requires: ['campos_completos'],
    validate: (state) => hasAllFields(state)
  },
  'resumen_1x': {
    requires: ['ofrecer_promos'],
    validate: (state) => hasSeenIntent(state, 'ofrecer_promos')
  },
  'resumen_2x': {
    requires: ['ofrecer_promos'],
    validate: (state) => hasSeenIntent(state, 'ofrecer_promos')
  },
  'resumen_3x': {
    requires: ['ofrecer_promos'],
    validate: (state) => hasSeenIntent(state, 'ofrecer_promos')
  },
  'compra_confirmada': {
    requires: ['resumen_1x', 'resumen_2x', 'resumen_3x'],
    validate: (state) => hasSeenAnyIntent(state, ['resumen_1x', 'resumen_2x', 'resumen_3x'])
  }
};

function validateTransition(intent, state) {
  const rule = TRANSITION_RULES[intent];
  if (!rule) return true; // Sin regla = permitido

  if (!rule.validate(state)) {
    return false; // Transición bloqueada
  }
  return true;
}
```

### 4.3 Auto-Detección de Intents

```javascript
// Auto-detectar ofrecer_promos cuando datos completos
function autoDetectIntent(state, detectedIntent) {
  const REQUIRED_FIELDS = [
    'nombre', 'apellido', 'telefono', 'direccion',
    'barrio', 'ciudad', 'departamento', 'correo'
  ];

  const camposCompletos = REQUIRED_FIELDS.every(f =>
    state[f] && state[f].trim() !== ''
  );

  // Si datos completos Y no hemos ofrecido promos
  if (camposCompletos && !hasSeenIntent(state, 'ofrecer_promos')) {
    return 'ofrecer_promos';
  }

  return detectedIntent;
}

// Auto-detectar pack cuando usuario menciona cantidad
function autoDetectPack(message) {
  const packPatterns = {
    '1x': /\b(uno|1|una unidad|el primero)\b/i,
    '2x': /\b(dos|2|el segundo|pack.*2)\b/i,
    '3x': /\b(tres|3|el tercero|pack.*3)\b/i
  };

  for (const [pack, pattern] of Object.entries(packPatterns)) {
    if (pattern.test(message)) {
      return pack;
    }
  }
  return null;
}
```

### 4.4 Normalización de Mensajes de Landing

```javascript
// Mensajes de landing pages llegan con formato específico
const LANDING_PATTERN = /^Hola[,.]?\s*(me\s+interesa|quiero)\s+(comprar|saber|información)/i;

function normalizeLandingMessage(message) {
  if (LANDING_PATTERN.test(message)) {
    return 'hola'; // Normalizar a saludo simple
  }
  return message;
}
```

### 4.5 Desambiguación Contextual

```javascript
// "Sí" puede significar muchas cosas según contexto
function disambiguateResponse(message, lastAssistantMessage) {
  const affirmatives = ['sí', 'si', 'ok', 'dale', 'bueno', 'claro'];

  if (!affirmatives.some(a => message.toLowerCase().includes(a))) {
    return null; // No es afirmación
  }

  // Analizar último mensaje del asistente
  if (lastAssistantMessage.includes('¿Deseas comprar?')) {
    return 'captura_datos_si_compra';
  }
  if (lastAssistantMessage.includes('¿Cuál pack te interesa?')) {
    return 'seleccion_pack'; // Necesita más contexto
  }
  if (lastAssistantMessage.includes('¿Confirmas tu pedido?')) {
    return 'compra_confirmada';
  }

  return null;
}
```

---

## 5. INTEGRACIÓN CON CLAUDE API

### 5.1 Configuración de la Llamada

```javascript
const CLAUDE_CONFIG = {
  url: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  timeout: 30000,
  headers: {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  }
};
```

### 5.2 System Prompt

```javascript
const SYSTEM_PROMPT = `
Eres un analizador de intenciones para un chatbot de ventas de "Elixir del Sueño" (Somnio).

Tu ÚNICA tarea es analizar el último mensaje del usuario y determinar su intención.

## INTENTS PERMITIDOS

### Informativos (sin restricciones):
- hola: Saludo o inicio de conversación
- precio: Pregunta sobre costos
- envio: Pregunta sobre entrega/shipping
- modopago: Pregunta sobre métodos de pago
- ingredientes: Pregunta sobre composición
- funcionamiento: Pregunta sobre cómo usar/funciona
- testimonios: Pregunta sobre experiencias de otros
- garantia: Pregunta sobre devoluciones/garantía
- otro: Cualquier otra consulta informativa

### Transaccionales (requieren validación):
- captura_datos_si_compra: Usuario expresa interés en comprar
- ofrecer_promos: Usuario tiene datos completos, mostrar packs
- resumen_1x: Usuario elige pack de 1 unidad ($77,900)
- resumen_2x: Usuario elige pack de 2 unidades ($109,900)
- resumen_3x: Usuario elige pack de 3 unidades ($139,900)
- compra_confirmada: Usuario confirma su pedido

### Combinados:
- hola+precio: Saludo con pregunta de precio
- hola+captura: Saludo con interés de compra

## DATOS DEL CLIENTE ACTUAL
{{captured_data}}

## CAMPOS REQUERIDOS (8 total):
nombre, apellido, telefono, direccion, barrio, ciudad, departamento, correo

## INTENTS YA VISTOS EN ESTA CONVERSACIÓN:
{{intents_vistos}}

## REGLAS DE VALIDACIÓN

1. "ofrecer_promos" SOLO si los 8 campos están completos
2. "resumen_Xx" SOLO si "ofrecer_promos" ya fue visto
3. "compra_confirmada" SOLO si algún "resumen_Xx" ya fue visto

Si el intent detectado no cumple las reglas, usa "fallback" con una explicación.

## RESPUESTA

Responde ÚNICAMENTE con JSON válido:
{
  "intent": "nombre_del_intent",
  "confidence": 0.95,
  "pack_detectado": null | "1x" | "2x" | "3x",
  "reasoning": "Explicación breve"
}
`;
```

### 5.3 Construcción de Mensajes

```javascript
function buildClaudeMessages(historial, pendingMessages, lastAssistantMessage) {
  const messages = [];

  // Agregar contexto del último mensaje del asistente
  if (lastAssistantMessage) {
    messages.push({
      role: 'user',
      content: `CONTEXTO: El último mensaje del asistente fue: "${lastAssistantMessage}"`
    });
  }

  // Agregar historial resumido
  const historicoResumido = historial.slice(-10).map(m =>
    `${m.role}: ${m.content}`
  ).join('\n');

  messages.push({
    role: 'user',
    content: `HISTORIAL RECIENTE:\n${historicoResumido}`
  });

  // Agregar mensajes pendientes (los que hay que analizar)
  const pendingText = pendingMessages.map(m => m.content).join('\n');
  messages.push({
    role: 'user',
    content: `MENSAJES A ANALIZAR:\n${pendingText}\n\nDetecta la intención principal.`
  });

  return messages;
}
```

---

## 6. PROCESAMIENTO DE RESPUESTA

### 6.1 Extracción y Validación

```javascript
function extractAndValidate(claudeResponse, state) {
  // 1. Parsear JSON de Claude
  let parsed;
  try {
    const text = claudeResponse.content[0].text;
    // Limpiar markdown si existe
    const cleaned = text.replace(/```json\n?|\n?```/g, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { intent: 'otro', error: 'parse_failed' };
  }

  // 2. Validar transición
  if (!validateTransition(parsed.intent, state)) {
    return {
      intent: 'fallback',
      original_intent: parsed.intent,
      reason: 'transition_blocked'
    };
  }

  // 3. Auto-detectar ofrecer_promos si aplica
  const finalIntent = autoDetectIntent(state, parsed.intent);

  // 4. Registrar en intents_vistos
  const updatedIntents = registerIntent(state._intents_vistos || [], finalIntent);

  // 5. Calcular campos
  const camposCompletos = checkFieldsComplete(state);
  const camposFaltantes = getMissingFields(state);

  return {
    success: true,
    intent: finalIntent,
    campos_completos: camposCompletos,
    campos_faltantes: camposFaltantes,
    pack_detectado: parsed.pack_detectado,
    mode: determineMode(finalIntent, camposCompletos),
    intents_vistos: updatedIntents
  };
}
```

### 6.2 Determinación de Modo

```javascript
function determineMode(intent, camposCompletos) {
  const COLLECTING_INTENTS = [
    'captura_datos_si_compra',
    'hola+captura'
  ];

  if (COLLECTING_INTENTS.includes(intent) && !camposCompletos) {
    return 'collecting_data';
  }

  return 'conversacion';
}
```

### 6.3 Registro de Intents

```javascript
function registerIntent(intentsVistos, newIntent) {
  // Evitar duplicados
  if (intentsVistos.some(i => i.intent === newIntent)) {
    return intentsVistos;
  }

  const nextOrden = intentsVistos.length + 1;
  return [
    ...intentsVistos,
    { intent: newIntent, orden: nextOrden }
  ];
}
```

---

## 7. CAMPOS Y VALIDACIONES

### 7.1 Campos Requeridos

| Campo | Tipo | Obligatorio | Ejemplo |
|-------|------|-------------|---------|
| `nombre` | string | Sí | "Juan" |
| `apellido` | string | Sí | "Pérez" |
| `telefono` | string | Sí | "573001234567" |
| `direccion` | string | Sí | "Calle 123 #45-67" |
| `barrio` | string | Tolerado vacío | "Centro" |
| `ciudad` | string | Sí | "Bogotá" |
| `departamento` | string | Sí | "Cundinamarca" |
| `correo` | string | Tolerado vacío | "juan@email.com" |

### 7.2 Precios de Packs

| Pack | Precio COP | Descripción |
|------|------------|-------------|
| `1x` | $77,900 | 1 unidad |
| `2x` | $109,900 | 2 unidades |
| `3x` | $139,900 | 3 unidades |

---

## 8. MANEJO DE ERRORES

### 8.1 Errores Esperados

| Error | Causa | Manejo |
|-------|-------|--------|
| Claude timeout | API lenta >30s | Retornar intent "otro" |
| Parse failed | Respuesta malformada | Retornar intent "otro" |
| Transition blocked | Prerequisito no cumplido | Retornar "fallback" |

### 8.2 Fallback Strategy

```javascript
const FALLBACK_RESPONSE = {
  success: true,
  intent: 'otro',
  campos_completos: false,
  campos_faltantes: ['desconocido'],
  pack_detectado: null,
  mode: 'conversacion',
  intents_vistos: []
};
```

---

## 9. MÉTRICAS Y LOGGING

### 9.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `analysis_started` | phone, pending_count |
| `claude_request` | model, tokens_estimated |
| `claude_response` | latency_ms, tokens_used |
| `intent_detected` | phone, intent, confidence |
| `transition_blocked` | phone, intent, reason |
| `auto_detection` | phone, original, detected |

---

## 10. CONSIDERACIONES PARA MORFX

### 10.1 Abstracción del Modelo

```typescript
interface IntentAnalyzer {
  analyze(context: AnalysisContext): Promise<AnalysisResult>;
}

interface AnalysisContext {
  history: Message[];
  pending: Message[];
  state: ConversationState;
  tenant: TenantConfig;
}

interface AnalysisResult {
  intent: string;
  confidence: number;
  metadata: Record<string, any>;
}

// Implementaciones
class ClaudeAnalyzer implements IntentAnalyzer { ... }
class OpenAIAnalyzer implements IntentAnalyzer { ... }
class RuleBasedAnalyzer implements IntentAnalyzer { ... }
```

### 10.2 Sistema de Reglas Configurable

```typescript
interface TransitionRule {
  intent: string;
  requires: string[];
  condition: (state: State) => boolean;
  fallback: string;
}

interface TenantIntentConfig {
  informationalIntents: Intent[];
  transactionalIntents: Intent[];
  combinedIntents: Intent[];
  transitionRules: TransitionRule[];
  autoDetectionRules: AutoDetectionRule[];
}
```

### 10.3 Prompt Templates por Tenant

```typescript
interface PromptTemplate {
  tenantId: string;
  productName: string;
  productDescription: string;
  allowedIntents: string[];
  customRules: string;
  responseFormat: string;
}

function buildSystemPrompt(template: PromptTemplate, state: State): string {
  return `
    Eres un analizador de intenciones para ${template.productName}.
    ${template.productDescription}

    Intents permitidos: ${template.allowedIntents.join(', ')}

    ${template.customRules}

    Responde en formato: ${template.responseFormat}
  `;
}
```

### 10.4 Caché de Intents Frecuentes

```typescript
interface IntentCache {
  get(messageHash: string): CachedIntent | null;
  set(messageHash: string, result: AnalysisResult, ttl: number): void;
  invalidate(pattern: string): void;
}

// Mensajes comunes pueden cachearse
const CACHEABLE_PATTERNS = [
  'hola',
  'precio',
  'cuanto cuesta',
  'envio gratis'
];
```
