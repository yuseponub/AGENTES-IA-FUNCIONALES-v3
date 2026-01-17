# Carolina v3 - Documentación Técnica

## 📋 Resumen
**Workflow:** Agente Carolina v3 - DSL
**Función Principal:** Generador y enviador de respuestas al usuario
**Tipo:** Procesador de respuestas + Orquestador de envío
**Endpoints:** `/webhook/carolina-v3-process`

## 🎯 Propósito

Carolina v3 es el **agente de respuestas** del sistema. Recibe el trigger desde Historial v3, obtiene el snapshot actualizado de la conversación, selecciona los templates apropiados según el intent detectado, y los envía a Callbell con delays controlados y prevención de interrupciones.

## 🔄 Flujo de Procesamiento

### 1. Trigger y Obtención de Snapshot
```
Webhook Trigger → Respond Immediately → Parse Trigger → Get Snapshot
```

**Webhook Trigger:**
- **Endpoint:** `POST /webhook/carolina-v3-process`
- **Body:** `{phone: "57..."}`
- **Llamado por:** Historial v3

**Parse Trigger:**
```javascript
const phone = $json.body?.phone || $json.phone || '';
if (!phone) throw new Error('Phone parameter required');
return { phone };
```

**Get Snapshot:**
- **GET** `https://n8n.automatizacionesmorf.com/webhook/historial-v3-snapshot?phone={{phone}}`
- Retorna snapshot completo:
```json
{
  "session_id": "session_...",
  "phone": "57...",
  "contact_id": "...",
  "state": {...},
  "mode": "conversacion",
  "tags": ["..."],
  "messages": [...],
  "pending": [...],
  "pending_count": 2,
  "version": "42"
}
```

### 2. Validaciones Iniciales

#### Check Pending > 0
```
IF pending_count > 0 → Continúa
ELSE → Log No Pending (termina)
```

**Razón:** Solo procesa si hay mensajes pendientes sin responder.

#### Check Tags (Bot Bloqueado?)
```
IF tags incluyen ['WPP', 'P/W', 'bot_off', 'RECO'] → Log Bot Disabled (termina)
ELSE → Continúa
```

**Tags bloqueados:**
- `WPP`: Cliente ya procesado/pedido creado
- `P/W`: Cliente en proceso web
- `bot_off`: Bot deshabilitado manualmente
- `RECO`: Cliente en remarketing

### 3. Extracción de Intent y Datos
```
Extract Intent from State
```

**Extract Intent from State:**
- **NO USA CLAUDE** (ya fue detectado por State Analyzer)
- Lee directamente del `state`:
```javascript
const intent = state._last_intent || 'fallback';
const intentsVistos = state._intents_vistos || [];
const packDetectado = state.pack || null;
const camposCompletos = state._campos_completos || false;
```

- Detecta templates ya enviados:
```javascript
const botMessages = messages.filter(m => m.role === 'assistant');
const templatesSent = botMessages.map(m => ({
  content: m.content,
  preview: m.content.substring(0, 100)
}));
```

### 4. Selección de Templates
```
Wait1 (6s) → Select Templates
```

**Select Templates:**

Lectura de configuración:
- `/files/plantillas/mensajes.json` - Plantillas de texto
- `/files/plantillas/intents.json` - Mapping intent → plantillas

**Lógica de selección:**

1. **Determina si es primera vez:**
```javascript
const esPrimeraVez = !intentsVistos.includes(intent);
```

2. **Busca configuración del intent:**
```javascript
let intentConfig = intentsConfig.intents[intent] ||
                   intentsConfig.intents_combinados[intent] ||
                   mensajesConfig.combinaciones_intents[intent];
```

3. **Obtiene plantillas keys:**
```javascript
plantillasKeys = esPrimeraVez
  ? intentConfig.respuesta.primera_vez
  : intentConfig.respuesta.siguientes || intentConfig.respuesta.primera_vez;
```

4. **🆕 FILTRAR templates ya enviados:**
```javascript
const plantillasFiltradas = plantillasKeys.filter(key => {
  const plantilla = mensajesConfig.plantillas_base[key] ||
                    mensajesConfig.plantillas_callbell[key];
  const textoPlantilla = plantilla.texto || plantilla.texto_alternativo;
  const primeros100 = textoPlantilla.substring(0, 100);

  // Verificar si ya se envió
  const yaEnviado = templatesSent.some(sent =>
    sent.preview.includes(primeros100.substring(0, 50)) ||
    primeros100.substring(0, 50).includes(sent.preview.substring(0, 50))
  );

  return !yaEnviado;
});
```

