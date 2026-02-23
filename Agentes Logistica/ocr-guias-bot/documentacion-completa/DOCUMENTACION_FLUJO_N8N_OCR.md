# DOCUMENTACION: FLUJOS N8N PARA OCR GUIAS BOT

## Resumen de Workflows

| Workflow | Transportadora | Comando Slack | Archivo |
|----------|----------------|---------------|---------|
| Ingresar Guias Envia | ENVIA | `ingresa guias envia` | `Ingresar-Guias-Envia.json` |
| Ingresar Guias Inter v2 | INTER | `ingresa guias inter` | `Ingresar-Guias-Inter-v2.json` |

---

## 1. WORKFLOW: INGRESAR GUIAS ENVIA

### 1.1 Diagrama de Flujo
```
┌─────────────────┐
│  Slack Trigger  │
│  (Canal guias)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Filtrar Comando │◄── "ingresa guias envia"
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Hay Archivos?  │────►│ Slack: Sin      │
│                 │ NO  │ Archivos        │
└────────┬────────┘     └─────────────────┘
         │ SI
         ▼
┌─────────────────┐
│ Extraer URLs    │
│ Imagenes        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Refresh Bigin   │
│ Token           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bigin: Ordenes  │
│ ENVIA           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Hay Ordenes?   │────►│ Slack: Sin      │
│                 │ NO  │ Ordenes         │
└────────┬────────┘     └─────────────────┘
         │ SI
         ▼
┌─────────────────┐
│ Preparar Datos  │
│ OCR             │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Robot: OCR      │◄── POST /api/ocr/urls
│ Imagenes        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  OCR Exitoso?   │────►│ Slack: OCR      │
│                 │ NO  │ Fallido         │
└────────┬────────┘     └─────────────────┘
         │ SI
         ▼
┌─────────────────┐
│ Robot: Match    │◄── POST /api/match-guias
│ Guias           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Hay Matches?   │────►│ Mensaje Sin     │
│                 │ NO  │ Matches         │
└────────┬────────┘     │        │        │
         │ SI           ▼        │        │
         │       ┌─────────────┐ │        │
         │       │Slack: Sin   │◄┘        │
         │       │Matches      │          │
         │       └─────────────┘          │
         ▼
┌─────────────────┐
│ Preparar        │
│ Actualizaciones │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Refresh Token   │
│ Update          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bigin:          │
│ Actualizar Orden│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generar Resumen │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Slack: Resultado│
└─────────────────┘
```

### 1.2 Descripcion de Nodos

#### NODO 1: Slack Trigger
**Tipo:** `n8n-nodes-base.slackTrigger`

**Funcion:** Escucha mensajes en el canal de Slack configurado.

**Configuracion:**
- Canal ID: `C0A9M96C0AK`
- Trigger: `message`
- Incluir detalles de archivos: `true`

---

#### NODO 2: Filtrar Comando
**Tipo:** `n8n-nodes-base.filter`

**Funcion:** Solo procesa mensajes que contienen el comando correcto.

**Condicion:**
```javascript
$json.text.toLowerCase().contains("ingresa guias envia")
```

---

#### NODO 3: Hay Archivos?
**Tipo:** `n8n-nodes-base.if`

**Funcion:** Verifica que el mensaje incluya imagenes adjuntas.

**Condicion:**
```javascript
$json.files?.length > 0
```

**Rama TRUE:** Continua al procesamiento
**Rama FALSE:** Envia mensaje "Por favor adjunta las fotos..."

---

#### NODO 4: Extraer URLs Imagenes
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Extrae las URLs de descarga de las imagenes de Slack.

**Codigo:**
```javascript
const slackData = $input.first().json;
const files = slackData.files || [];

const imageUrls = files
  .filter(f => f.mimetype?.startsWith('image/') ||
               f.filetype?.match(/jpg|jpeg|png|gif|webp/i))
  .map(f => f.url_private_download || f.url_private || f.permalink);

return [{
  json: {
    urls: imageUrls,
    totalImagenes: imageUrls.length,
    slackChannel: slackData.channel
  }
}];
```

---

#### NODO 5: Refresh Bigin Token
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Obtiene un access token fresco de Zoho/Bigin.

