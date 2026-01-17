# State Analyzer - Documentación Técnica

## 📋 Resumen
**Workflow:** State Analyzer
**Función Principal:** Detector de intenciones del usuario usando Claude API
**Tipo:** Analizador LLM + Validador de flujo
**Endpoints:** `/webhook/state-analyzer`

## 🎯 Propósito

El State Analyzer es el **cerebro analítico** del sistema. Usa Claude Sonnet 4.5 para analizar el historial completo de la conversación y detectar qué quiere el cliente (intent), aplicando validaciones de flujo para asegurar que los intents transaccionales solo se activen en el momento correcto.

## 🔄 Flujo de Procesamiento

### 1. Recepción de Request
```
Webhook → Parse Input
```

**Input esperado:**
```json
{
  "phone": "57...",
  "historial": [
    {"id": 1, "role": "user", "content": "hola", "direction": "inbound"},
    {"id": 2, "role": "assistant", "content": "¡Hola!...", "direction": "outbound"}
  ],
  "pending_messages": [
    {"id": 3, "role": "user", "content": "cuánto cuesta?", "direction": "inbound"}
  ],
  "captured_data": {
    "nombre": "Juan",
    "_last_intent": "hola",
    "_intents_vistos": ["hola"]
  },
  "intents_vistos": ["hola"]
}
```

### 2. Preparación de Mensajes para Claude
```
Parse Input → Prepare Claude Messages
```

**System Prompt (Simplificado):**
```
Eres un analizador de intents para Somnio (producto: Elixir del Sueño).
Tu tarea es SOLO detectar el intent y extraer datos del mensaje. NO generes respuestas.

Analiza el historial completo, prestando especial atención a los mensajes pendientes.

Retorna JSON:
{
  "intent": "string",
  "extracted_data": {},
  "campos_completos": false,
  "pack_detectado": null
}

**Intents permitidos:**
- hola, precio, info_promociones, contenido_envase, como_se_toma
- modopago, envio, invima, ubicacion, contraindicaciones
- captura_datos_si_compra, ofrecer_promos
- resumen_1x/2x/3x, compra_confirmada, no_confirmado
- no_interesa, fallback

**Intents combinados:**
- hola+precio, hola+como_se_toma, hola+envio, hola+modopago
- hola+captura_datos_si_compra
```

**Normalización de mensajes de landing page:**
```javascript
const landingPagePattern = /ho?la!?\\s*me\\s*inte?re?sa\\s*comprar\\s*u?n?\\s*(elixir|elxir)?/gi;
msg.content.replace(landingPagePattern, 'hola ');
```
**Razón:** Landing page envía "Hola me interesa comprar un elixir del sueño" que debe tratarse como simple "hola".

**Focus en mensajes pendientes:**
```javascript
if (pendingMessages.length > 0) {
  const pendingList = pendingMessages.map((m, i) =>
    (i+1) + '. "' + m.content + '"'
  ).join('\\n');

  focusMessage = `
MENSAJES PENDIENTES (los mas recientes que necesitas analizar):
${pendingList}

IMPORTANTE: Analiza PRINCIPALMENTE los mensajes pendientes para detectar el intent actual.
  `;
}
```

**Contexto para "si/ok/dale":**
```javascript
// Detectar último mensaje del asistente
let lastAssistantMessage = '';
for (let i = historial.length - 1; i >= 0; i--) {
  if (historial[i].role === 'assistant') {
    lastAssistantMessage = historial[i].content.toLowerCase();
    break;
  }
}

// Contexto según pregunta anterior
if (lastAssistantMessage.includes('confirmar tu compra')) {
  contextoSi = 'Si el usuario dice "si/ok/dale" → intent: compra_confirmada';
} else if (lastAssistantMessage.includes('deseas adquirir')) {
  contextoSi = 'Si el usuario dice "si/ok/dale" → intent: captura_datos_si_compra';
} else if (lastAssistantMessage.includes('cual eliges')) {
  contextoSi = 'Si el usuario dice "1x/2x/3x/uno/dos/tres" → detectar pack';
}
```

### 3. Llamada a Claude API
```
Prepare Messages → Call Claude API
```

**Configuración:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "...",
  "messages": [...]
}
```

**API:**
- POST `https://api.anthropic.com/v1/messages`
- Header: `anthropic-version: 2023-06-01`
- Auth: `anthropic-api-account` credential
- Timeout: 30 segundos