5. **Construye mensajes:**
```javascript
mensajes.forEach(key => {
  if (key.startsWith('/plantilla_')) {
    // Template de Callbell (imagen con botones)
    mensajes.push({
      tipo: 'template',
      template_name: plantilla.template_name,
      template_uuid: plantilla.template_uuid,
      texto_alternativo: plantilla.texto_alternativo,
      delay_s: plantilla.delay_s || 2
    });
  } else if (key.startsWith('/')) {
    // Texto simple
    mensajes.push({
      tipo: 'texto',
      texto: plantilla.texto,
      delay_s: plantilla.delay_s || 2
    });
  }
});
```

6. **Reemplaza variables (para resumen_Xx):**
```javascript
if (intent.startsWith('resumen_')) {
  msg.texto = msg.texto
    .replace(/\{\{nombre\}\}/g, nombre)
    .replace(/\{\{pack\}\}/g, pack)
    .replace(/\{\{precio\}\}/g, precio.toLocaleString('es-CO'))
    .replace(/\{\{direccion\}\}/g, direccion)
    // etc...
}
```

7. **Forzar delay 0 en el primer mensaje:**
```javascript
if (mensajes.length > 0) {
  mensajes[0].delay_s = 0;
}
```

### 5. Acción Especial: Confirmación de Compra
```
Is Confirmation? (intent === 'compra_confirmada')
  └─ TRUE → HTTP: Add WPP Tag
```

**HTTP: Add WPP Tag:**
- PATCH a Callbell para agregar tag "WPP"
- Indica que el cliente ya confirmó la compra
- Esto hace que Historial v3 bloquee futuros mensajes automáticos

### 6. Loop de Envío con Prevención de Interrupciones
```
Split Messages for Loop → Loop Over Items
  └─ Para cada mensaje:
       Wait (delay_s) → Pre-check Version → Compare Versions → Should Send?
         ├─ TRUE → Text or Template?
         │           ├─ Texto → Send to Callbell
         │           └─ Template → Prepare Template → Send Template to Callbell
         │  → Prepare Outbound Message → Save Outbound to Historial → Log Success
         └─ FALSE (interrupted) → Log Interrupted (termina)
```

**Split Messages for Loop:**
```javascript
const items = mensajes.map((mensaje, idx) => ({
  mensaje,
  msg_index: idx,
  total: mensajes.length,
  session_id,
  phone,
  captured_data,
  intent,
  version_inicial: versionInicial  // ⚡ CLAVE para detectar interrupciones
}));
```

**Loop Over Items:**
- Tipo: `splitInBatches` (procesa uno a uno)
- Después de cada mensaje exitoso → vuelve al loop

**Wait:**
- Espera `delay_s` segundos antes de enviar
- **PRIMER mensaje: delay 0 (inmediato)**
- Resto: 2-6 segundos (según plantilla)

**Pre-check Version:**
- GET al snapshot nuevamente: `https://n8n.automatizacionesmorf.com/webhook/historial-v3-snapshot?phone={{phone}}`
- Obtiene `version` actual de la sesión

**Compare Versions:**
```javascript
const versionInicial = loopData.version_inicial || "0";
const versionActual = preCheckSnapshot.version || "0";
const pendingCountActual = preCheckSnapshot.pending_count || 0;

if (versionActual !== versionInicial && pendingCountActual > 0) {
  // Cliente envió nuevo mensaje → INTERRUMPIR cadena
  return {
    should_continue: false,
    reason: 'interrupted'
  };
} else {
  return {
    should_continue: true
  };
}
```

**Prevención de interrupciones:**
- Si el cliente escribe mientras el bot está enviando una cadena de mensajes
- El snapshot aumenta su `version` y `pending_count`
- Carolina detecta esto y **ABORTA** los mensajes restantes
- Historial v3 procesa el nuevo mensaje del cliente
- Carolina se vuelve a ejecutar con el contexto actualizado

### 7. Envío a Callbell

#### Texto Simple
```
Send to Callbell → Prepare Outbound Message → Save Outbound to Historial
```

**Send to Callbell:**
```json
POST https://api.callbell.eu/v1/messages/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "57...",
  "from": "whatsapp",
  "type": "text",
  "content": {
    "text": "..."
  }
}
```

