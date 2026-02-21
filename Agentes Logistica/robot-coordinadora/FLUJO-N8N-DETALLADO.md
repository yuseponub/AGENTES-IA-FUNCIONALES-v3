# Flujo n8n Detallado - Ingresar Guias Coordinadora

> Documentacion nodo por nodo del workflow de n8n para replicar en MorfX

---

## Diagrama del Flujo

```
┌──────────────┐    ┌─────────────────┐    ┌────────────────────┐    ┌──────────────────────────┐
│ Slack Trigger├───►│ Filtrar Comando ├───►│ Refresh Bigin Token├───►│ Bigin: Ordenes COORD     │
└──────────────┘    └─────────────────┘    └────────────────────┘    └────────────┬─────────────┘
                                                                                   │
                    ┌──────────────────────────────────────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Hay Ordenes?  │
            └───────┬───────┘
                    │
         ┌──────────┴──────────┐
         │ SI                  │ NO
         ▼                     ▼
┌────────────────────┐  ┌─────────────────┐
│ Extraer Numeros    │  │ Slack: Sin      │
│ de Pedido          │  │ Ordenes         │
└────────┬───────────┘  └─────────────────┘
         │
         ▼
  ┌──────────────┐
  │ Hay Pedidos? │
  └──────┬───────┘
         │
    ┌────┴────┐
    │ SI      │ NO
    ▼         ▼
┌───────────────────┐  ┌─────────────────┐
│ Robot: Buscar     │  │ Slack: Sin      │
│ Guias (HTTP)      │  │ Pedidos         │
└────────┬──────────┘  └─────────────────┘
         │
         ▼
┌────────────────────┐
│ Procesar           │
│ Resultados         │
└────────┬───────────┘
         │
         ▼
  ┌──────────────┐
  │ Hay Guias?   │
  └──────┬───────┘
         │
    ┌────┴────┐
    │ SI      │ NO
    ▼         ▼
┌────────────────┐  ┌─────────────────────┐
│ Split Ordenes  │  │ Mensaje Sin Guias   │
└───────┬────────┘  └──────────┬──────────┘
        │                      │
        ▼                      ▼
┌─────────────────────┐  ┌─────────────────┐
│ Refresh Token Update│  │ Slack: Sin Guias│
└───────┬─────────────┘  └─────────────────┘
        │
        ▼
┌─────────────────────┐
│ Bigin: Actualizar   │
│ Orden (loop)        │
└───────┬─────────────┘
        │
        ▼
┌─────────────────────┐
│ Generar Resumen     │
└───────┬─────────────┘
        │
        ▼
┌─────────────────────┐
│ Slack: Resultado    │
└─────────────────────┘
```

---

## Nodos en Detalle

### 1. Slack Trigger
**Tipo:** `n8n-nodes-base.slackTrigger`

**Funcion:** Escucha mensajes en un canal de Slack

**Configuracion:**
```json
{
  "trigger": ["message"],
  "channelId": "C0A9M96C0AK"
}
```

**Output:**
```json
{
  "text": "ingresa guias coord",
  "user": "U123456",
  "channel": "C0A9M96C0AK",
  "ts": "1234567890.123456"
}
```

**Para MorfX:** Reemplazar con webhook HTTP o trigger de tu sistema de mensajeria.

---

### 2. Filtrar Comando
**Tipo:** `n8n-nodes-base.filter`

**Funcion:** Solo deja pasar mensajes que contengan "ingresa guias coord"

**Logica:**
```javascript
// Condicion
$json.text.toLowerCase().contains("ingresa guias coord")
```

**Para MorfX:**
```javascript
function filtrarComando(mensaje) {
  return mensaje.toLowerCase().includes("ingresa guias coord");
}

// Si no pasa el filtro, terminar flujo
if (!filtrarComando(input.text)) {
  return; // No hacer nada
}
```

---

### 3. Refresh Bigin Token
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Obtiene un access_token fresco de Bigin/Zoho

**Request:**
```http
POST https://accounts.zoho.com/oauth/v2/token

Query Parameters:
  refresh_token=1000.xxx...
  client_id=1000.XXX...
  client_secret=xxx...
  grant_type=refresh_token
```

