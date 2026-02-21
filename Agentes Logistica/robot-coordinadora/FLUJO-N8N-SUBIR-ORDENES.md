# Flujo n8n Detallado - Subir Ordenes Coordinadora

> Documentacion nodo por nodo del workflow de n8n para replicar en MorfX

---

## Diagrama del Flujo

```
┌──────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│ Slack Trigger├───►│ Filtrar Mensaje ├───►│ Bigin: Obtener Ordenes │
└──────────────┘    └─────────────────┘    └────────────┬───────────┘
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │ Hay Ordenes?  │
                                                └───────┬───────┘
                                                        │
                                         ┌──────────────┴──────────────┐
                                         │ SI                         │ NO
                                         ▼                            ▼
                               ┌────────────────────┐       ┌─────────────────┐
                               │ Claude: Procesar   │       │ Slack: Sin      │
                               │ Datos              │       │ Ordenes         │
                               └────────┬───────────┘       └─────────────────┘
                                        │
                                        ▼
                               ┌────────────────────┐
                               │ Parsear Respuesta  │
                               │ Claude             │
                               └────────┬───────────┘
                                        │
                                        ▼
                               ┌────────────────────┐
                               │ Validar Ciudades   │
                               └────────┬───────────┘
                                        │
                                        ▼
                               ┌────────────────────┐
                               │ Ciudad Valida?     │
                               └────────┬───────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │ SI                        │ NO
                          ▼                           ▼
                ┌────────────────────┐      ┌────────────────────┐
                │ Robot: Crear       │      │ Error: Ciudad      │
                │ Pedido             │      │ Invalida           │
                └────────┬───────────┘      └────────┬───────────┘
                         │                           │
                         ▼                           │
                ┌────────────────────┐               │
                │ Generar Resumen    │               │
                └────────┬───────────┘               │
                         │                           │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │ Unir Resultados    │
                              └────────┬───────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │ Combinar Mensajes  │
                              └────────┬───────────┘
                                       │
                                       ▼
                              ┌────────────────────┐
                              │ Slack: Resultado   │
                              └────────────────────┘
```

---

## Nodos en Detalle

### 1. Slack Trigger
**Tipo:** `n8n-nodes-base.slackTrigger`

**Funcion:** Escucha mensajes en un canal de Slack

**Configuracion:**
```json
{
  "event": "message",
  "webhookId": "coordinadora-bot-trigger"
}
```

**Output:**
```json
{
  "text": "subir ordenes coord",
  "user": "U123456",
  "channel": "C0A9M96C0AK",
  "ts": "1234567890.123456"
}
```

**Para MorfX:** Webhook HTTP o trigger de tu sistema.

---

### 2. Filtrar Mensaje
**Tipo:** `n8n-nodes-base.filter`

**Funcion:** Solo deja pasar mensajes que contengan "subir ordenes coord"

**Logica:**
```javascript
$json.text.toLowerCase().contains("subir ordenes coord")
```

**Para MorfX:**
```javascript
function filtrarComando(mensaje) {
  return mensaje.toLowerCase().includes("subir ordenes coord");
}
```

---

### 3. Bigin: Obtener Ordenes
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Busca ordenes en Bigin con stage "ROBOT COORD"

**Request:**
```http
GET https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:ROBOT COORD)

Headers:
  Authorization: Zoho-oauthtoken <access_token>
```

**NOTA:** Este nodo usa OAuth2 configurado en n8n, no refresh token manual.

**Response:**
```json
{
  "data": [
    {
      "id": "5234234234234",
      "Deal_Name": "Juan Perez - Kit Skincare",
      "Phone": "+57 316 370 9528",
      "Direccion": "Calle 45 #23-15",
      "Municipio": "Medellin",
      "Departamento": "Antioquia",
      "Amount": 77900,
      "Stage": "ROBOT COORD",
      "Description": "Kit completo skincare"
    }
  ]
}
```