#### Template (Imagen con botones)
```
Prepare Template Message → Send Template to Callbell → Prepare Outbound Message (Template)
```

**Prepare Template Message:**
```javascript
const templateImages = {
  'e356a05a9a1046c9bd1b5a84b467a496': 'https://somniocolombia.com/cdn/shop/files/Diseno_sin_titulo_17_1920x1920.jpg',
  '06cf7d5b74c9430493c30f4ae799603a': 'https://static.callbell.eu/uploads/...'
};

return {
  callbell_body: {
    to: phone,
    from: 'whatsapp',
    type: 'image',
    content: {
      url: imageUrl
    },
    template_uuid: templateUuid,
    optin_contact: true
  }
};
```

**Send Template to Callbell:**
```json
POST https://api.callbell.eu/v1/messages/send

{
  "to": "57...",
  "from": "whatsapp",
  "type": "image",
  "content": {
    "url": "https://..."
  },
  "template_uuid": "...",
  "optin_contact": true
}
```

### 8. Guardar en Historial
```
Prepare Outbound Message → Save Outbound to Historial
```

**Save Outbound to Historial:**
- POST al webhook de Historial v3
- Payload:
```json
{
  "uuid": "...",
  "from": "573105879824",
  "to": "57...",
  "text": "...",
  "status": "sent",
  "createdAt": 1234567890
}
```

Esto hace que el mensaje del bot se guarde en `messages_v3` como `direction: 'outbound'`, `role: 'assistant'`.

### 9. Log de Éxito
```
Log Success → Loop Over Items (siguiente mensaje)
```

**Log Success:**
```javascript
console.log('✅ MESSAGE SENT SUCCESSFULLY');
console.log('Phone:', phone);
console.log('Message Type:', messageType);  // 'texto' | 'template'
console.log('Callbell Message UUID:', callbellUuid);
console.log('Saved to Historial:', true);
```

## 📋 Estructura de Plantillas

### mensajes.json
```json
{
  "plantillas_base": {
    "/hola": {
      "texto": "¡Hola! 👋 Bienvenido a Somnio...",
      "delay_s": 0
    },
    "/precio": {
      "texto": "Nuestro Elixir del Sueño tiene un precio de...",
      "delay_s": 2
    }
  },
  "plantillas_callbell": {
    "/plantilla_promos": {
      "template_name": "Promos Somnio",
      "template_uuid": "e356a05a9a1046c9bd1b5a84b467a496",
      "texto_alternativo": "Imagen con promociones enviada",
      "delay_s": 2
    }
  },
  "combinaciones_intents": {
    "hola+precio": {
      "respuesta": {
        "primera_vez": ["/hola", "/precio"],
        "siguientes": ["/precio"]
      }
    }
  }
}
```

### intents.json
```json
{
  "intents": {
    "hola": {
      "respuesta": {
        "primera_vez": ["/hola"],
        "siguientes": ["/hola_de_nuevo"]
      }
    },
    "precio": {
      "respuesta": {
        "primera_vez": ["/precio"],
        "siguientes": ["/precio"]
      }
    },
    "ofrecer_promos": {
      "respuesta": {
        "primera_vez": ["/plantilla_promos", "/pregunta_pack"],
        "siguientes": ["/plantilla_promos"]
      }
    }
  },
  "intents_combinados": {
    "hola+precio": {
      "respuesta": {
        "primera_vez": ["/hola", "/precio"],
        "siguientes": ["/precio"]
      }
    }
  }
}
```

## 🎯 Intents Soportados

### Informativos (siempre disponibles)
- `hola` - Saludo inicial
- `precio` - Consulta de precio
- `info_promociones` - Info de promos
- `contenido_envase` - Cuántas cápsulas
- `como_se_toma` - Modo de uso
- `modopago` - Formas de pago
- `envio` - Cobertura y envío
- `invima` - Registro sanitario
- `ubicacion` - Sede física
- `contraindicaciones` - Efectos secundarios

### Combinados (hola + otro)
- `hola+precio`
- `hola+como_se_toma`
- `hola+envio`
- `hola+modopago`
- `hola+captura_datos_si_compra`

### Transaccionales (con validaciones)
- `captura_datos_si_compra` - Cliente quiere comprar
- `ofrecer_promos` - Mostrar promos (requiere campos completos)
- `resumen_1x` / `resumen_2x` / `resumen_3x` - Confirmación de pack
- `compra_confirmada` - Cliente confirma
- `no_confirmado` - Cliente no confirma
- `no_interesa` - Cliente rechaza