### 4. Extracción y Validación de Respuesta
```
Call Claude API → Extract Response
```

**Extract Response realiza:**

1. **Parse JSON de Claude:**
```javascript
let cleanText = responseText.trim();
if (cleanText.startsWith('```json')) {
  cleanText = cleanText.replace(/^```json\\s*/, '').replace(/\\s*```$/, '');
}

const parsed = JSON.parse(cleanText);
let intent = parsed.intent || 'fallback';
let extractedData = parsed.extracted_data || {};
let packDetectado = parsed.pack_detectado;
```

2. **🔥 SINCRONIZAR _last_intent:**
```javascript
// Si el último intent ejecutado por Carolina no está en la lista, agregarlo
if (prevData.captured_data._last_intent &&
    !intentsVistos.includes(prevData.captured_data._last_intent)) {
  intentsVistos.push(prevData.captured_data._last_intent);
  capturedData._intents_vistos = intentsVistos;
}
```
**Razón:** Carolina ejecuta `ofrecer_promos` automáticamente cuando campos completos, pero no siempre se registra en intents_vistos. Esta sync lo corrige.

3. **Merge extracted_data:**
```javascript
for (const key in extractedData) {
  if (extractedData[key] && extractedData[key].toString().trim() !== '') {
    capturedData[key] = extractedData[key];
  }
}
```

4. **Verificar campos completos:**
```javascript
const requiredFields = ['nombre', 'apellido', 'telefono', 'direccion',
                        'barrio', 'departamento', 'ciudad', 'correo'];
const allFieldsComplete = requiredFields.every(field =>
  capturedData[field] && String(capturedData[field]).trim() !== ''
);
```

5. **🔒 VALIDACIONES DE INTENTS (Condicionales):**

#### Helper functions:
```javascript
const hasSeenIntent = (intentName) =>
  intentsVistos.includes(intentName) ||
  prevData.captured_data._last_intent === intentName;

const hasSeenAnyIntent = (intentNames) =>
  intentNames.some(name => intentsVistos.includes(name) ||
    prevData.captured_data._last_intent === name);
```

#### 1️⃣ ofrecer_promos
```javascript
if (intent === 'ofrecer_promos') {
  if (!allFieldsComplete) {
    console.log('❌ BLOQUEADO: ofrecer_promos requiere todos los campos completos');
    intent = 'fallback';
  } else {
    console.log('✅ PERMITIDO: ofrecer_promos (campos completos)');
  }
}
```

#### 2️⃣ resumen_1x/2x/3x
```javascript
if (intent.startsWith('resumen_')) {
  if (!hasSeenIntent('ofrecer_promos')) {
    console.log('❌ BLOQUEADO: resumen requiere que se hayan ofrecido promos primero');
    intent = 'fallback';
  } else {
    console.log('✅ PERMITIDO: resumen (ya se ofrecieron promos)');
  }
}
```

#### 3️⃣ compra_confirmada
```javascript
if (intent === 'compra_confirmada') {
  const hasSeenResumen = hasSeenAnyIntent(['resumen_1x', 'resumen_2x', 'resumen_3x']);

  if (!hasSeenResumen) {
    console.log('❌ BLOQUEADO: compra_confirmada requiere resumen_Xx primero');
    intent = 'fallback';
  } else {
    console.log('✅ PERMITIDO: compra_confirmada (ya se mostró resumen)');
  }
}
```

#### 4️⃣ no_confirmado
```javascript
if (intent === 'no_confirmado') {
  const hasSeenResumen = hasSeenAnyIntent(['resumen_1x', 'resumen_2x', 'resumen_3x']);

  if (!hasSeenResumen) {
    console.log('❌ BLOQUEADO: no_confirmado requiere resumen_Xx primero');
    intent = 'fallback';
  } else {
    console.log('✅ PERMITIDO: no_confirmado (ya se mostró resumen)');
  }
}
```

6. **🤖 AUTO-DETECCIÓN:**

#### Auto-detect: ofrecer_promos
```javascript
if (allFieldsComplete && !packDetectado && !capturedData.pack &&
    intent !== 'ofrecer_promos') {
  if (intent === 'fallback' || intent === 'captura_datos_si_compra') {
    intent = 'ofrecer_promos';
    console.log('🤖 AUTO-DETECT: Activando ofrecer_promos (datos completos)');

    // 🔥 FIX CRITICO: Agregar inmediatamente a intents_vistos
    if (!intentsVistos.includes('ofrecer_promos')) {
      intentsVistos.push('ofrecer_promos');
      capturedData._intents_vistos = intentsVistos;
      console.log('✅ AUTO-DETECT: ofrecer_promos agregado a intents_vistos INMEDIATAMENTE');
    }
  }
}
```

#### Auto-detect: resumen_Xx (pack seleccionado)
```javascript
if (packDetectado) {
  if (hasSeenIntent('ofrecer_promos')) {
    intent = `resumen_${packDetectado}`;
    capturedData.pack = packDetectado;

    const precios = { '1x': 77900, '2x': 109900, '3x': 139900 };
    capturedData.precio = precios[packDetectado];

    console.log('🤖 AUTO-DETECT: Activando resumen_' + packDetectado);
  } else {
    console.log('❌ BLOQUEADO: No se puede activar resumen sin ofrecer_promos primero');
    intent = 'fallback';
  }
}
```

7. **Activar collecting_data mode:**
```javascript
let newMode = null;  // null = no cambiar