**Para MorfX:**
```javascript
async function obtenerOrdenesRobotCoord(accessToken) {
  const response = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:ROBOT COORD)',
    {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    }
  );
  const data = await response.json();
  return data.data || [];
}
```

---

### 4. Hay Ordenes?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Bifurca segun si hay ordenes

**Logica:**
```javascript
$json.data?.length > 0
```

**Caminos:**
- **TRUE:** Continua a Claude
- **FALSE:** Notifica "Sin ordenes"

---

### 5. Slack: Sin Ordenes
**Tipo:** `n8n-nodes-base.slack`

**Mensaje:**
```
⚠️ No hay ordenes en el stage *ROBOT COORD*
```

---

### 6. Claude: Procesar Datos
**Tipo:** `@n8n/n8n-nodes-langchain.lmChatAnthropic`

**Funcion:** Usa Claude AI para limpiar y transformar los datos de Bigin

**Configuracion:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 4096
}
```

**System Prompt:**
```
Procesas ordenes de Bigin para Coordinadora.

REGLAS:

1. TELEFONO: Quitar 57 del inicio, quitar espacios/guiones. Debe ser 10 digitos.
   Ej: "+57 316 3709528" → "3163709528"

2. NOMBRE: Primera palabra = nombres, resto = apellidos. Si solo hay una, apellidos = "Cliente"

3. UNIDADES: 77900→1, 109900→2, 139900→3. Si otro valor, buscar "(X unidades)" en descripcion.

4. RECAUDO: Si nombre tiene "&" o tag "PAGO ANTICIPADO" → false. Sino → true

5. CIUDAD: Poner el municipio en MAYUSCULAS tal cual viene.

6. DEPARTAMENTO: Poner el departamento en MAYUSCULAS tal cual viene.

7. VALORES FIJOS: referencia="AA1", valorDeclarado=55000, peso=0.08, alto=5, largo=5, ancho=10, totalIva=0

Devuelve SOLO JSON array, sin explicacion:
[{
  "identificacion": "10 digitos",
  "nombres": "string",
  "apellidos": "string",
  "direccion": "string",
  "ciudad": "MUNICIPIO",
  "departamento": "DEPARTAMENTO",
  "celular": "10 digitos",
  "email": "string o null",
  "referencia": "AA1",
  "unidades": number,
  "totalConIva": number,
  "valorDeclarado": 55000,
  "esRecaudoContraentrega": boolean,
  "peso": 0.08,
  "alto": 5,
  "largo": 5,
  "ancho": 10,
  "biginOrderId": "string",
  "biginOrderName": "string"
}]
```

**User Message:**
```
Procesa estas ordenes de Bigin:

{{ JSON.stringify($json.data, null, 2) }}
```

**Para MorfX:**
```javascript
async function procesarConClaude(ordenes) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,  // El prompt de arriba
      messages: [
        {
          role: 'user',
          content: `Procesa estas ordenes de Bigin:\n\n${JSON.stringify(ordenes, null, 2)}`
        }
      ]
    })
  });

  return await response.json();
}
```

---

### 7. Parsear Respuesta Claude
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Extrae el JSON array de la respuesta de Claude

**Codigo JavaScript:**
```javascript
// Parsear respuesta de Claude
const response = $input.first().json;
let pedidos = [];

try {
  const content = response.message?.content || response.content || response.text;
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonMatch) {
    pedidos = JSON.parse(jsonMatch[0]);
  }
} catch (e) {
  console.error('Error parseando respuesta:', e);
}

return pedidos.map(p => ({ json: p }));
```

**Output:** Array de items, uno por pedido:
```json
[
  { "json": { "identificacion": "3163709528", "nombres": "Juan", ... } },
  { "json": { "identificacion": "3001234567", "nombres": "Maria", ... } }
]
```

**Para MorfX:**
```javascript
function parsearRespuestaClaude(claudeResponse) {
  const content = claudeResponse.content[0].text;

  // Buscar array JSON en la respuesta
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return [];
}
```

---

### 8. Validar Ciudades
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Llama al robot para validar que las ciudades existen y soportan recaudo

**Codigo JavaScript:**
```javascript
// Validar ciudades con el servidor
const pedidos = $input.all().map(item => item.json);