**Response:**
```json
{
  "access_token": "1000.abc123...",
  "api_domain": "https://www.zohoapis.com",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Para MorfX:**
```javascript
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
```

---

### 4. Bigin: Ordenes en COORDINADORA
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Busca todas las ordenes en Bigin que estan en stage "COORDINADORA"

**Request:**
```http
GET https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:COORDINADORA)

Headers:
  Authorization: Zoho-oauthtoken <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "5234234234234",
      "Deal_Name": "Juan Perez - Kit Skincare",
      "Guia": "9650",
      "Phone": "3163709528",
      "Stage": "COORDINADORA",
      "Amount": 77900
    },
    {
      "id": "5234234234235",
      "Deal_Name": "Maria Garcia - Serum",
      "Guia": "9651",
      "Phone": "3001234567",
      "Stage": "COORDINADORA",
      "Amount": 109900
    }
  ]
}
```

**Para MorfX:**
```javascript
async function obtenerOrdenesCoordinadora(accessToken) {
  const response = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:COORDINADORA)',
    {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    }
  );

  const data = await response.json();
  return data.data || [];
}
```

---

### 5. Hay Ordenes?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Bifurca el flujo segun si hay ordenes o no

**Logica:**
```javascript
// Condicion
$json.data?.length > 0
```

**Caminos:**
- **TRUE (SI):** Continua a "Extraer Numeros de Pedido"
- **FALSE (NO):** Va a "Slack: Sin Ordenes"

**Para MorfX:**
```javascript
const ordenes = await obtenerOrdenesCoordinadora(accessToken);

if (!ordenes || ordenes.length === 0) {
  // Notificar: "No hay ordenes en stage COORDINADORA"
  await notificar("No hay ordenes en el stage COORDINADORA");
  return;
}

// Continuar con el flujo...
```

---

### 6. Slack: Sin Ordenes
**Tipo:** `n8n-nodes-base.slack`

**Funcion:** Envia mensaje a Slack cuando no hay ordenes

**Mensaje:**
```
No hay ordenes en el stage *COORDINADORA*
```

**Para MorfX:** Usar tu sistema de notificaciones (Slack, email, websocket, etc.)

---

### 7. Extraer Numeros de Pedido
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Transforma las ordenes de Bigin para extraer los numeros de pedido

**Codigo JavaScript:**
```javascript
// Extraer los numeros de pedido de las ordenes de Bigin
// El # de pedido esta temporalmente en el campo 'Guia' de Bigin
const ordenes = $input.first().json.data || [];

const pedidosParaBuscar = ordenes
  .filter(orden => orden.Guia && orden.Guia.trim().length > 0)
  .map(orden => ({
    biginId: orden.id,
    dealName: orden.Deal_Name,
    numeroPedido: orden.Guia.trim(),  // El # de pedido esta en 'Guia' temporalmente
    telefono: orden.Phone,
    stage: orden.Stage
  }));

console.log(`Encontradas ${pedidosParaBuscar.length} ordenes con # de pedido`);

return [{
  json: {
    ordenes: pedidosParaBuscar,
    numerosPedidos: pedidosParaBuscar.map(p => p.numeroPedido),
    totalOrdenes: pedidosParaBuscar.length
  }
}];
```

**Output:**
```json
{
  "ordenes": [
    {
      "biginId": "5234234234234",
      "dealName": "Juan Perez - Kit Skincare",
      "numeroPedido": "9650",
      "telefono": "3163709528",
      "stage": "COORDINADORA"
    }
  ],
  "numerosPedidos": ["9650", "9651"],
  "totalOrdenes": 2
}
```

**Para MorfX:**
```javascript
function extraerNumerosPedido(ordenes) {
  const pedidosParaBuscar = ordenes
    .filter(orden => orden.Guia && orden.Guia.trim().length > 0)
    .map(orden => ({
      biginId: orden.id,
      dealName: orden.Deal_Name,
      numeroPedido: orden.Guia.trim(),
      telefono: orden.Phone,
      stage: orden.Stage
    }));

  return {
    ordenes: pedidosParaBuscar,
    numerosPedidos: pedidosParaBuscar.map(p => p.numeroPedido),
    totalOrdenes: pedidosParaBuscar.length
  };
}
```

**IMPORTANTE:** En este punto, el campo `Guia` de Bigin contiene el **numero de pedido** de Coordinadora, NO la guia real. Este es un uso temporal del campo.

---

### 8. Hay Pedidos?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Verifica si hay pedidos con numero para buscar

**Logica:**
```javascript
$json.totalOrdenes > 0
```

**Para MorfX:**
```javascript
const datos = extraerNumerosPedido(ordenes);