if (intent === 'captura_datos_si_compra' ||
    intent === 'hola+captura_datos_si_compra' ||
    intent.startsWith('resumen_')) {
  newMode = 'collecting_data';
}
```

8. **Registrar intent visto:**
```javascript
if (intent && intent !== 'fallback' && !intentsVistos.includes(intent)) {
  intentsVistos.push(intent);
  capturedData._intents_vistos = intentsVistos;
}
```

### 5. Respuesta
```
Extract Response → Respond
```

**Response:**
```json
{
  "phone": "57...",
  "intent": "precio",
  "new_mode": "collecting_data" | null,
  "extracted_data": {"nombre": "Juan"},
  "captured_data": {
    "nombre": "Juan",
    "_last_intent": "precio",
    "_intents_vistos": ["hola", "precio"]
  },
  "campos_completos": false,
  "pack_detectado": null,
  "all_fields_complete": false
}
```

## 🎯 Intents y Su Lógica

### Informativos (sin restricciones)
- `hola` - Saludo
- `precio` - Precio del producto
- `info_promociones` - Info de paquetes
- `contenido_envase` - Cantidad de cápsulas
- `como_se_toma` - Modo de uso
- `modopago` - Formas de pago
- `envio` - Cobertura
- `invima` - Registro sanitario
- `ubicacion` - Tienda física
- `contraindicaciones` - Efectos secundarios
- `fallback` - No entendido

### Combinados
- `hola+precio`
- `hola+como_se_toma`
- `hola+envio`
- `hola+modopago`
- `hola+captura_datos_si_compra`

### Transaccionales (con validaciones)

#### Nivel 1: Captura
- `captura_datos_si_compra` - Cliente quiere comprar
  - **Sin restricciones**
  - Activa `mode: collecting_data`

#### Nivel 2: Ofrecer Promos
- `ofrecer_promos` - Mostrar paquetes 1x/2x/3x
  - **Requiere:** 8 campos completos
  - **Auto-activado** cuando campos completos

#### Nivel 3: Resumen
- `resumen_1x` / `resumen_2x` / `resumen_3x` - Confirmación de pack
  - **Requiere:** `ofrecer_promos` visto
  - **Auto-activado** cuando pack detectado

#### Nivel 4: Confirmación Final
- `compra_confirmada` - Cliente dice "sí" después de resumen
  - **Requiere:** Algún `resumen_Xx` visto
- `no_confirmado` - Cliente dice "no"
  - **Requiere:** Algún `resumen_Xx` visto
- `no_interesa` - Cliente rechaza
  - **Sin restricciones**

## 🔍 Casos de Uso

### Caso 1: Saludo Simple
```
Input:
  historial: [{"role": "user", "content": "hola"}]
  pending: [{"content": "hola"}]

Claude detecta: "hola"
Validación: ✅ Sin restricciones
Output: {intent: "hola"}
```

### Caso 2: Cliente Completa Datos
```
Input:
  historial: [
    {"role": "user", "content": "Juan Perez"},
    {"role": "user", "content": "Calle 123, Bogotá"}
  ]
  captured_data: {nombre: "Juan", apellido: "Perez", ...}  // 8 campos completos