const response = await fetch('http://172.17.0.1:3001/api/validar-pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pedidos }),
});

const resultado = await response.json();

// Retornar pedidos con info de validacion
return resultado.pedidos.map(pedido => {
  const { _index, ...datos } = pedido;
  return { json: datos };
});
```

**Output:** Pedidos con campos adicionales `_valido`, `_error`, `_aceptaRecaudo`:
```json
{
  "identificacion": "3163709528",
  "nombres": "Juan",
  "ciudad": "MEDELLIN (ANT)",  // Normalizado
  "_valido": true,
  "_aceptaRecaudo": true
}
```

**Para MorfX:**
```javascript
async function validarCiudades(pedidos) {
  const response = await fetch('http://localhost:3001/api/validar-pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidos })
  });

  const data = await response.json();
  return data.pedidos;
}
```

---

### 9. Ciudad Valida?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Bifurca pedidos validos vs invalidos

**Logica:**
```javascript
$json._valido === true
```

**Caminos:**
- **TRUE:** Robot crea pedido
- **FALSE:** Genera error de ciudad

**NOTA:** Este nodo se ejecuta POR CADA ITEM (loop automatico en n8n).

---

### 10. Robot: Crear Pedido
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Crea el pedido en Coordinadora via el robot Playwright

**Request:**
```http
POST http://172.17.0.1:3001/api/crear-pedido

Headers:
  Content-Type: application/json

Body: (el pedido completo)
{
  "identificacion": "3163709528",
  "nombres": "Juan",
  "apellidos": "Perez",
  "direccion": "Calle 45 #23-15",
  "ciudad": "MEDELLIN (ANT)",
  "departamento": "ANTIOQUIA",
  "celular": "3163709528",
  "email": null,
  "referencia": "AA1",
  "unidades": 1,
  "totalConIva": 77900,
  "valorDeclarado": 55000,
  "esRecaudoContraentrega": true,
  "peso": 0.08,
  "alto": 5,
  "largo": 5,
  "ancho": 10,
  "biginOrderId": "5234234234234",
  "biginOrderName": "Juan Perez - Kit Skincare"
}

Timeout: 120000ms (2 minutos)
```

**Response:**
```json
{
  "success": true,
  "numeroPedido": "9650",
  "mensaje": "Pedido 9650 creado exitosamente",
  "biginOrderId": "5234234234234"
}
```

**Para MorfX:**
```javascript
async function crearPedidoEnCoordinadora(pedido) {
  const response = await fetch('http://localhost:3001/api/crear-pedido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido),
    signal: AbortSignal.timeout(120000)
  });

  return await response.json();
}
```

---

### 11. Error: Ciudad Invalida
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Genera mensaje de error para ciudades invalidas

**Codigo JavaScript:**
```javascript
// Generar mensaje de error para ciudades invalidas
const items = $input.all();

const errores = items.map(item => {
  const p = item.json;
  return `• ${p.biginOrderName || 'Pedido'}: ${p._error}`;
}).join('\n');

return [{
  json: {
    mensaje: `❌ *Pedidos rechazados (ciudad invalida o no acepta recaudo):*\n${errores}`,
    cantidad: items.length,
    tipo: 'error_ciudad'
  }
}];
```

---

### 12. Generar Resumen
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Genera resumen de pedidos creados/fallidos

**Codigo JavaScript:**
```javascript
// Recopilar resultados del robot
const items = $input.all();

const exitosos = items.filter(i => i.json.success).length;
const fallidos = items.filter(i => !i.json.success).length;