**Request:**
```http
POST https://accounts.zoho.com/oauth/v2/token
```

**Parametros:**
- `refresh_token`: Token de refresco de Zoho
- `client_id`: ID de cliente de la app
- `client_secret`: Secreto de la app
- `grant_type`: `refresh_token`

---

#### NODO 6: Bigin: Ordenes ENVIA
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Obtiene ordenes de Bigin en stage "ESPERANDO GUIAS" con transportadora ENVIA.

**Request:**
```http
GET https://www.zohoapis.com/bigin/v1/Deals/search
```

**Query:**
```
criteria=((Stage:equals:ESPERANDO GUIAS)and(Transportadora:equals:ENVIA))
```

**Headers:**
```
Authorization: Zoho-oauthtoken {access_token}
```

---

#### NODO 7: Hay Ordenes?
**Tipo:** `n8n-nodes-base.if`

**Condicion:**
```javascript
$json.data?.length > 0
```

---

#### NODO 8: Preparar Datos OCR
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Combina URLs de imagenes con datos de ordenes de Bigin.

**Codigo:**
```javascript
const biginData = $input.first().json;
const imageData = $('Extraer URLs Imagenes').first().json;

const ordenes = (biginData.data || []).map(o => ({
  id: o.id,
  Deal_Name: o.Deal_Name,
  Phone: o.Phone,
  Telefono: o.Telefono,
  Direcci_n: o.Direcci_n,
  Municipio_Dept: o.Municipio_Dept,
  Stage: o.Stage
}));

return [{
  json: {
    urls: imageData.urls,
    ordenesBigin: ordenes,
    totalOrdenes: ordenes.length,
    totalImagenes: imageData.urls?.length || 0
  }
}];
```

---

#### NODO 9: Robot: OCR Imagenes
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Llama al robot OCR para extraer datos de las imagenes.

**Request:**
```http
POST http://172.17.0.1:3003/api/ocr/urls
Content-Type: application/json

{
  "urls": ["url1", "url2", ...]
}
```

**Timeout:** 120 segundos

---

#### NODO 10: OCR Exitoso?
**Tipo:** `n8n-nodes-base.if`

**Condicion:**
```javascript
$json.success && $json.guias?.length > 0
```

---

#### NODO 11: Robot: Match Guias
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Hace match inteligente entre guias extraidas y ordenes de Bigin.

**Request:**
```http
POST http://172.17.0.1:3003/api/match-guias
Content-Type: application/json

{
  "guiasOCR": [...],
  "ordenesBigin": [...],
  "transportadora": "ENVIA"
}
```

---

#### NODO 12: Hay Matches?
**Tipo:** `n8n-nodes-base.if`

**Condicion:**
```javascript
$json.matches?.length > 0
```

---

#### NODO 13: Preparar Actualizaciones
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Prepara las actualizaciones para Bigin (solo matches con confianza >= 70%).

**Codigo:**
```javascript
const matchData = $input.first().json;
const matches = matchData.matches || [];

const actualizaciones = matches
  .filter(m => m.confianza >= 70)
  .map(m => ({
    biginId: m.orden.id,
    dealName: m.orden.Deal_Name,
    numeroGuia: m.guia.numeroGuia,
    confianza: m.confianza,
    razon: m.razon,
    datosCorrectos: m.datosCorrectos,
    discrepancias: m.discrepancias || [],
    tieneErroresAltos: m.discrepancias?.some(d => d.severidad === 'alta') || false
  }));

return actualizaciones.map(a => ({ json: a }));
```

---

#### NODO 14: Bigin: Actualizar Orden
**Tipo:** `n8n-nodes-base.httpRequest`

**Funcion:** Actualiza la orden en Bigin con el numero de guia.

**Request:**
```http
PUT https://www.zohoapis.com/bigin/v1/Deals/{biginId}
Content-Type: application/json

{
  "data": [{
    "Guia": "{numeroGuia}",
    "Stage": "ENVIA"
  }]
}
```

---

#### NODO 15: Generar Resumen
**Tipo:** `n8n-nodes-base.code`

**Funcion:** Genera mensaje de resumen para Slack con resultados y alertas.