if (datos.totalOrdenes === 0) {
  await notificar("No hay ordenes con # de pedido para buscar guias");
  return;
}
```

---

### 9. Robot: Buscar Guias
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Llama al robot de Playwright para buscar las guias en el portal de Coordinadora

**Request:**
```http
POST http://172.17.0.1:3001/api/buscar-guias

Headers:
  Content-Type: application/json

Body:
{
  "numerosPedidos": ["9650", "9651"]
}

Timeout: 180000ms (3 minutos)
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "encontrados": 1,
  "sinGuia": 1,
  "resultados": [
    {
      "numeroPedido": "9650",
      "numeroGuia": "53180509486",
      "estado": "En terminal origen",
      "success": true
    },
    {
      "numeroPedido": "9651",
      "success": false,
      "error": "Pedido encontrado pero sin guia asignada"
    }
  ]
}
```

**Para MorfX:**
```javascript
async function buscarGuiasEnRobot(numerosPedidos) {
  const response = await fetch('http://localhost:3001/api/buscar-guias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numerosPedidos }),
    signal: AbortSignal.timeout(180000) // 3 minutos
  });

  return await response.json();
}
```

**NOTA:** La URL `172.17.0.1` es la IP del host Docker desde dentro de un contenedor. Si MorfX corre en el mismo servidor, usar `localhost:3001`.

---

### 10. Procesar Resultados
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Combina los resultados del robot con los datos originales de Bigin

**Codigo JavaScript:**
```javascript
// Combinar resultados del robot con datos de Bigin
const robotResult = $input.first().json;
const ordenesOriginales = $('Extraer Numeros de Pedido').first().json.ordenes;

const resultados = [];

for (const robot of (robotResult.resultados || [])) {
  const ordenBigin = ordenesOriginales.find(o => o.numeroPedido === robot.numeroPedido);

  if (ordenBigin && robot.success && robot.numeroGuia) {
    resultados.push({
      biginId: ordenBigin.biginId,
      dealName: ordenBigin.dealName,
      numeroPedido: robot.numeroPedido,
      numeroGuia: robot.numeroGuia,
      estadoCoord: robot.estado || '',
      tieneGuia: true
    });
  } else if (ordenBigin) {
    resultados.push({
      biginId: ordenBigin.biginId,
      dealName: ordenBigin.dealName,
      numeroPedido: robot.numeroPedido,
      error: robot.error || 'Sin guia asignada',
      tieneGuia: false
    });
  }
}

const conGuia = resultados.filter(r => r.tieneGuia);
const sinGuia = resultados.filter(r => !r.tieneGuia);

return [{
  json: {
    resultados,
    conGuia,
    sinGuia,
    totalConGuia: conGuia.length,
    totalSinGuia: sinGuia.length
  }
}];
```

**Output:**
```json
{
  "resultados": [...],
  "conGuia": [
    {
      "biginId": "5234234234234",
      "dealName": "Juan Perez - Kit Skincare",
      "numeroPedido": "9650",
      "numeroGuia": "53180509486",
      "estadoCoord": "En terminal origen",
      "tieneGuia": true
    }
  ],
  "sinGuia": [
    {
      "biginId": "5234234234235",
      "dealName": "Maria Garcia - Serum",
      "numeroPedido": "9651",
      "error": "Sin guia asignada",
      "tieneGuia": false
    }
  ],
  "totalConGuia": 1,
  "totalSinGuia": 1
}
```

**Para MorfX:**
```javascript
function procesarResultados(robotResult, ordenesOriginales) {
  const resultados = [];

  for (const robot of (robotResult.resultados || [])) {
    const ordenBigin = ordenesOriginales.find(o => o.numeroPedido === robot.numeroPedido);

    if (ordenBigin && robot.success && robot.numeroGuia) {
      resultados.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        numeroGuia: robot.numeroGuia,
        estadoCoord: robot.estado || '',
        tieneGuia: true
      });
    } else if (ordenBigin) {
      resultados.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        error: robot.error || 'Sin guia asignada',
        tieneGuia: false
      });
    }
  }

  const conGuia = resultados.filter(r => r.tieneGuia);
  const sinGuia = resultados.filter(r => !r.tieneGuia);

  return {
    resultados,
    conGuia,
    sinGuia,
    totalConGuia: conGuia.length,
    totalSinGuia: sinGuia.length
  };
}
```

---

### 11. Hay Guias?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Bifurca segun si se encontraron guias o no

**Logica:**
```javascript
$json.totalConGuia > 0
```

**Caminos:**
- **TRUE:** Continua a actualizar Bigin
- **FALSE:** Genera mensaje "sin guias" y notifica

---

### 12. Split Ordenes
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Convierte el array de ordenes con guia en items individuales para procesar en loop

**Codigo JavaScript:**
```javascript
// Preparar items individuales para actualizar en Bigin
const data = $input.first().json;
const conGuia = data.conGuia || [];