const pedidosCreados = items
  .filter(i => i.json.success)
  .map(i => i.json.numeroPedido)
  .join(', ');

const errores = items
  .filter(i => !i.json.success)
  .map(i => `• ${i.json.biginOrderName || 'Pedido'}: ${i.json.error}`)
  .join('\n');

let mensaje = '';

if (exitosos > 0) {
  mensaje += `✅ *${exitosos} pedido(s) creado(s):* ${pedidosCreados}\n`;
}

if (fallidos > 0) {
  mensaje += `\n❌ *${fallidos} pedido(s) fallido(s):*\n${errores}`;
}

if (exitosos === 0 && fallidos === 0) {
  mensaje = '⚠️ No se procesaron pedidos';
}

return [{
  json: {
    mensaje,
    exitosos,
    fallidos,
    total: items.length,
    tipo: 'resultado_robot'
  }
}];
```

---

### 13. Unir Resultados
**Tipo:** `n8n-nodes-base.merge`

**Funcion:** Combina los resultados del camino "valido" y "invalido"

**Configuracion:**
```json
{
  "mode": "combine",
  "combinationMode": "mergeByPosition"
}
```

**Para MorfX:** Simplemente concatenar los arrays de resultados.

---

### 14. Combinar Mensajes
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Une todos los mensajes en uno solo

**Codigo JavaScript:**
```javascript
// Combinar mensajes de error de ciudad y resultados del robot
const items = $input.all();

let mensajeFinal = '';

for (const item of items) {
  if (item.json.mensaje) {
    mensajeFinal += item.json.mensaje + '\n\n';
  }
}

return [{ json: { mensaje: mensajeFinal.trim() } }];
```

---

### 15. Slack: Enviar Resultado
**Tipo:** `n8n-nodes-base.slack`

**Funcion:** Envia el resultado final a Slack

**Configuracion:**
```json
{
  "select": "channel",
  "channelId": "={{ $('Slack Trigger').item.json.channel }}",
  "text": "={{ $json.mensaje }}",
  "otherOptions": {
    "mrkdwn": true
  }
}
```

**Ejemplo de mensaje final:**
```
✅ *2 pedido(s) creado(s):* 9650, 9651

❌ *1 pedido(s) rechazado(s) (ciudad invalida o no acepta recaudo):*
• Maria Garcia - Serum: PUEBLO INEXISTENTE no se encontro en DEPARTAMENTO
```

---

## Codigo Completo para MorfX

```javascript
// ============================================
// FLUJO COMPLETO: SUBIR ORDENES COORDINADORA
// ============================================

const CLAUDE_SYSTEM_PROMPT = `Procesas ordenes de Bigin para Coordinadora.

REGLAS:

1. TELEFONO: Quitar 57 del inicio, quitar espacios/guiones. Debe ser 10 digitos.
   Ej: "+57 316 3709528" → "3163709528"

2. NOMBRE: Primera palabra = nombres, resto = apellidos. Si solo hay una, apellidos = "Cliente"

3. UNIDADES: 77900→1, 109900→2, 139900→3. Si otro valor, buscar "(X unidades)" en descripcion.

4. RECAUDO: Si nombre tiene "&" o tag "PAGO ANTICIPADO" → false. Sino → true

5. CIUDAD: Poner el municipio en MAYUSCULAS tal cual viene.

6. DEPARTAMENTO: Poner el departamento en MAYUSCULAS tal cual viene.

7. VALORES FIJOS: referencia="AA1", valorDeclarado=55000, peso=0.08, alto=5, largo=5, ancho=10, totalIva=0

Devuelve SOLO JSON array, sin explicacion:
[{
  "identificacion": "10 digitos",
  "nombres": "string",
  "apellidos": "string",
  "direccion": "string",
  "ciudad": "MUNICIPIO",
  "departamento": "DEPARTAMENTO",
  "celular": "10 digitos",
  "email": "string o null",
  "referencia": "AA1",
  "unidades": number,
  "totalConIva": number,
  "valorDeclarado": 55000,
  "esRecaudoContraentrega": boolean,
  "peso": 0.08,
  "alto": 5,
  "largo": 5,
  "ancho": 10,
  "biginOrderId": "string",
  "biginOrderName": "string"
}]`;