## 🚦 Sistema de Validación de Intents

Implementado en **State Analyzer**, pero Carolina respeta las validaciones:

### 1. ofrecer_promos
**Requiere:** Todos los campos completos
```
IF all_fields_complete → PERMITIDO
ELSE → BLOQUEADO (fallback)
```

### 2. resumen_1x/2x/3x
**Requiere:** `ofrecer_promos` visto previamente
```
IF hasSeenIntent('ofrecer_promos') → PERMITIDO
ELSE → BLOQUEADO
```

### 3. compra_confirmada
**Requiere:** Algún resumen visto previamente
```
IF hasSeenAnyIntent(['resumen_1x', 'resumen_2x', 'resumen_3x']) → PERMITIDO
ELSE → BLOQUEADO
```

### 4. no_confirmado
**Requiere:** Algún resumen visto previamente
```
IF hasSeenAnyIntent(['resumen_1x', 'resumen_2x', 'resumen_3x']) → PERMITIDO
ELSE → BLOQUEADO
```

## 🔄 Sistema de Prevención de Duplicados

**Problema:** Evitar enviar el mismo mensaje múltiples veces.

**Solución:**
1. Detectar templates ya enviados al inicio:
```javascript
const templatesSent = messages
  .filter(m => m.role === 'assistant')
  .map(m => ({
    content: m.content,
    preview: m.content.substring(0, 100)
  }));
```

2. Filtrar plantillas durante selección:
```javascript
const yaEnviado = templatesSent.some(sent =>
  sent.preview.includes(primeros100.substring(0, 50))
);
if (yaEnviado) {
  console.log('⏭️ SKIPPING (ya enviado):', key);
  return false;
}
```

3. Si todas las plantillas se filtraron:
```javascript
if (plantillasFiltradas.length === 0) {
  console.log('⚠️ Todas las plantillas ya fueron enviadas');
  return { mensajes_a_enviar: [] };  // No envía nada
}
```

## ⏱️ Sistema de Delays

### Propósito
Simular conversación humana natural con pausas entre mensajes.

### Configuración
```json
{
  "texto": "...",
  "delay_s": 2  // segundos de espera antes de enviar
}
```

### Implementación
```
Loop → Wait (delay_s) → Send Message
```

### Delays Recomendados
- **Primer mensaje:** 0 segundos (inmediato)
- **Mensajes cortos:** 2 segundos
- **Mensajes largos:** 4-6 segundos
- **Templates (imágenes):** 3 segundos

## 🚨 Manejo de Interrupciones

### Escenario
```
Bot enviando cadena:
1. Hola 👋
2. [wait 2s]
3. Nuestro precio es...
4. [wait 2s]

⚡ Cliente escribe: "cuánto cuesta?"

Bot detecta interrupción → Cancela mensajes restantes
→ Historial procesa nuevo mensaje
→ Carolina se re-ejecuta con contexto actualizado
→ Responde directamente a "cuánto cuesta?"
```

### Mecanismo

**Version tracking:**
- Cada vez que un mensaje se guarda → `version++` en sessions_v3
- Carolina guarda `version_inicial` al inicio del loop
- Antes de cada envío → compara `version_actual` vs `version_inicial`

**Detección:**
```javascript
if (versionActual !== versionInicial && pendingCountActual > 0) {
  // ⚠️ INTERRUPCIÓN DETECTADA
  console.log('⚠️ INTERRUPTED: Cliente envió nuevo mensaje');
  return { should_continue: false, reason: 'interrupted' };
}
```

**Resultado:**
- Loop se detiene inmediatamente
- No envía mensajes restantes
- Historial v3 ya procesó el nuevo mensaje
- Carolina se ejecuta nuevamente (nuevo trigger)

## 📊 Estructura de Datos

### Loop Item
```json
{
  "mensaje": {
    "tipo": "texto" | "template",
    "texto": "...",
    "template_uuid": "...",
    "delay_s": 2
  },
  "msg_index": 0,
  "total": 3,
  "session_id": "session_...",
  "phone": "57...",
  "captured_data": {...},
  "intent": "precio",
  "version_inicial": "42"
}
```