return conGuia.map(item => ({ json: item }));
```

**Para MorfX:** Simplemente iterar sobre el array `conGuia`:
```javascript
for (const orden of resultado.conGuia) {
  await actualizarOrdenEnBigin(orden);
}
```

---

### 13. Refresh Token Update
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Obtiene un token fresco antes de actualizar (el anterior puede haber expirado)

**NOTA:** En n8n se hace por cada item del loop. En MorfX puedes optimizar obteniendo el token una vez si el proceso es rapido.

---

### 14. Bigin: Actualizar Orden
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Actualiza cada orden en Bigin con la guia real

**Request:**
```http
PUT https://www.zohoapis.com/bigin/v1/Deals/<biginId>

Headers:
  Authorization: Zoho-oauthtoken <access_token>
  Content-Type: application/json

Body:
{
  "data": [{
    "Guia": "53180509486",
    "Stage": "ENVIA"
  }]
}
```

**Response exitosa:**
```json
{
  "data": [{
    "code": "SUCCESS",
    "details": {
      "id": "5234234234234"
    },
    "message": "record updated",
    "status": "success"
  }]
}
```

**Para MorfX:**
```javascript
async function actualizarOrdenEnBigin(orden, accessToken) {
  const response = await fetch(
    `https://www.zohoapis.com/bigin/v1/Deals/${orden.biginId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          Guia: orden.numeroGuia,  // Guia REAL
          Stage: 'ENVIA'           // Nuevo stage
        }]
      })
    }
  );

  return await response.json();
}
```

---

### 15. Generar Resumen
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Genera el mensaje final con el resumen de lo procesado

**Codigo JavaScript:**
```javascript
// Generar resumen de actualizaciones
const items = $input.all();
const originalData = $('Procesar Resultados').first().json;

const exitosos = items.filter(i => i.json.data?.[0]?.code === 'SUCCESS').length;
const fallidos = items.length - exitosos;

let mensaje = `*Guias Coordinadora - Resumen*\n\n`;
mensaje += `Total ordenes procesadas: ${originalData.resultados?.length || 0}\n`;
mensaje += `Con guia encontrada: ${originalData.totalConGuia}\n`;
mensaje += `Sin guia aun: ${originalData.totalSinGuia}\n\n`;

if (exitosos > 0) {
  mensaje += `*${exitosos} orden(es) actualizada(s) en Bigin:*\n`;
  for (const item of originalData.conGuia || []) {
    mensaje += `• ${item.dealName}\n  Pedido: ${item.numeroPedido} → Guia: ${item.numeroGuia}\n`;
  }
}

if (originalData.totalSinGuia > 0) {
  mensaje += `\n*${originalData.totalSinGuia} sin guia (pendientes):*\n`;
  for (const item of originalData.sinGuia || []) {
    mensaje += `• ${item.dealName} - Pedido: ${item.numeroPedido}\n`;
  }
}

return [{ json: { mensaje } }];
```

**Output:**
```
*Guias Coordinadora - Resumen*

Total ordenes procesadas: 2
Con guia encontrada: 1
Sin guia aun: 1

*1 orden(es) actualizada(s) en Bigin:*
• Juan Perez - Kit Skincare
  Pedido: 9650 → Guia: 53180509486

*1 sin guia (pendientes):*
• Maria Garcia - Serum - Pedido: 9651
```

---

### 16. Mensaje Sin Guias
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Genera mensaje cuando no se encontraron guias

**Codigo JavaScript:**
```javascript
// Generar mensaje cuando no hay guias para actualizar
const data = $input.first().json;

let mensaje = `*Guias Coordinadora - Resultado*\n\n`;
mensaje += `Se buscaron ${data.resultados?.length || 0} ordenes.\n\n`;
mensaje += `*Ninguna tiene guia asignada aun:*\n`;

for (const item of data.sinGuia || []) {
  mensaje += `• ${item.dealName} - Pedido: ${item.numeroPedido}\n`;
}

mensaje += `\nCoordinadora aun no ha generado las guias. Intenta mas tarde.`;

return [{ json: { mensaje } }];
```

---

### 17. Slack: Resultado / Slack: Sin Guias
**Tipo:** `n8n-nodes-base.slack`

**Funcion:** Envia el mensaje final a Slack

**Configuracion:**
```json
{
  "select": "channel",
  "channelId": "C0A9M96C0AK",
  "text": "={{ $json.mensaje }}",
  "otherOptions": {
    "mrkdwn": true
  }
}
```

---

## Codigo Completo para MorfX

Aqui esta todo el flujo consolidado en una sola funcion:

```javascript
// ============================================
// FLUJO COMPLETO: INGRESAR GUIAS COORDINADORA
// ============================================

async function ingresarGuiasCoordinadora() {
  // ----------------------------------------
  // PASO 1: Obtener token de Bigin
  // ----------------------------------------
  const accessToken = await refreshBiginToken();
  console.log('Token obtenido');

  // ----------------------------------------
  // PASO 2: Buscar ordenes en COORDINADORA
  // ----------------------------------------
  const ordenes = await obtenerOrdenesCoordinadora(accessToken);

  if (!ordenes || ordenes.length === 0) {
    return {
      success: true,
      mensaje: 'No hay ordenes en el stage COORDINADORA'
    };
  }

  console.log(`Encontradas ${ordenes.length} ordenes`);

  // ----------------------------------------
  // PASO 3: Extraer numeros de pedido
  // ----------------------------------------
  const datos = extraerNumerosPedido(ordenes);

  if (datos.totalOrdenes === 0) {
    return {
      success: true,
      mensaje: 'No hay ordenes con # de pedido para buscar guias'
    };
  }

  console.log(`${datos.totalOrdenes} pedidos para buscar`);

  // ----------------------------------------
  // PASO 4: Llamar al robot
  // ----------------------------------------
  const robotResult = await buscarGuiasEnRobot(datos.numerosPedidos);

  // ----------------------------------------
  // PASO 5: Procesar resultados
  // ----------------------------------------
  const resultado = procesarResultados(robotResult, datos.ordenes);

  console.log(`Con guia: ${resultado.totalConGuia}, Sin guia: ${resultado.totalSinGuia}`);

  // ----------------------------------------
  // PASO 6: Actualizar Bigin
  // ----------------------------------------
  const actualizaciones = [];

  for (const orden of resultado.conGuia) {
    // Obtener token fresco (por seguridad)
    const token = await refreshBiginToken();
    const updateResult = await actualizarOrdenEnBigin(orden, token);
    actualizaciones.push({
      orden,
      resultado: updateResult
    });
  }

  // ----------------------------------------
  // PASO 7: Generar resumen
  // ----------------------------------------
  const exitosos = actualizaciones.filter(a =>
    a.resultado.data?.[0]?.code === 'SUCCESS'
  ).length;

  const mensaje = generarResumen(resultado, exitosos);

  return {
    success: true,
    totalProcesadas: datos.totalOrdenes,
    conGuia: resultado.totalConGuia,
    sinGuia: resultado.totalSinGuia,
    actualizadas: exitosos,
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

async function obtenerOrdenesCoordinadora(accessToken) {
  const response = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:COORDINADORA)',
    {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.data || [];
}

function extraerNumerosPedido(ordenes) {
  const pedidosParaBuscar = ordenes
    .filter(orden => orden.Guia && orden.Guia.trim().length > 0)
    .map(orden => ({
      biginId: orden.id,
      dealName: orden.Deal_Name,
      numeroPedido: orden.Guia.trim(),
      telefono: orden.Phone,
      stage: orden.Stage
    }));

  return {
    ordenes: pedidosParaBuscar,
    numerosPedidos: pedidosParaBuscar.map(p => p.numeroPedido),
    totalOrdenes: pedidosParaBuscar.length
  };
}

async function buscarGuiasEnRobot(numerosPedidos) {
  const response = await fetch('http://localhost:3001/api/buscar-guias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numerosPedidos }),
    signal: AbortSignal.timeout(180000)
  });

  return await response.json();
}

function procesarResultados(robotResult, ordenesOriginales) {
  const resultados = [];

  for (const robot of (robotResult.resultados || [])) {
    const ordenBigin = ordenesOriginales.find(o => o.numeroPedido === robot.numeroPedido);

    if (ordenBigin && robot.success && robot.numeroGuia) {
      resultados.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        numeroGuia: robot.numeroGuia,
        estadoCoord: robot.estado || '',
        tieneGuia: true
      });
    } else if (ordenBigin) {
      resultados.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        error: robot.error || 'Sin guia asignada',
        tieneGuia: false
      });
    }
  }

  return {
    resultados,
    conGuia: resultados.filter(r => r.tieneGuia),
    sinGuia: resultados.filter(r => !r.tieneGuia),
    totalConGuia: resultados.filter(r => r.tieneGuia).length,
    totalSinGuia: resultados.filter(r => !r.tieneGuia).length
  };
}

async function actualizarOrdenEnBigin(orden, accessToken) {
  const response = await fetch(
    `https://www.zohoapis.com/bigin/v1/Deals/${orden.biginId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          Guia: orden.numeroGuia,
          Stage: 'ENVIA'
        }]
      })
    }
  );

  return await response.json();
}