**Contenido del resumen:**
- Total de guias extraidas
- Matches encontrados
- Ordenes actualizadas
- Datos correctos vs con discrepancias
- Alertas de errores importantes
- Lista de ordenes actualizadas con iconos
- Guias sin match
- Ordenes sin guia

---

#### NODO 16: Slack: Resultado
**Tipo:** `n8n-nodes-base.slack`

**Funcion:** Envia el resumen final al canal de Slack.

---

## 2. WORKFLOW: INGRESAR GUIAS INTER V2

### 2.1 Diferencias con Envia

El workflow de Inter tiene algunas diferencias importantes:

| Aspecto | Envia | Inter |
|---------|-------|-------|
| Comando | `ingresa guias envia` | `ingresa guias inter` |
| Descarga imagenes | Via URLs directas | Via HTTP con auth de Slack |
| Metodo OCR | `/api/ocr/urls` | `/api/ocr/base64` |
| Stage destino | `ENVIA` | `INTER` |

### 2.2 Nodos Adicionales/Diferentes en Inter

#### Extraer Archivos (en lugar de URLs)
```javascript
const slackData = $input.first().json;
const files = slackData.files || [];

const imageFiles = files
  .filter(f => f.mimetype?.startsWith('image/') ||
               f.filetype?.match(/jpg|jpeg|png|gif|webp/i));

return imageFiles.map((file, index) => ({
  json: {
    fileId: file.id,
    fileName: file.name,
    url: file.url_private_download || file.url_private,
    mimetype: file.mimetype || 'image/jpeg',
    index: index,
    slackChannel: slackData.channel
  }
}));
```

#### Descargar Imagen (HTTP Request)
```http
GET {url}
Authorization: Bearer {SLACK_BOT_TOKEN}
Response Format: file
```

#### Convertir a Base64
```javascript
const items = $input.all();
const imagenes = [];

for (const item of items) {
  const binaryData = item.binary?.data;
  if (binaryData) {
    imagenes.push({
      data: binaryData.data,
      type: binaryData.mimeType || 'image/jpeg',
      fileName: binaryData.fileName
    });
  }
}

return [{
  json: {
    imagenes: imagenes,
    totalImagenes: imagenes.length
  }
}];
```

#### Robot: OCR Imagenes (Base64)
```http
POST http://172.17.0.1:3003/api/ocr/base64
Content-Type: application/json

{
  "imagenes": [
    { "data": "base64...", "type": "image/jpeg" }
  ]
}
```

---

## 3. CONFIGURACION REQUERIDA

### 3.1 Variables de Entorno en n8n
```
SLACK_BOT_TOKEN=xoxb-TU_TOKEN_DE_SLACK_AQUI
```

### 3.2 Credenciales Requeridas

#### Slack API
- Nombre: `Slack account`
- ID: `Y6LxxE3sffV7XYLy`
- Bot Token con permisos:
  - `channels:history`
  - `files:read`
  - `chat:write`

#### Zoho/Bigin OAuth
- Refresh Token
- Client ID
- Client Secret

### 3.3 URLs del Robot OCR
```
Robot Local: http://172.17.0.1:3003
```

**Nota:** `172.17.0.1` es la IP del host desde dentro del contenedor Docker de n8n.

---

## 4. TABLA DE NODOS POR WORKFLOW

### Workflow Envia (19 nodos)
| # | Nodo | Tipo | Funcion |
|---|------|------|---------|
| 1 | Slack Trigger | slackTrigger | Escucha mensajes |
| 2 | Filtrar Comando | filter | Filtra comando |
| 3 | Hay Archivos? | if | Verifica archivos |
| 4 | Slack: Sin Archivos | slack | Mensaje error |
| 5 | Extraer URLs Imagenes | code | Extrae URLs |
| 6 | Refresh Bigin Token | httpRequest | Token Zoho |
| 7 | Bigin: Ordenes ENVIA | httpRequest | Consulta ordenes |
| 8 | Hay Ordenes? | if | Verifica ordenes |
| 9 | Slack: Sin Ordenes | slack | Mensaje error |
| 10 | Preparar Datos OCR | code | Prepara datos |
| 11 | Robot: OCR Imagenes | httpRequest | Llama OCR |
| 12 | OCR Exitoso? | if | Verifica OCR |
| 13 | Slack: OCR Fallido | slack | Mensaje error |
| 14 | Robot: Match Guias | httpRequest | Llama match |
| 15 | Hay Matches? | if | Verifica matches |
| 16 | Mensaje Sin Matches | code | Genera mensaje |
| 17 | Slack: Sin Matches | slack | Envia mensaje |
| 18 | Preparar Actualizaciones | code | Prepara updates |
| 19 | Refresh Token Update | httpRequest | Token Zoho |
| 20 | Bigin: Actualizar Orden | httpRequest | Actualiza Bigin |
| 21 | Generar Resumen | code | Genera resumen |
| 22 | Slack: Resultado | slack | Envia resultado |

