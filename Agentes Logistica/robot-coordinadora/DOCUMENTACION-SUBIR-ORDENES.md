# Robot Subir Ordenes Coordinadora - Documentacion Completa

> Documentacion tecnica para crear pedidos en Coordinadora desde Bigin CRM

---

## Indice

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Arquitectura](#2-arquitectura)
3. [Flujo Completo](#3-flujo-completo)
4. [API del Robot](#4-api-del-robot)
5. [Procesamiento con Claude AI](#5-procesamiento-con-claude-ai)
6. [Validacion de Ciudades](#6-validacion-de-ciudades)
7. [Implementacion para MorfX](#7-implementacion-para-morfx)
8. [Variables de Entorno](#8-variables-de-entorno)

---

## 1. Resumen del Sistema

### Que hace este robot?

Este robot **crea pedidos automaticamente** en el portal de Coordinadora a partir de ordenes de Bigin CRM. El flujo es:

1. Se tienen ordenes en Bigin en el stage "ROBOT COORD" (listas para enviar)
2. Claude AI procesa y limpia los datos (telefono, nombre, direccion, etc.)
3. Se valida que la ciudad exista en Coordinadora y acepte recaudo (si aplica)
4. El robot usa Playwright para llenar el formulario en el portal de Coordinadora
5. Se guarda el numero de pedido generado
6. Las ordenes quedan listas para el siguiente paso (ingresar guias)

### Diferencia con "Ingresar Guias"

| Robot | Funcion | Stage Origen | Stage Destino |
|-------|---------|--------------|---------------|
| **Subir Ordenes** | Crea el pedido en Coordinadora | ROBOT COORD | COORDINADORA |
| **Ingresar Guias** | Obtiene la guia del pedido creado | COORDINADORA | ENVIA |

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIGGER (Slack/API)                          │
│  Comando: "subir ordenes coord"                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          BIGIN CRM                                  │
│  Buscar ordenes en stage "ROBOT COORD"                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAUDE AI                                   │
│  - Limpiar telefonos (quitar +57, espacios)                        │
│  - Separar nombres y apellidos                                      │
│  - Calcular unidades segun precio                                   │
│  - Determinar si es recaudo o pago anticipado                      │
│  - Normalizar direcciones                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ROBOT (coordinadora-bot:3001)                    │
│  1. POST /api/validar-pedidos → Validar ciudades                   │
│  2. POST /api/crear-pedido → Crear pedido con Playwright           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PORTAL COORDINADORA                             │
│  https://ff.coordinadora.com/panel/agregar_pedidos/coordinadora    │
│  - Login automatico                                                 │
│  - Llenar formulario                                                │
│  - Obtener # de pedido                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo Completo

### Diagrama del Workflow n8n

```
┌──────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│ Slack Trigger├───►│ Filtrar Mensaje ├───►│ Bigin: Obtener Ordenes │
└──────────────┘    └─────────────────┘    └────────────┬───────────┘
                                                        │
                    ┌───────────────────────────────────┘
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
│ Claude: Procesar   │  │ Slack: Sin      │
│ Datos (AI)         │  │ Ordenes         │
└────────┬───────────┘  └─────────────────┘
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
│ (Robot API)        │
└────────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Ciudad Valida?   │
  └──────┬───────────┘
         │
    ┌────┴────┐
    │ SI      │ NO
    ▼         ▼
┌────────────────┐  ┌─────────────────────┐
│ Robot: Crear   │  │ Error: Ciudad       │
│ Pedido         │  │ Invalida            │
└───────┬────────┘  └──────────┬──────────┘
        │                      │
        ▼                      │
┌────────────────┐             │
│ Generar        │             │
│ Resumen        │             │
└───────┬────────┘             │
        │                      │
        └──────────┬───────────┘
                   │
                   ▼
          ┌────────────────┐
          │ Unir Resultados│
          └───────┬────────┘
                  │
                  ▼
          ┌────────────────────┐
          │ Combinar Mensajes  │
          └───────┬────────────┘
                  │
                  ▼
          ┌────────────────────┐
          │ Slack: Resultado   │
          └────────────────────┘
```

---

## 4. API del Robot

### 4.1 POST /api/validar-pedidos

Valida que las ciudades existan en Coordinadora y soporten recaudo.

**Request:**
```json
{
  "pedidos": [
    {
      "ciudad": "MEDELLIN",
      "departamento": "ANTIOQUIA",
      "esRecaudoContraentrega": true,
      "biginOrderName": "Juan Perez"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 1,
  "validos": 1,
  "invalidos": 0,
  "pedidos": [
    {
      "ciudad": "MEDELLIN (ANT)",
      "departamento": "ANTIOQUIA",
      "esRecaudoContraentrega": true,
      "biginOrderName": "Juan Perez",
      "_valido": true,
      "_aceptaRecaudo": true
    }
  ]
}
```

**Errores posibles:**
```json
{
  "_valido": false,
  "_error": "No se encontro el municipio 'XXXXX' en 'DEPARTAMENTO'"
}
```
```json
{
  "_valido": false,
  "_error": "CIUDAD (DEPTO) NO acepta recaudo contraentrega"
}
```

### 4.2 POST /api/crear-pedido

Crea un pedido en el portal de Coordinadora.

**Request:**
```json
{
  "identificacion": "3163709528",
  "nombres": "Juan",
  "apellidos": "Perez Garcia",
  "direccion": "Calle 45 #23-15 Apto 302",
  "ciudad": "MEDELLIN (ANT)",
  "departamento": "ANTIOQUIA",
  "celular": "3163709528",
  "email": "juan@email.com",
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
```

**Response Exitosa:**
```json
{
  "success": true,
  "numeroPedido": "9650",
  "mensaje": "Pedido 9650 creado exitosamente",
  "biginOrderId": "5234234234234"
}
```

**Response Error:**
```json
{
  "success": false,
  "error": "El municipio CIUDAD NO permite recaudo contraentrega",
  "biginOrderId": "5234234234234"
}
```

### 4.3 Campos del Pedido

| Campo | Tipo | Descripcion | Ejemplo |
|-------|------|-------------|---------|
| `identificacion` | string | Telefono (10 digitos) | "3163709528" |
| `nombres` | string | Primer nombre | "Juan" |
| `apellidos` | string | Apellidos | "Perez Garcia" |
| `direccion` | string | Direccion completa | "Calle 45 #23-15" |
| `ciudad` | string | Municipio normalizado | "MEDELLIN (ANT)" |
| `departamento` | string | Departamento | "ANTIOQUIA" |
| `celular` | string | Telefono (10 digitos) | "3163709528" |
| `email` | string? | Email opcional | "juan@email.com" |
| `referencia` | string | Siempre "AA1" | "AA1" |
| `unidades` | number | 1, 2 o 3 | 1 |
| `totalConIva` | number | Valor a cobrar | 77900 |
| `valorDeclarado` | number | Siempre 55000 | 55000 |
| `esRecaudoContraentrega` | boolean | Cobrar al entregar | true |
| `peso` | number | Peso en kg | 0.08 |
| `alto` | number | Altura en cm | 5 |
| `largo` | number | Largo en cm | 5 |
| `ancho` | number | Ancho en cm | 10 |
| `biginOrderId` | string | ID del deal en Bigin | "5234234234234" |
| `biginOrderName` | string | Nombre del deal | "Juan Perez - Kit" |

---

## 5. Procesamiento con Claude AI

### 5.1 Por que se usa Claude?

Los datos de Bigin vienen "sucios" y necesitan limpieza:

| Problema | Solucion de Claude |
|----------|-------------------|
| Telefono: "+57 316 370 9528" | Limpiar a "3163709528" |
| Nombre: "Juan Perez Garcia" | Separar en nombres/apellidos |
| Precio: 77900, 109900, 139900 | Calcular unidades (1, 2, 3) |
| Nombre con "&" o "PAGO ANTICIPADO" | Marcar como NO recaudo |

### 5.2 System Prompt de Claude

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

### 5.3 Ejemplo de Transformacion

**Input (de Bigin):**
```json
{
  "id": "5234234234234",
  "Deal_Name": "Juan Perez Garcia - Kit Skincare Premium",
  "Phone": "+57 316 370 9528",
  "Direccion": "calle 45 #23-15 apto 302",
  "Municipio": "Medellin",
  "Departamento": "Antioquia",
  "Amount": 77900,
  "Stage": "ROBOT COORD"
}
```

**Output (de Claude):**
```json
{
  "identificacion": "3163709528",
  "nombres": "Juan",
  "apellidos": "Perez Garcia",
  "direccion": "calle 45 #23-15 apto 302",
  "ciudad": "MEDELLIN",
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
  "biginOrderName": "Juan Perez Garcia - Kit Skincare Premium"
}
```

### 5.4 Parsear Respuesta de Claude

```javascript
// Claude puede devolver el JSON con texto alrededor
// Este codigo extrae solo el array JSON

const response = claudeResponse;
let pedidos = [];

try {
  const content = response.message?.content || response.content || response.text;

  // Buscar el array JSON en la respuesta
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);

  if (jsonMatch) {
    pedidos = JSON.parse(jsonMatch[0]);
  }
} catch (e) {
  console.error('Error parseando respuesta:', e);
}
```

---

## 6. Validacion de Ciudades

### 6.1 Por que validar?

1. **Ciudades inexistentes**: El usuario puede escribir mal el nombre
2. **Recaudo no disponible**: No todas las ciudades aceptan pago contraentrega
3. **Formato incorrecto**: Coordinadora espera "CIUDAD (DEPTO)"

### 6.2 Lista de Ciudades

El robot carga dos archivos al iniciar:

- `ciudades-coordinadora.txt`: 1488 ciudades totales
- `ciudades-SI-recaudo.txt`: 1181 ciudades con recaudo

### 6.3 Mapeo de Departamentos

Coordinadora usa abreviaturas:

```javascript
const MAPEO_DEPARTAMENTOS = {
  'ANTIOQUIA': 'ANT',
  'ATLANTICO': 'ATL',
  'BOLIVAR': 'BOL',
  'BOYACA': 'BOY',
  'CUNDINAMARCA': 'C/MARCA',
  'BOGOTA': 'C/MARCA',
  'VALLE DEL CAUCA': 'VALLE',
  'NORTE DE SANTANDER': 'N/STDER',
  // ... etc
};
```

### 6.4 Logica de Validacion

```javascript
function validarCiudad(municipio, departamento, esRecaudo) {
  // 1. Normalizar (quitar acentos, mayusculas)
  const municipioNorm = normalizar(municipio);
  const deptoNorm = normalizar(departamento);

  // 2. Obtener abreviatura del departamento
  const abrevDepto = MAPEO_DEPARTAMENTOS[deptoNorm] || deptoNorm;

  // 3. Buscar ciudad exacta: "MUNICIPIO (ABREV)"
  const busqueda = `${municipioNorm} (${abrevDepto})`;
  const ciudadExacta = todasLasCiudades.find(c => normalizar(c) === busqueda);

  if (!ciudadExacta) {
    return { valido: false, error: `No se encontro ${municipio} en ${departamento}` };
  }

  // 4. Verificar recaudo si aplica
  if (esRecaudo && !ciudadesConRecaudo.has(ciudadExacta)) {
    return { valido: false, error: `${ciudadExacta} NO acepta recaudo` };
  }

  return { valido: true, ciudadExacta };
}
```

---

## 7. Implementacion para MorfX

### 7.1 Codigo Completo

```javascript
// ============================================
// FLUJO COMPLETO: SUBIR ORDENES COORDINADORA
// ============================================

async function subirOrdenesCoordinadora() {
  // ----------------------------------------
  // PASO 1: Obtener token de Bigin
  // ----------------------------------------
  const accessToken = await refreshBiginToken();
  console.log('Token obtenido');

  // ----------------------------------------
  // PASO 2: Buscar ordenes en ROBOT COORD
  // ----------------------------------------
  const ordenes = await obtenerOrdenesRobotCoord(accessToken);

  if (!ordenes || ordenes.length === 0) {
    return {
      success: true,
      mensaje: 'No hay ordenes en el stage ROBOT COORD'
    };
  }

  console.log(`Encontradas ${ordenes.length} ordenes`);

  // ----------------------------------------
  // PASO 3: Procesar con Claude AI
  // ----------------------------------------
  const pedidosProcesados = await procesarConClaude(ordenes);

  if (!pedidosProcesados || pedidosProcesados.length === 0) {
    return {
      success: false,
      mensaje: 'Error procesando ordenes con Claude'
    };
  }

  console.log(`${pedidosProcesados.length} pedidos procesados por Claude`);

  // ----------------------------------------
  // PASO 4: Validar ciudades
  // ----------------------------------------
  const pedidosValidados = await validarCiudades(pedidosProcesados);

  const validos = pedidosValidados.filter(p => p._valido);
  const invalidos = pedidosValidados.filter(p => !p._valido);

  console.log(`Validos: ${validos.length}, Invalidos: ${invalidos.length}`);

  // ----------------------------------------
  // PASO 5: Crear pedidos en Coordinadora
  // ----------------------------------------
  const resultados = [];

  for (const pedido of validos) {
    const resultado = await crearPedidoEnCoordinadora(pedido);
    resultados.push({
      pedido,
      resultado
    });

    // Pausa entre pedidos
    await sleep(2000);
  }

  // ----------------------------------------
  // PASO 6: Actualizar Bigin con # de pedido
  // ----------------------------------------
  const token = await refreshBiginToken();

  for (const { pedido, resultado } of resultados) {
    if (resultado.success) {
      await actualizarBiginConPedido(
        pedido.biginOrderId,
        resultado.numeroPedido,
        token
      );
    }
  }

  // ----------------------------------------
  // PASO 7: Generar resumen
  // ----------------------------------------
  const exitosos = resultados.filter(r => r.resultado.success);
  const fallidos = resultados.filter(r => !r.resultado.success);

  const mensaje = generarResumenSubirOrdenes(exitosos, fallidos, invalidos);

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
  // IMPORTANTE: El stage es "ROBOT COORD" (con espacio)
  const response = await fetch(
    'https://www.zohoapis.com/bigin/v1/Deals/search?criteria=(Stage:equals:ROBOT COORD)',
    {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.data || [];
}

async function procesarConClaude(ordenes) {
  const systemPrompt = `Procesas ordenes de Bigin para Coordinadora.

REGLAS:

1. TELEFONO: Quitar 57 del inicio, quitar espacios/guiones. Debe ser 10 digitos.
   Ej: "+57 316 3709528" → "3163709528"

2. NOMBRE: Primera palabra = nombres, resto = apellidos. Si solo hay una, apellidos = "Cliente"

3. UNIDADES: 77900→1, 109900→2, 139900→3. Si otro valor, buscar "(X unidades)" en descripcion.

4. RECAUDO: Si nombre tiene "&" o tag "PAGO ANTICIPADO" → false. Sino → true

5. CIUDAD: Poner el municipio en MAYUSCULAS tal cual viene.

6. DEPARTAMENTO: Poner el departamento en MAYUSCULAS tal cual viene.

7. VALORES FIJOS: referencia="AA1", valorDeclarado=55000, peso=0.08, alto=5, largo=5, ancho=10, totalIva=0

Devuelve SOLO JSON array, sin explicacion.`;

  const userMessage = `Procesa estas ordenes de Bigin:\n\n${JSON.stringify(ordenes, null, 2)}`;

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
      messages: [
        { role: 'user', content: userMessage }
      ],
      system: systemPrompt
    })
  });

  const data = await response.json();
  const content = data.content[0].text;

  // Extraer JSON de la respuesta
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
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
    signal: AbortSignal.timeout(120000) // 2 minutos
  });

  return await response.json();
}

async function actualizarBiginConPedido(biginId, numeroPedido, accessToken) {
  // Guardar el # de pedido en el campo "Guia" temporalmente
  // y cambiar stage a "COORDINADORA"
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
          Guia: numeroPedido,      // # de pedido (temporal)
          Stage: 'COORDINADORA'    // Nuevo stage
        }]
      })
    }
  );

  return await response.json();
}

function generarResumenSubirOrdenes(exitosos, fallidos, invalidos) {
  let mensaje = '*Subir Ordenes Coordinadora - Resumen*\n\n';

  if (exitosos.length > 0) {
    const numeros = exitosos.map(e => e.resultado.numeroPedido).join(', ');
    mensaje += `✅ *${exitosos.length} pedido(s) creado(s):* ${numeros}\n`;

    for (const { pedido, resultado } of exitosos) {
      mensaje += `  • ${pedido.biginOrderName} → #${resultado.numeroPedido}\n`;
    }
  }

  if (fallidos.length > 0) {
    mensaje += `\n❌ *${fallidos.length} pedido(s) fallido(s):*\n`;
    for (const { pedido, resultado } of fallidos) {
      mensaje += `  • ${pedido.biginOrderName}: ${resultado.error}\n`;
    }
  }

  if (invalidos.length > 0) {
    mensaje += `\n⚠️ *${invalidos.length} pedido(s) rechazado(s) (ciudad invalida):*\n`;
    for (const pedido of invalidos) {
      mensaje += `  • ${pedido.biginOrderName}: ${pedido._error}\n`;
    }
  }

  return mensaje;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EJECUTAR
// ============================================
subirOrdenesCoordinadora()
  .then(result => console.log(result))
  .catch(error => console.error('Error:', error));
```

### 7.2 Diferencias con "Ingresar Guias"

| Aspecto | Subir Ordenes | Ingresar Guias |
|---------|---------------|----------------|
| Stage Bigin | ROBOT COORD | COORDINADORA |
| Usa Claude AI | SI (limpiar datos) | NO |
| Valida ciudades | SI | NO |
| Robot endpoint | /api/crear-pedido | /api/buscar-guias |
| Actualiza Bigin | Guia = # pedido | Guia = # guia real |
| Nuevo stage | COORDINADORA | ENVIA |

### 7.3 Flujo de Stages en Bigin

```
ROBOT COORD  ──[subir ordenes]──►  COORDINADORA  ──[ingresar guias]──►  ENVIA
     │                                   │                                │
     │                                   │                                │
     └── Guia: (vacio)                   └── Guia: "9650" (# pedido)      └── Guia: "53180509486" (# guia real)
```

---

## 8. Variables de Entorno

```env
# Bigin/Zoho OAuth2
BIGIN_REFRESH_TOKEN=1000.xxx...
BIGIN_CLIENT_ID=1000.XXX...
BIGIN_CLIENT_SECRET=xxx...

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=sk-ant-xxx...

# Robot Coordinadora
ROBOT_URL=http://localhost:3001

# Portal Coordinadora (para el robot)
COORDINADORA_URL=https://ff.coordinadora.com/
COORDINADORA_USER=tu_usuario
COORDINADORA_PASSWORD=tu_password
```

---

## Resumen de Funcionalidades para MorfX

| Funcionalidad | Descripcion | Prioridad |
|---------------|-------------|-----------|
| OAuth2 Bigin | Obtener/refrescar access_token | ALTA |
| Buscar Deals | GET con criteria Stage=ROBOT COORD | ALTA |
| Claude AI | Procesar y limpiar datos | ALTA |
| Validar ciudades | POST /api/validar-pedidos | ALTA |
| Crear pedido | POST /api/crear-pedido | ALTA |
| Actualizar Bigin | PUT con Guia y Stage | ALTA |
| Manejo de errores | Separar validos/invalidos | MEDIA |
| Notificaciones | Enviar resumen al usuario | MEDIA |