Claude detecta: "captura_datos_si_compra" o "fallback"
AUTO-DETECT: ✅ Campos completos → Cambia a "ofrecer_promos"
Output: {intent: "ofrecer_promos"}
```

### Caso 3: Cliente Elige Pack (Prematuro)
```
Input:
  pending: [{"content": "quiero el 2x"}]
  captured_data: {pack: null}
  intents_vistos: ["hola", "precio"]  // ⚠️ Sin "ofrecer_promos"

Claude detecta: pack_detectado: "2x"
AUTO-DETECT: intent = "resumen_2x"
Validación: ❌ "ofrecer_promos" no visto → Cambia a "fallback"
Output: {intent: "fallback"}
```

### Caso 4: Cliente Elige Pack (Correcto)
```
Input:
  pending: [{"content": "el 2x"}]
  intents_vistos: ["hola", "ofrecer_promos"]

Claude detecta: pack_detectado: "2x"
AUTO-DETECT: intent = "resumen_2x"
Validación: ✅ "ofrecer_promos" visto
Output: {intent: "resumen_2x", pack_detectado: "2x"}
```

### Caso 5: Confirmación Prematura
```
Input:
  pending: [{"content": "sí, quiero"}]
  lastAssistantMessage: "¿Deseas adquirir el Elixir?"
  intents_vistos: ["hola"]  // ⚠️ Sin resumen

Claude detecta: "compra_confirmada" (por contexto "confirmar")
Validación: ❌ Sin resumen_Xx → Cambia a "fallback"
Output: {intent: "fallback"}
```

### Caso 6: Confirmación Correcta
```
Input:
  pending: [{"content": "sí"}]
  lastAssistantMessage: "¿Confirmas tu compra de 2x?"
  intents_vistos: ["ofrecer_promos", "resumen_2x"]

Claude detecta: "compra_confirmada"
Validación: ✅ "resumen_2x" visto
Output: {intent: "compra_confirmada"}
```

## 📊 Flujo de Intents Válido

```
1. hola
    ↓
2. captura_datos_si_compra (Cliente: "quiero comprar")
    ↓ (Usuario proporciona datos)
3. [AUTO] ofrecer_promos (Cuando 8 campos completos)
    ↓ (Cliente: "el 2x")
4. [AUTO] resumen_2x (Pack detectado)
    ↓ (Cliente: "sí")
5. compra_confirmada
    ↓ (Order Manager crea pedido)
```

## ⚙️ Configuración

### Claude API
- **Model:** `claude-sonnet-4-20250514`
- **Max Tokens:** 1024
- **Temperature:** Default (1.0)
- **Timeout:** 30 segundos

### Credenciales n8n
- **Anthropic API:** `anthropic-api-account`

## 📈 Métricas y Logs

### Console Logs Principales
- `📊 CONDICIONALES - Estado actual` - Estado antes de validar
- `❌ BLOQUEADO: ...` - Intent bloqueado por validación
- `✅ PERMITIDO: ...` - Intent permitido
- `🤖 AUTO-DETECT: ...` - Intent auto-detectado
- `🔄 SINCRONIZADO: ...` - Intent sincronizado desde _last_intent
- `📋 Intents vistos actualizados` - Lista actualizada

## 🚨 Errores Comunes

### Error: "Intent bloqueado prematuramente"
**Causa:** Cliente intenta saltar pasos del flujo
**Solución:** Validaciones lo evitan, retorna "fallback"

### Error: "ofrecer_promos no se registra"
**Causa:** Auto-detect no agregaba a intents_vistos
**Solución:** FIX aplicado, ahora se agrega inmediatamente

### Error: "Claude API timeout"
**Causa:** API lenta o caída
**Solución:** Retry automático o manual

## 🔗 Dependencias

**State Analyzer depende de:**
- Claude API (Anthropic)
- Historial v3 (llamado por)

**Workflows que dependen de State Analyzer:**
- Historial v3 (llama para análisis)
- Data Extractor (trabaja en conjunto)

## 📝 Notas Importantes

1. **No decide qué responder:** Solo detecta intent
2. **Validaciones estrictas:** Evita saltos de flujo
3. **Auto-detección inteligente:** ofrecer_promos y resumen_Xx
4. **Context-aware:** Usa último mensaje del bot para entender "sí/no"
5. **Sync con Carolina:** Registra intents ejecutados por Carolina
6. **Mode transitions:** Activa collecting_data cuando necesario
7. **Pack prices:** Guarda precio según pack detectado
