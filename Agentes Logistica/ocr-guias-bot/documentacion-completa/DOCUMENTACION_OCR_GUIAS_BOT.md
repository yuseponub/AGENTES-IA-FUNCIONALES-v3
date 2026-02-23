# DOCUMENTACION COMPLETA: OCR GUIAS BOT

## Descripcion General

Robot de Inteligencia Artificial para **extraer datos de guias de transportadoras** usando **Claude Vision** (Anthropic). El sistema automatiza la lectura de documentos de envio, extrae informacion clave y la vincula con ordenes en Bigin CRM.

---

## 1. FUNCIONALIDADES DEL ROBOT OCR

### 1.1 Procesamiento de Imagenes (OCR)

| Funcionalidad | Descripcion |
|---------------|-------------|
| **Formatos soportados** | JPG, JPEG, PNG, WebP, GIF, PDF |
| **Tamano maximo** | 20MB por archivo |
| **Procesamiento multiple** | Hasta 20 imagenes simultaneas |
| **Modelo IA** | Claude Sonnet 4 (claude-sonnet-4-20250514) |

### 1.2 Datos Extraidos de las Guias

El robot extrae automaticamente los siguientes campos:

| Campo | Descripcion | Ejemplo |
|-------|-------------|---------|
| `numeroGuia` | Numero de tracking/guia | `53180509486` |
| `destinatario` | Nombre del destinatario | `Juan Perez` |
| `direccion` | Direccion de entrega | `Calle 123 #45-67` |
| `ciudad` | Ciudad de destino | `Bogota` |
| `telefono` | Telefono de contacto | `3001234567` |
| `remitente` | Nombre del remitente | `Somnio` |
| `fechaCreacion` | Fecha de creacion de la guia | `2026-01-22` |
| `transportadora` | Empresa transportadora | `Envia`, `Inter`, `Coordinadora`, `Servientrega` |
| `confianza` | Nivel de confianza (0-100) | `95` |
| `datosAdicionales` | Otros datos encontrados | `{}` |

### 1.3 Transportadoras Soportadas

- **Envia** (ENVIA)
- **Interrapidisimo** (INTER)
- **Coordinadora**
- **Servientrega**

### 1.4 Match Inteligente con Bigin CRM

El robot realiza matching entre guias extraidas y ordenes de Bigin usando:

**Criterios de Match (por prioridad):**

1. **Telefono** (MUY IMPORTANTE)
   - Ignora prefijos (57), espacios y guiones
   - `3001234567` = `573001234567` = `300 123 4567`

2. **Direccion** (MUY IMPORTANTE)
   - Acepta abreviaturas: CL=Calle, CR/KR=Carrera, AV=Avenida, DG=Diagonal, TV=Transversal
   - `Calle 8 #6-27` = `CL 8 # 6-27` = `Calle 8 No. 6-27`

3. **Municipio/Ciudad** (MUY IMPORTANTE)
   - Ignora mayusculas y tildes
   - `Bogota` = `BOGOTA` = `Bogota D.C.`

4. **Nombre** (referencia adicional)
   - Se usa como apoyo, no como criterio principal

**Niveles de Confianza:**
- **95-100%**: Telefono + direccion + municipio coinciden exactamente
- **85-94%**: Telefono coincide + direccion/municipio similar
- **70-84%**: Multiples campos coinciden con variaciones menores
- **50-69%**: Algunos campos coinciden (revisar manualmente)
- **<50%**: Probablemente no es match

### 1.5 Validacion de Datos de Envio

El robot valida que los datos de la guia coincidan con los datos correctos de Bigin:

| Severidad | Descripcion |
|-----------|-------------|
| **Alta** | Error critico que puede causar problemas de entrega |
| **Media** | Discrepancia que requiere atencion |
| **Baja** | Diferencia menor de formato |

### 1.6 Caso Especial: Recoge en Oficina (INTER)

Para guias de Interrapidisimo que indican recogida en oficina:
- Solo se valida: Telefono (obligatorio), Municipio y Departamento
- La direccion exacta NO es necesaria

---

## 2. ENDPOINTS DE LA API

### 2.1 Base URL
```
http://localhost:3002
```

### 2.2 Health Check
```http
GET /api/health
```

**Respuesta:**
```json
{
  "status": "ok",
  "service": "ocr-guias-bot",
  "timestamp": "2026-01-22T...",
  "hasApiKey": true
}
```

### 2.3 OCR de Archivos (Form-data)
```http
POST /api/ocr/imagenes
Content-Type: multipart/form-data
```

**Form-data:**
- `files[]` - Multiples archivos de imagen

**Respuesta:**
```json
{
  "success": true,
  "guias": [
    {
      "numeroGuia": "1234567890",
      "destinatario": "Juan Perez",
      "direccion": "Calle 123 #45-67",
      "ciudad": "Bogota",
      "telefono": "3001234567",
      "remitente": "Somnio",
      "fechaCreacion": "2026-01-22",
      "transportadora": "Envia",
      "confianza": 95
    }
  ],
  "textoCompleto": "Todo el texto extraido..."
}
```

### 2.4 OCR de Imagenes en Base64
```http
POST /api/ocr/base64
Content-Type: application/json
```

**Body:**
```json
{
  "imagenes": [
    {
      "data": "base64...",
      "type": "image/jpeg"
    }
  ]
}
```

### 2.5 OCR desde URLs
```http
POST /api/ocr/urls
Content-Type: application/json
```

**Body:**
```json
{
  "urls": [
    "https://ejemplo.com/guia1.jpg",
    "https://ejemplo.com/guia2.png"
  ],
  "slackToken": "xoxb-..."
}
```