async function subirOrdenesCoordinadora() {
  // ----------------------------------------
  // PASO 1: Obtener token de Bigin
  // ----------------------------------------
  console.log('Paso 1: Obteniendo token de Bigin...');
  const accessToken = await refreshBiginToken();

  // ----------------------------------------
  // PASO 2: Buscar ordenes en ROBOT COORD
  // ----------------------------------------
  console.log('Paso 2: Buscando ordenes en ROBOT COORD...');
  const ordenes = await obtenerOrdenesRobotCoord(accessToken);

  if (!ordenes || ordenes.length === 0) {
    return {
      success: true,
      mensaje: '⚠️ No hay ordenes en el stage *ROBOT COORD*'
    };
  }

  console.log(`   Encontradas ${ordenes.length} ordenes`);

  // ----------------------------------------
  // PASO 3: Procesar con Claude AI
  // ----------------------------------------
  console.log('Paso 3: Procesando con Claude AI...');
  const claudeResponse = await llamarClaudeAI(ordenes);
  const pedidosProcesados = parsearRespuestaClaude(claudeResponse);

  if (!pedidosProcesados || pedidosProcesados.length === 0) {
    return {
      success: false,
      mensaje: '❌ Error procesando ordenes con Claude AI'
    };
  }

  console.log(`   ${pedidosProcesados.length} pedidos procesados`);

  // ----------------------------------------
  // PASO 4: Validar ciudades
  // ----------------------------------------
  console.log('Paso 4: Validando ciudades...');
  const pedidosValidados = await validarCiudades(pedidosProcesados);

  const validos = pedidosValidados.filter(p => p._valido);
  const invalidos = pedidosValidados.filter(p => !p._valido);

  console.log(`   Validos: ${validos.length}, Invalidos: ${invalidos.length}`);

  // ----------------------------------------
  // PASO 5: Crear pedidos en Coordinadora
  // ----------------------------------------
  console.log('Paso 5: Creando pedidos en Coordinadora...');
  const resultadosRobot = [];

  for (let i = 0; i < validos.length; i++) {
    const pedido = validos[i];
    console.log(`   [${i + 1}/${validos.length}] Creando: ${pedido.biginOrderName}`);

    const resultado = await crearPedidoEnCoordinadora(pedido);
    resultadosRobot.push({
      pedido,
      resultado
    });

    // Pausa entre pedidos
    if (i < validos.length - 1) {
      await sleep(2000);
    }
  }

  // ----------------------------------------
  // PASO 6: Generar resumen
  // ----------------------------------------
  console.log('Paso 6: Generando resumen...');

  const exitosos = resultadosRobot.filter(r => r.resultado.success);
  const fallidos = resultadosRobot.filter(r => !r.resultado.success);

  // Mensaje de pedidos creados
  let mensaje = '';

  if (exitosos.length > 0) {
    const numeros = exitosos.map(e => e.resultado.numeroPedido).join(', ');
    mensaje += `✅ *${exitosos.length} pedido(s) creado(s):* ${numeros}\n`;
  }

  if (fallidos.length > 0) {
    mensaje += `\n❌ *${fallidos.length} pedido(s) fallido(s):*\n`;
    for (const { pedido, resultado } of fallidos) {
      mensaje += `• ${pedido.biginOrderName}: ${resultado.error}\n`;
    }
  }

  if (invalidos.length > 0) {
    mensaje += `\n⚠️ *${invalidos.length} pedido(s) rechazado(s) (ciudad invalida):*\n`;
    for (const pedido of invalidos) {
      mensaje += `• ${pedido.biginOrderName}: ${pedido._error}\n`;
    }
  }

  if (mensaje === '') {
    mensaje = '⚠️ No se procesaron pedidos';
  }

  // ----------------------------------------
  // PASO 7: Actualizar Bigin (opcional)
  // ----------------------------------------
  if (exitosos.length > 0) {
    console.log('Paso 7: Actualizando Bigin...');
    const token = await refreshBiginToken();

    for (const { pedido, resultado } of exitosos) {
      await actualizarBiginConPedido(pedido.biginOrderId, resultado.numeroPedido, token);
    }
  }

  return {
    success: true,
    totalProcesadas: pedidosProcesados.length,
    exitosos: exitosos.length,
    fallidos: fallidos.length,
    invalidos: invalidos.length,
    mensaje
  };
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function refreshBiginToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.BIGIN_REFRESH_TOKEN,
    client_id: process.env.BIGIN_CLIENT_ID,
    client_secret: process.env.BIGIN_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });

  const response = await fetch(
    `https://accounts.zoho.com/oauth/v2/token?${params}`,
    { method: 'POST' }
  );

  const data = await response.json();
  return data.access_token;
}

