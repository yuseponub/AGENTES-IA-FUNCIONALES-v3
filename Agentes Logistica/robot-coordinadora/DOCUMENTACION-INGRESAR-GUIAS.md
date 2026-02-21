# Robot Ingresar Guias Coordinadora - Documentacion Completa

> Documentacion tecnica para implementar el sistema de ingreso de guias de Coordinadora en la plataforma MorfX (sin n8n).

---

## Indice

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Arquitectura](#2-arquitectura)
3. [Flujo Completo](#3-flujo-completo)
4. [Componentes del Sistema](#4-componentes-del-sistema)
5. [API del Robot (Backend)](#5-api-del-robot-backend)
6. [Integracion con Bigin CRM](#6-integracion-con-bigin-crm)
7. [Automatizacion Web (Playwright)](#7-automatizacion-web-playwright)
8. [Implementacion para MorfX](#8-implementacion-para-morfx)
9. [Variables de Entorno](#9-variables-de-entorno)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Resumen del Sistema

### Que hace este robot?

Este robot **obtiene automaticamente los numeros de guia** de pedidos que ya fueron creados en Coordinadora. El flujo es:

1. Se tienen ordenes en Bigin CRM en el stage "COORDINADORA" (ya se creo el pedido, pero aun no tiene guia)
2. El robot entra al portal de Coordinadora (https://ff.coordinadora.com/panel/pedidos)
3. Busca cada pedido por su numero y extrae el numero de guia asignado por Coordinadora
4. Actualiza Bigin con el numero de guia real y cambia el stage a "ENVIA"

### Por que es necesario?

Cuando se crea un pedido en Coordinadora, el sistema asigna un **numero de pedido** inmediatamente, pero el **numero de guia** (numero de rastreo) se genera despues, cuando Coordinadora procesa el pedido. Este robot automatiza la obtencion de ese numero de guia.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIGGER (Slack/API)                          │
│  Comando: "ingresa guias coord" o llamada HTTP directa              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ORQUESTADOR (MorfX/n8n)                       │
│  1. Obtener token de Bigin (OAuth2)                                 │
│  2. Buscar ordenes en stage "COORDINADORA"                          │
│  3. Extraer numeros de pedido                                       │
│  4. Llamar al Robot para buscar guias                               │
│  5. Actualizar Bigin con las guias encontradas                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ROBOT (coordinadora-bot:3001)                    │
│  - Servidor Express en puerto 3001                                  │
│  - Usa Playwright para automatizar navegador                        │
│  - Login en portal Coordinadora                                     │
│  - Navega a /panel/pedidos                                          │
│  - Busca pedidos y extrae guias de la tabla                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          BIGIN CRM                                  │
│  - Recibe actualizacion via API                                     │
│  - Campo "Guia" = numero de guia real                               │
│  - Stage cambia de "COORDINADORA" a "ENVIA"                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo Completo

### Paso a Paso Detallado

#### PASO 1: Trigger
- En n8n: Slack Trigger detecta mensaje "ingresa guias coord"
- En MorfX: API endpoint o webhook recibe la solicitud

#### PASO 2: Obtener Token de Bigin
```http
POST https://accounts.zoho.com/oauth/v2/token

Query Parameters:
  refresh_token: <TU_REFRESH_TOKEN>
  client_id: <TU_CLIENT_ID>
  client_secret: <TU_CLIENT_SECRET>
  grant_type: refresh_token

Response:
{
  "access_token": "1000.xxx...",
  "expires_in": 3600,
  "api_domain": "https://www.zohoapis.com",
  "token_type": "Bearer"
}
```

#### PASO 3: Buscar Ordenes en Bigin
```http
GET https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:COORDINADORA)

Headers:
  Authorization: Zoho-oauthtoken <access_token>

Response:
{
  "data": [
    {
      "id": "5234234234234",
      "Deal_Name": "Juan Perez - Kit Skincare",
      "Guia": "9650",           // <-- Este es el # de PEDIDO (temporal)
      "Phone": "3163709528",
      "Stage": "COORDINADORA"
    },
    ...
  ]
}
```

**IMPORTANTE**: El campo `Guia` en este stage contiene el **numero de pedido** de Coordinadora (no la guia real). Este numero se usa para buscar la guia en el portal.

#### PASO 4: Extraer Numeros de Pedido
```javascript
// Logica de extraccion
const ordenes = response.data || [];

const pedidosParaBuscar = ordenes
  .filter(orden => orden.Guia && orden.Guia.trim().length > 0)
  .map(orden => ({
    biginId: orden.id,
    dealName: orden.Deal_Name,
    numeroPedido: orden.Guia.trim(),  // # de pedido de Coordinadora
    telefono: orden.Phone,
    stage: orden.Stage
  }));

// Extraer solo los numeros
const numerosPedidos = pedidosParaBuscar.map(p => p.numeroPedido);
// Resultado: ["9650", "9651", "9652"]
```

#### PASO 5: Llamar al Robot
```http
POST http://localhost:3001/api/buscar-guias

Headers:
  Content-Type: application/json

Body:
{
  "numerosPedidos": ["9650", "9651", "9652"]
}

Response:
{
  "success": true,
  "total": 3,
  "encontrados": 2,
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
      "numeroGuia": "53180509487",
      "estado": "Recogido",
      "success": true
    },
    {
      "numeroPedido": "9652",
      "success": false,
      "error": "Pedido encontrado pero sin guia asignada"
    }
  ]
}
```

#### PASO 6: Combinar Resultados
```javascript
// Combinar datos del robot con datos de Bigin
const resultados = [];

for (const robot of robotResponse.resultados) {
  const ordenBigin = ordenesOriginales.find(o => o.numeroPedido === robot.numeroPedido);

  if (ordenBigin && robot.success && robot.numeroGuia) {
    resultados.push({
      biginId: ordenBigin.biginId,
      dealName: ordenBigin.dealName,
      numeroPedido: robot.numeroPedido,
      numeroGuia: robot.numeroGuia,        // <-- Guia REAL
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
```

#### PASO 7: Actualizar Bigin
Para cada orden con guia encontrada:

```http
PUT https://www.zohoapis.com/bigin/v1/Deals/<biginId>

Headers:
  Authorization: Zoho-oauthtoken <access_token>
  Content-Type: application/json

Body:
{
  "data": [{
    "Guia": "53180509486",    // <-- Guia REAL (reemplaza el # de pedido)
    "Stage": "ENVIA"          // <-- Nuevo stage
  }]
}
```

#### PASO 8: Generar Reporte
```javascript
let mensaje = `*Guias Coordinadora - Resumen*\n\n`;
mensaje += `Total ordenes procesadas: ${resultados.length}\n`;
mensaje += `Con guia encontrada: ${conGuia.length}\n`;
mensaje += `Sin guia aun: ${sinGuia.length}\n\n`;

if (conGuia.length > 0) {
  mensaje += `*Ordenes actualizadas en Bigin:*\n`;
  for (const item of conGuia) {
    mensaje += `• ${item.dealName}\n  Pedido: ${item.numeroPedido} → Guia: ${item.numeroGuia}\n`;
  }
}

if (sinGuia.length > 0) {
  mensaje += `\n*Pendientes (sin guia):*\n`;
  for (const item of sinGuia) {
    mensaje += `• ${item.dealName} - Pedido: ${item.numeroPedido}\n`;
  }
}
```

---

## 4. Componentes del Sistema

### 4.1 Estructura de Archivos

```
coordinadora-bot/
├── src/
│   ├── api/
│   │   └── server.ts          # Servidor Express (API REST)
│   ├── adapters/
│   │   ├── coordinadora-adapter.ts  # Automatizacion Playwright
│   │   └── bigin-adapter.ts         # (Opcional) Cliente Bigin
│   ├── types/
│   │   └── index.ts           # Interfaces TypeScript
│   └── index.ts               # Orquestador (si se usa standalone)
├── n8n/
│   └── Ingresar-Guias-Coordinadora.json  # Workflow de n8n
├── storage/
│   └── sessions/
│       └── coordinadora-cookies.json     # Cookies de sesion
├── ciudades-coordinadora.txt  # Lista de ciudades validas
├── ciudades-SI-recaudo.txt    # Ciudades con recaudo
├── .env                       # Variables de entorno
├── package.json
└── tsconfig.json
```

### 4.2 Dependencias

```json
{
  "dependencies": {
    "playwright": "^1.40.0",    // Automatizacion de navegador
    "express": "^4.18.2",       // Servidor HTTP
    "dotenv": "^16.3.1"         // Variables de entorno
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",            // Ejecutar TypeScript directo
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21"
  }
}
```

---

## 5. API del Robot (Backend)

### 5.1 Endpoints Disponibles

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servicio |
| POST | `/api/buscar-guia` | Buscar guia de un pedido |
| POST | `/api/buscar-guias` | Buscar guias de multiples pedidos |
| POST | `/api/crear-pedido` | Crear pedido en Coordinadora |
| GET | `/api/ultimo-pedido` | Obtener ultimo # de pedido |

### 5.2 POST /api/buscar-guias (Principal)

**Request:**
```json
{
  "numerosPedidos": ["9650", "9651", "9652"]
}
```

**Response Exitosa:**
```json
{
  "success": true,
  "total": 3,
  "encontrados": 2,
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
      "numeroGuia": "53180509487",
      "estado": "Recogido",
      "success": true
    },
    {
      "numeroPedido": "9652",
      "success": false,
      "error": "Pedido encontrado pero sin guia asignada"
    }
  ]
}
```

### 5.3 POST /api/buscar-guia (Individual)

**Request:**
```json
{
  "numeroPedido": "9650"
}
```

**Response:**
```json
{
  "success": true,
  "numeroGuia": "53180509486",
  "estado": "En terminal origen"
}
```

### 5.4 Codigo del Servidor (server.ts)

```typescript
// Endpoint principal para buscar multiples guias
app.post('/api/buscar-guias', async (req, res) => {
  const { numerosPedidos } = req.body;

  if (!Array.isArray(numerosPedidos) || numerosPedidos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un array de numerosPedidos',
    });
  }

  let coordinadora: CoordinadoraAdapter | null = null;

  try {
    // Crear instancia del adapter (abre navegador + login)
    coordinadora = await createAdapter();

    // Buscar todas las guias
    const resultados = await coordinadora.buscarGuiasPorPedidos(
      numerosPedidos.map((n: any) => n.toString())
    );

    const exitosos = resultados.filter(r => r.success);
    const fallidos = resultados.filter(r => !r.success);

    res.json({
      success: true,
      total: numerosPedidos.length,
      encontrados: exitosos.length,
      sinGuia: fallidos.length,
      resultados,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  } finally {
    // Siempre cerrar el navegador
    if (coordinadora) {
      await coordinadora.close();
    }
  }
});
```

---

## 6. Integracion con Bigin CRM

### 6.1 Autenticacion OAuth2

Bigin usa OAuth2. Necesitas:

1. **Client ID**: Desde Zoho API Console
2. **Client Secret**: Desde Zoho API Console
3. **Refresh Token**: Generado una vez, dura indefinidamente

**Obtener Access Token:**
```http
POST https://accounts.zoho.com/oauth/v2/token

Query Parameters:
  refresh_token=1000.xxx...
  client_id=1000.XXX...
  client_secret=xxx...
  grant_type=refresh_token
```

### 6.2 Buscar Ordenes por Stage

```http
GET https://www.zohoapis.com/bigin/v1/Deals/search

Query Parameters:
  criteria=(Stage:equals:COORDINADORA)

Headers:
  Authorization: Zoho-oauthtoken <access_token>
```

### 6.3 Actualizar Orden

```http
PUT https://www.zohoapis.com/bigin/v1/Deals/<deal_id>

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

### 6.4 Campos de Bigin Utilizados

| Campo | Uso |
|-------|-----|
| `id` | ID unico del deal |
| `Deal_Name` | Nombre del cliente/pedido |
| `Guia` | Temporal: # pedido. Final: # guia real |
| `Phone` | Telefono del cliente |
| `Stage` | Estado del pedido |

### 6.5 Stages del Pipeline

| Stage | Significado |
|-------|-------------|
| ROBOT COORD | Listo para crear pedido |
| COORDINADORA | Pedido creado, esperando guia |
| ENVIA | Guia asignada, despachado |

---

## 7. Automatizacion Web (Playwright)

### 7.1 Como Funciona el Robot

El robot usa **Playwright** para:

1. Abrir navegador Chrome headless
2. Cargar cookies de sesion previas (si existen)
3. Navegar a https://ff.coordinadora.com/
4. Hacer login si es necesario
5. Ir a /panel/pedidos
6. Buscar pedidos en la tabla
7. Extraer numero de guia de cada fila

### 7.2 Estructura de la Tabla en Coordinadora

La tabla de pedidos tiene esta estructura:

| Pedido | Guia | Almacen | Fecha | Nombre | ... | Estado |
|--------|------|---------|-------|--------|-----|--------|
| 9650 | 53180509486 | ... | ... | ... | ... | En terminal |
| 9651 | 53180509487 | ... | ... | ... | ... | Recogido |

- **Columna 0**: Numero de pedido (link)
- **Columna 1**: Numero de guia
- **Columna 6**: Estado del envio

### 7.3 Selectores CSS Usados

```typescript
const CoordinadoraSelectors = {
  login: {
    userInput: 'input[name="usuario"]',
    passwordInput: 'input[name="clave"]',
    loginButton: 'button:has-text("Ingresar")',
  },
  pedidosList: {
    dataGrid: '.MuiDataGrid-root',
    firstPedidoLink: '.MuiDataGrid-cell a',
    cellWithNumber: '[role="cell"] a',
  },
};
```

### 7.4 Metodo de Busqueda de Guias

```typescript
async buscarGuiasPorPedidos(numerosPedidos: string[]): Promise<ResultadoBusqueda[]> {
  const resultados = [];

  // Navegar a la pagina de pedidos
  await this.page.goto('https://ff.coordinadora.com/panel/pedidos');
  await this.page.waitForTimeout(3000);

  // Obtener todas las filas de la tabla
  const rows = await this.page.$$('table tbody tr');

  // Crear mapa de pedido -> guia
  const pedidosEnTabla = new Map();

  for (const row of rows) {
    const cells = await row.$$('td');
    if (cells.length >= 2) {
      const pedidoLink = await cells[0].$('a');
      if (pedidoLink) {
        const pedidoText = await pedidoLink.textContent();
        const guiaText = await cells[1].textContent();

        if (pedidoText && guiaText) {
          pedidosEnTabla.set(pedidoText.trim(), {
            guia: guiaText.trim(),
            estado: cells[6] ? await cells[6].textContent() : ''
          });
        }
      }
    }
  }

  // Buscar cada pedido solicitado
  for (const numeroPedido of numerosPedidos) {
    const info = pedidosEnTabla.get(numeroPedido);

    if (info && info.guia && info.guia.length > 5) {
      resultados.push({
        numeroPedido,
        numeroGuia: info.guia,
        estado: info.estado,
        success: true
      });
    } else {
      resultados.push({
        numeroPedido,
        success: false,
        error: 'Sin guia asignada'
      });
    }
  }

  return resultados;
}
```

---

## 8. Implementacion para MorfX

### 8.1 Resumen de lo que MorfX debe hacer

MorfX necesita replicar el flujo de n8n. Aqui esta el pseudocodigo completo:

```typescript
async function ingresarGuiasCoordinadora() {
  // PASO 1: Obtener token de Bigin
  const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    body: new URLSearchParams({
      refresh_token: BIGIN_REFRESH_TOKEN,
      client_id: BIGIN_CLIENT_ID,
      client_secret: BIGIN_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const { access_token } = await tokenResponse.json();

  // PASO 2: Buscar ordenes en stage COORDINADORA
  const ordenesResponse = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:COORDINADORA)',
    {
      headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
    }
  );
  const { data: ordenes } = await ordenesResponse.json();

  if (!ordenes || ordenes.length === 0) {
    return { mensaje: 'No hay ordenes en stage COORDINADORA' };
  }

  // PASO 3: Extraer numeros de pedido
  const pedidosParaBuscar = ordenes
    .filter(o => o.Guia && o.Guia.trim().length > 0)
    .map(o => ({
      biginId: o.id,
      dealName: o.Deal_Name,
      numeroPedido: o.Guia.trim()
    }));

  if (pedidosParaBuscar.length === 0) {
    return { mensaje: 'No hay ordenes con numero de pedido' };
  }

  // PASO 4: Llamar al robot para buscar guias
  const robotResponse = await fetch('http://localhost:3001/api/buscar-guias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numerosPedidos: pedidosParaBuscar.map(p => p.numeroPedido)
    })
  });
  const robotData = await robotResponse.json();

  // PASO 5: Combinar resultados
  const conGuia = [];
  const sinGuia = [];

  for (const robot of robotData.resultados) {
    const ordenBigin = pedidosParaBuscar.find(p => p.numeroPedido === robot.numeroPedido);

    if (ordenBigin && robot.success && robot.numeroGuia) {
      conGuia.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        numeroGuia: robot.numeroGuia
      });
    } else if (ordenBigin) {
      sinGuia.push({
        biginId: ordenBigin.biginId,
        dealName: ordenBigin.dealName,
        numeroPedido: robot.numeroPedido,
        error: robot.error
      });
    }
  }

  // PASO 6: Actualizar Bigin para cada orden con guia
  const actualizaciones = [];

  for (const orden of conGuia) {
    // Obtener nuevo token (puede haber expirado)
    const newTokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      body: new URLSearchParams({
        refresh_token: BIGIN_REFRESH_TOKEN,
        client_id: BIGIN_CLIENT_ID,
        client_secret: BIGIN_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });
    const { access_token: newToken } = await newTokenResponse.json();

    // Actualizar deal en Bigin
    const updateResponse = await fetch(
      `https://www.zohoapis.com/bigin/v1/Deals/${orden.biginId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Zoho-oauthtoken ${newToken}`,
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

    actualizaciones.push(await updateResponse.json());
  }

  // PASO 7: Generar reporte
  return {
    totalProcesadas: pedidosParaBuscar.length,
    conGuia: conGuia.length,
    sinGuia: sinGuia.length,
    ordenesActualizadas: conGuia,
    ordenesPendientes: sinGuia
  };
}
```

### 8.2 Diagrama de Secuencia

```
MorfX                  Bigin API              Robot (3001)          Coordinadora
  |                        |                       |                     |
  |------ GET token ------>|                       |                     |
  |<----- access_token ----|                       |                     |
  |                        |                       |                     |
  |------ GET ordenes ---->|                       |                     |
  |<----- [ordenes] -------|                       |                     |
  |                        |                       |                     |
  |                        |------ POST /api/buscar-guias ------------>|
  |                        |                       |------ login ------>|
  |                        |                       |<----- ok ---------|
  |                        |                       |------ scrape ---->|
  |                        |                       |<----- tabla ------|
  |                        |<----- resultados -----|                    |
  |<----- resultados ------|                       |                     |
  |                        |                       |                     |
  | [para cada guia]       |                       |                     |
  |------ PUT deal ------->|                       |                     |
  |<----- ok --------------|                       |                     |
  |                        |                       |                     |
```

### 8.3 Consideraciones para MorfX

1. **El robot debe estar corriendo** en `localhost:3001` o en un servidor accesible
2. **Timeout largo**: El robot puede tardar 30-60 segundos en buscar guias
3. **Manejo de errores**: Si el robot falla, no actualizar Bigin
4. **Refresh token**: Obtener nuevo token antes de cada operacion PUT
5. **Rate limiting**: Bigin tiene limites, hacer pausas entre actualizaciones

### 8.4 Ejemplo de Integracion con Webhook

Si MorfX usa webhooks, puedes crear un endpoint:

```typescript
// En MorfX
app.post('/webhook/ingresar-guias-coord', async (req, res) => {
  try {
    const resultado = await ingresarGuiasCoordinadora();

    // Enviar a Slack o notificar
    await enviarNotificacion(resultado);

    res.json({ success: true, ...resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## 9. Variables de Entorno

### 9.1 Robot (coordinadora-bot/.env)

```env
# Portal Coordinadora
COORDINADORA_URL=https://ff.coordinadora.com/
COORDINADORA_USER=<tu_usuario>
COORDINADORA_PASSWORD=<tu_password>

# Puerto del servidor
PORT=3001
```

### 9.2 MorfX (o donde corras el orquestador)

```env
# Bigin OAuth2
BIGIN_REFRESH_TOKEN=1000.xxx...
BIGIN_CLIENT_ID=1000.XXX...
BIGIN_CLIENT_SECRET=xxx...

# URL del robot
ROBOT_COORDINADORA_URL=http://localhost:3001
```

---

## 10. Troubleshooting

### 10.1 Robot no encuentra guias

**Causa**: Coordinadora aun no ha generado las guias (especialmente fines de semana)

**Solucion**: Reintentar mas tarde. El robot devolvera `success: false` con mensaje "sin guia asignada"

### 10.2 Login falla

**Causa**: Credenciales incorrectas o sesion expirada

**Solucion**:
1. Verificar credenciales en .env
2. Eliminar `storage/sessions/coordinadora-cookies.json` para forzar nuevo login

### 10.3 Timeout en busqueda

**Causa**: Coordinadora esta lento o hay muchos pedidos

**Solucion**: Aumentar timeout en la llamada HTTP a 3 minutos:
```typescript
await fetch('http://localhost:3001/api/buscar-guias', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ numerosPedidos }),
  signal: AbortSignal.timeout(180000)  // 3 minutos
});
```

### 10.4 Bigin devuelve 401

**Causa**: Token expirado

**Solucion**: Siempre obtener nuevo token antes de cada operacion:
```typescript
// Token expira en 1 hora, obtener uno nuevo cada vez
const token = await obtenerNuevoToken();
```

### 10.5 No encuentra ordenes en Bigin

**Causa**: Las ordenes no estan en stage "COORDINADORA" o el criteria es incorrecto

**Solucion**: Verificar el stage exacto en Bigin. El criteria es case-sensitive:
```
criteria=(Stage:equals:COORDINADORA)
```

---

## Resumen Final

Para implementar en MorfX sin n8n:

1. **Mantener el robot corriendo** (`npm run api` en coordinadora-bot)
2. **Implementar la logica del orquestador** (los 7 pasos del flujo)
3. **Integrar con Bigin API** (OAuth2 + REST)
4. **Llamar al robot** (`POST /api/buscar-guias`)
5. **Actualizar Bigin** con las guias encontradas

El robot hace el trabajo pesado (scraping). MorfX solo necesita orquestar las llamadas HTTP.