**Nota:** El `slackToken` es opcional y se usa para descargar archivos privados de Slack.

### 2.6 Match de Guias con Ordenes Bigin
```http
POST /api/match-guias
Content-Type: application/json
```

**Body:**
```json
{
  "guiasOCR": [
    {
      "numeroGuia": "1234567890",
      "destinatario": "Juan Perez",
      "telefono": "3001234567",
      "ciudad": "Bogota"
    }
  ],
  "ordenesBigin": [
    {
      "id": "123456",
      "Deal_Name": "Juan Perez Garcia",
      "Phone": "573001234567",
      "City": "Bogota"
    }
  ],
  "transportadora": "ENVIA"
}
```

**Respuesta:**
```json
{
  "success": true,
  "matches": [
    {
      "guia": { "...datos guia..." },
      "orden": { "...datos orden..." },
      "confianza": 90,
      "razon": "Coincide telefono y nombre parcial",
      "datosCorrectos": true,
      "esRecogeEnOficina": false,
      "discrepancias": []
    }
  ],
  "guiasSinMatch": [],
  "ordenesSinMatch": [],
  "resumen": {
    "totalMatches": 5,
    "matchesCorrectos": 4,
    "matchesConDiscrepancias": 1,
    "discrepanciasAltas": 0
  }
}
```

---

## 3. CONFIGURACION TECNICA

### 3.1 Requisitos
- Node.js 18+
- npm o yarn
- API Key de Anthropic

### 3.2 Variables de Entorno (.env)
```bash
ANTHROPIC_API_KEY=sk-ant-...
PORT=3002
UPLOAD_DIR=./storage/uploads
SLACK_BOT_TOKEN=xoxb-...  # Opcional, para descargar de Slack
```

### 3.3 Dependencias Principales
```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "express": "^4.18.2",
  "multer": "^1.4.5-lts.1",
  "dotenv": "^16.3.1",
  "sharp": "^0.33.2"
}
```

### 3.4 Comandos de Ejecucion
```bash
# Desarrollo (con hot-reload)
npm run api:dev

# Produccion
npm run api

# Con PM2
pm2 start "npm run api" --name ocr-guias-bot
```

### 3.5 Estructura de Archivos
```
ocr-guias-bot/
├── src/
│   └── api/
│       └── server.ts      # Servidor principal (592 lineas)
├── n8n/
│   ├── Ingresar-Guias-Inter.json
│   ├── Ingresar-Guias-Inter-v2.json
│   ├── Ingresar-Guias-Envia.json
│   ├── nodos-inter-adaptados.json
│   ├── preparar-ocr-inter-NUEVO.js
│   └── COPIAR-PEGAR-NODOS-INTER.md
├── package.json
├── tsconfig.json
├── API-DOCS.md
└── README.md
```

---

## 4. INTEGRACIONES

### 4.1 Slack
- Trigger por mensaje en canal especifico
- Comando: `ingresa guias envia` o `ingresa guias inter`
- Soporte para archivos adjuntos (imagenes)
- Descarga de archivos privados con token

### 4.2 Bigin CRM (Zoho)
- Consulta de ordenes en stage "ESPERANDO GUIAS"
- Filtro por transportadora (ENVIA, INTER)
- Actualizacion automatica de ordenes con numero de guia
- Cambio de stage al ingresar guia

### 4.3 Claude Vision (Anthropic)
- Modelo: claude-sonnet-4-20250514
- Procesamiento de imagenes con IA
- Extraccion de texto y datos estructurados
- Match inteligente con analisis contextual

---

## 5. FLUJO DE OPERACION

```
1. Usuario envia mensaje en Slack con imagenes de guias
   ↓
2. n8n detecta el comando y extrae archivos
   ↓
3. Se descargan las imagenes de Slack
   ↓
4. Se convierten a Base64
   ↓
5. Se envian al Robot OCR
   ↓
6. Claude Vision extrae datos de las guias
   ↓
7. Se obtienen ordenes de Bigin (ESPERANDO GUIAS)
   ↓
8. Robot hace match entre guias y ordenes
   ↓
9. Se validan datos de envio
   ↓
10. Se actualizan ordenes en Bigin
   ↓
11. Se envia resumen a Slack
```

---

## 6. MANEJO DE ERRORES

| Error | Causa | Solucion |
|-------|-------|----------|
| "No se recibieron archivos" | Endpoint llamado sin imagenes | Adjuntar imagenes al mensaje |
| "Tipo de archivo no permitido" | Formato no soportado | Usar JPG, PNG, WebP, GIF o PDF |
| "No se pudo parsear respuesta" | Error en respuesta de Claude | Verificar calidad de imagen |
| "Error descargando imagen" | URL invalida o sin acceso | Verificar URL y permisos |
| "No hay ordenes en ESPERANDO GUIAS" | Sin ordenes pendientes en Bigin | Verificar stage de ordenes |

---

## 7. ALERTAS Y NOTIFICACIONES

El sistema genera alertas en Slack para:

- **Guias sin match**: Guias extraidas que no corresponden a ninguna orden
- **Ordenes sin guia**: Ordenes esperando guia que no se encontraron
- **Discrepancias altas**: Errores importantes en datos de envio
- **OCR fallido**: Cuando no se puede extraer informacion de las imagenes

**Iconos de severidad:**
- :white_check_mark: - Datos correctos
- :warning: - Atencion requerida
- :red_circle: - Error de severidad alta
- :large_orange_circle: - Error de severidad media
- :large_yellow_circle: - Error de severidad baja

---

*Documento generado automaticamente - OCR Guias Bot v1.0.0*