async function obtenerOrdenesRobotCoord(accessToken) {
  const response = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:ROBOT COORD)',
    {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.data || [];
}

async function llamarClaudeAI(ordenes) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Procesa estas ordenes de Bigin:\n\n${JSON.stringify(ordenes, null, 2)}`
        }
      ]
    })
  });

  return await response.json();
}

function parsearRespuestaClaude(claudeResponse) {
  try {
    const content = claudeResponse.content[0].text;
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parseando respuesta de Claude:', e);
  }

  return [];
}

async function validarCiudades(pedidos) {
  const response = await fetch('http://localhost:3001/api/validar-pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidos })
  });

  const data = await response.json();
  return data.pedidos;
}

async function crearPedidoEnCoordinadora(pedido) {
  const response = await fetch('http://localhost:3001/api/crear-pedido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido),
    signal: AbortSignal.timeout(120000)
  });

  return await response.json();
}

async function actualizarBiginConPedido(biginId, numeroPedido, accessToken) {
  const response = await fetch(
    `https://www.zohoapis.com/bigin/v1/Deals/${biginId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          Guia: numeroPedido,       // # de pedido (temporal)
          Stage: 'COORDINADORA'     // Nuevo stage
        }]
      })
    }
  );

  return await response.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EJECUTAR
// ============================================
subirOrdenesCoordinadora()
  .then(result => {
    console.log('\n=== RESULTADO ===');
    console.log(result.mensaje);
  })
  .catch(error => console.error('Error:', error));
```

---

## Variables de Entorno Necesarias

```env
# Bigin/Zoho OAuth2
BIGIN_REFRESH_TOKEN=1000.xxx...
BIGIN_CLIENT_ID=1000.XXX...
BIGIN_CLIENT_SECRET=xxx...

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=sk-ant-xxx...

# Robot Coordinadora
ROBOT_URL=http://localhost:3001
```

---

## Resumen de Funcionalidades para MorfX

| Funcionalidad | Descripcion | Prioridad |
|---------------|-------------|-----------|
| OAuth2 Bigin | Obtener/refrescar access_token | ALTA |
| Buscar Deals | GET con criteria Stage=ROBOT COORD | ALTA |
| Claude AI API | Procesar/limpiar datos | ALTA |
| Parsear JSON | Extraer array de respuesta Claude | ALTA |
| Validar ciudades | POST /api/validar-pedidos | ALTA |
| Crear pedido | POST /api/crear-pedido (2min timeout) | ALTA |
| Actualizar Bigin | PUT con Guia=numeroPedido, Stage=COORDINADORA | ALTA |
| Combinar resultados | Unir validos + invalidos | MEDIA |
| Generar mensaje | Formato markdown para Slack | MEDIA |