function generarResumen(resultado, exitosos) {
  let mensaje = `*Guias Coordinadora - Resumen*\n\n`;
  mensaje += `Total ordenes procesadas: ${resultado.resultados.length}\n`;
  mensaje += `Con guia encontrada: ${resultado.totalConGuia}\n`;
  mensaje += `Sin guia aun: ${resultado.totalSinGuia}\n\n`;

  if (exitosos > 0) {
    mensaje += `*${exitosos} orden(es) actualizada(s) en Bigin:*\n`;
    for (const item of resultado.conGuia) {
      mensaje += `• ${item.dealName}\n  Pedido: ${item.numeroPedido} → Guia: ${item.numeroGuia}\n`;
    }
  }

  if (resultado.totalSinGuia > 0) {
    mensaje += `\n*${resultado.totalSinGuia} sin guia (pendientes):*\n`;
    for (const item of resultado.sinGuia) {
      mensaje += `• ${item.dealName} - Pedido: ${item.numeroPedido}\n`;
    }
  }

  return mensaje;
}

// ============================================
// EJECUTAR
// ============================================
ingresarGuiasCoordinadora()
  .then(result => console.log(result))
  .catch(error => console.error('Error:', error));
```

---

## Variables de Entorno Necesarias

```env
# Bigin/Zoho OAuth2
BIGIN_REFRESH_TOKEN=1000.xxx...
BIGIN_CLIENT_ID=1000.XXX...
BIGIN_CLIENT_SECRET=xxx...

# Robot Coordinadora
ROBOT_URL=http://localhost:3001
```

---

## Resumen de Funcionalidades para MorfX

| Funcionalidad | Descripcion | Prioridad |
|---------------|-------------|-----------|
| OAuth2 Bigin | Obtener/refrescar access_token | ALTA |
| Buscar Deals | GET con criteria por Stage | ALTA |
| Llamar Robot | POST con timeout largo (3min) | ALTA |
| Actualizar Deal | PUT con Guia y Stage | ALTA |
| Notificaciones | Enviar resultados al usuario | MEDIA |
| Manejo de errores | Try/catch en cada paso | MEDIA |
| Logging | Registrar cada operacion | BAJA |