### Callbell Response
```json
{
  "message": {
    "uuid": "...",
    "status": "sent",
    "createdAt": 1234567890
  }
}
```

## ⚙️ Configuración

### Credenciales n8n
- **Callbell API:** Header Auth con Bearer token
- **Header Name:** `Authorization`
- **Header Value:** `Bearer kHMm1U4zCkpyYunbFr4eyzzArLs7k9DG.567dec89ec63000252a4ab2a60c3198591f5f780a721c65a82281dd99e4a627a`

### Archivos de Plantillas
- **Ubicación:** `/files/plantillas/`
- **Archivos:**
  - `mensajes.json` - Plantillas de texto y templates
  - `intents.json` - Mapping intent → plantillas

## 📈 Métricas y Logs

### Console Logs Principales
- `📊 INTENT FROM STATE` - Intent detectado
- `🏷️ CHECKING TAGS` - Verificación de tags
- `🚫 BOT DISABLED BY TAGS` - Bot bloqueado
- `ℹ️ NO PENDING MESSAGES` - Sin mensajes pendientes
- `=== SELECT TEMPLATES DEBUG ===` - Selección de plantillas
- `⏭️ SKIPPING (ya enviado)` - Template ya enviado
- `⚠️ INTERRUPTED` - Cliente interrumpió cadena
- `✅ MESSAGE SENT SUCCESSFULLY` - Mensaje enviado

## 🛠️ Mantenimiento

### Nodo Temporal: "TEMP - Limpiar Sesiones"
```sql
DELETE FROM messages_v3
WHERE session_id IN (
  SELECT session_id FROM sessions_v3
  WHERE phone LIKE '%3137549286%'
);

DELETE FROM sessions_v3
WHERE phone LIKE '%3137549286%';
```
**Uso:** Testing. **Eliminar en producción.**

## 🎯 Casos de Uso

### 1. Respuesta Simple (Un mensaje)
```
Cliente: "hola"
→ Carolina: "¡Hola! 👋 Bienvenido a Somnio..."
```

### 2. Respuesta Compuesta (Múltiples mensajes)
```
Cliente: "cuánto cuesta?"
→ Carolina:
  [0s] "Nuestro Elixir del Sueño tiene un precio de $77,900"
  [2s] "Contamos con promociones en paquetes de 2x y 3x"
  [2s] "¿Te interesa algún paquete?"
```

### 3. Respuesta con Template
```
Cliente: (completó datos, sin pack)
→ Intent: ofrecer_promos
→ Carolina:
  [0s] [IMAGEN con promos 1x/2x/3x]
  [3s] "¿Cuál pack te gustaría adquirir?"
```

### 4. Interrupción Detectada
```
Carolina enviando:
  [0s] "Nuestro precio es..."
  [wait 2s]

⚡ Cliente: "envían a Cali?"

Carolina detecta:
  version_inicial: 42
  version_actual: 43
  pending_count: 1
→ ABORTA mensajes restantes
→ Historial procesa "envían a Cali?"
→ Carolina se re-ejecuta → Responde sobre envíos
```

## 🚨 Errores Comunes

### Error: "No pending messages"
**Causa:** Snapshot sin mensajes pendientes
**Solución:** Normal, termina ejecución

### Error: "Bot disabled by tags"
**Causa:** Tag bloqueado (WPP, P/W, etc.)
**Solución:** Normal, cliente ya procesado

### Error: "Todas las plantillas ya fueron enviadas"
**Causa:** Cliente pidió el mismo intent múltiples veces
**Solución:** No envía nada (ya respondió antes)

### Error: "Callbell API timeout"
**Causa:** API de Callbell caída o lenta
**Solución:** Retry manual o esperar

## 🔗 Dependencias

**Carolina v3 depende de:**
- Historial v3 (trigger)
- Snapshot endpoint (obtener estado)
- Callbell API (enviar mensajes)
- Plantillas JSON (generar respuestas)

**Workflows que dependen de Carolina v3:**
- Ninguno (es el endpoint final del flujo)

## 📝 Notas Importantes

1. **No usa Claude:** Todo basado en plantillas predefinidas
2. **Idempotente:** No envía mensajes duplicados
3. **Interruptible:** Detecta y respeta mensajes del cliente
4. **Delay inteligente:** Primer mensaje inmediato, resto con pausas
5. **Tag WPP:** Auto-asignado en compra_confirmada
6. **Template fallback:** Si template falla, usa texto_alternativo