### Workflow Inter v2 (22 nodos)
Incluye nodos adicionales:
- Extraer Archivos
- Descargar Imagen
- Convertir a Base64

---

## 5. CRITERIOS DE BIGIN

### 5.1 Consulta de Ordenes
```
Stage = "ESPERANDO GUIAS"
AND
Transportadora = "ENVIA" (o "INTER")
```

### 5.2 Actualizacion de Ordenes
```json
{
  "Guia": "numero_de_guia",
  "Stage": "ENVIA" // o "INTER"
}
```

### 5.3 Campos Utilizados de Bigin
| Campo | Descripcion |
|-------|-------------|
| `id` | ID unico de la orden |
| `Deal_Name` | Nombre del deal/cliente |
| `Phone` | Telefono principal |
| `Telefono` | Telefono alternativo |
| `Direcci_n` | Direccion de entrega |
| `Municipio_Dept` | Municipio y departamento |
| `Stage` | Etapa del pipeline |
| `Transportadora` | ENVIA, INTER, etc. |
| `Guia` | Numero de guia (a actualizar) |

---

## 6. MENSAJES DE SLACK

### 6.1 Errores
- "Por favor adjunta las fotos de las guias de [Transportadora] junto con el comando"
- "No hay ordenes en *ESPERANDO GUIAS* con transportadora *[TRANSPORTADORA]*"
- "No se pudo extraer informacion de las imagenes..."

### 6.2 Resumen de Exito
```
*Guias [Transportadora] - Resumen*

Guias extraidas por OCR: X
Matches encontrados: X
Ordenes actualizadas: X
Datos correctos: X

:warning: *ALERTA: X GUIA(S) CON ERRORES IMPORTANTES*

*Ordenes actualizadas:*
:white_check_mark: Juan Perez
  Guia: 53180509486 (95% confianza)

:warning: Maria Garcia
  Guia: 12345678901 (85% confianza)
  :red_circle: telefono: "3001111111" vs "3002222222"

*Guias sin match:*
• Guia: 99999999999 - Desconocido

*Ordenes sin guia:*
• Pedro Lopez

:rotating_light: *REVISAR: Los datos de las guias con errores pueden causar problemas de entrega*
```

---

## 7. TROUBLESHOOTING

### 7.1 Problema: OCR no extrae datos
**Causas:**
- Imagen borrosa o de baja calidad
- Guia no visible completamente
- Formato de guia no reconocido

**Solucion:**
- Usar fotos de mejor calidad
- Asegurar que la guia este completa en la imagen
- Verificar que sea una transportadora soportada

### 7.2 Problema: No hay matches
**Causas:**
- Ordenes no estan en stage "ESPERANDO GUIAS"
- Transportadora incorrecta en Bigin
- Datos de telefono/direccion no coinciden

**Solucion:**
- Verificar stage de las ordenes en Bigin
- Verificar transportadora asignada
- Comparar datos manualmente

### 7.3 Problema: Error de autenticacion Slack
**Causas:**
- Token de Slack expirado o invalido
- Variable de entorno no configurada

**Solucion:**
- Regenerar token de Slack
- Configurar `SLACK_BOT_TOKEN` en n8n

### 7.4 Problema: Timeout en OCR
**Causas:**
- Muchas imagenes simultaneas
- Servidor OCR lento o caido

**Solucion:**
- Procesar menos imagenes por vez
- Verificar estado del robot OCR

---

*Documento generado automaticamente - Flujos n8n para OCR Guias Bot*
