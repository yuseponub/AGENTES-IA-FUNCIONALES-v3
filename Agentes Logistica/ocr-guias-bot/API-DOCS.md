# OCR Guías Bot API

Robot para extraer datos de guías de transportadoras usando Claude Vision.

## URL Base
```
http://localhost:3002
```

## Endpoints

### 1. Health Check
```
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

---

### 2. OCR de Archivos (Form-data)
```
POST /api/ocr/imagenes
Content-Type: multipart/form-data
```

**Form-data:**
- `files[]` - Múltiples archivos de imagen (JPG, PNG, WebP, GIF)

**Respuesta:**
```json
{
  "success": true,
  "guias": [
    {
      "numeroGuia": "1234567890",
      "destinatario": "Juan Pérez",
      "direccion": "Calle 123 #45-67",
      "ciudad": "Bogotá",
      "telefono": "3001234567",
      "remitente": "Somnio",
      "fechaCreacion": "2026-01-22",
      "transportadora": "Envia",
      "confianza": 95
    }
  ],
  "textoCompleto": "Todo el texto extraído..."
}
```

---

### 3. OCR de Imágenes en Base64
```
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

**Respuesta:** Igual que /api/ocr/imagenes

---

### 4. OCR de URLs
```
POST /api/ocr/urls
Content-Type: application/json
```

**Body:**
```json
{
  "urls": [
    "https://ejemplo.com/guia1.jpg",
    "https://ejemplo.com/guia2.png"
  ]
}
```

**Respuesta:** Igual que /api/ocr/imagenes

---

### 5. Match de Guías con Órdenes
```
POST /api/match-guias
Content-Type: application/json
```

**Body:**
```json
{
  "guiasOCR": [
    {
      "numeroGuia": "1234567890",
      "destinatario": "Juan Pérez",
      "telefono": "3001234567",
      "ciudad": "Bogotá"
    }
  ],
  "ordenesBigin": [
    {
      "id": "123456",
      "Deal_Name": "Juan Perez Garcia",
      "Phone": "573001234567",
      "City": "Bogota"
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "matches": [
    {
      "guia": { ...guía OCR... },
      "orden": { ...orden Bigin... },
      "confianza": 90,
      "razon": "Coincide teléfono y nombre parcial"
    }
  ],
  "guiasSinMatch": [],
  "ordenesSinMatch": []
}
```

---

## Uso desde n8n

### Ejemplo: Subir imágenes desde Slack

1. **Slack Trigger** recibe mensaje con archivos adjuntos
2. **HTTP Request** descarga las imágenes de Slack
3. **HTTP Request** a `/api/ocr/urls` con las URLs de las imágenes
4. **Code** procesa los resultados
5. **Bigin API** actualiza las órdenes

### Ejemplo: Desde fotos en base64

```javascript
// En nodo Code de n8n
const imagenes = $input.all().map(item => ({
  data: item.json.imageBase64,
  type: 'image/jpeg'
}));

return [{ json: { imagenes } }];
```

Luego HTTP Request POST a `/api/ocr/base64`

---

## Iniciar el servicio

```bash
# Desarrollo
npm run api:dev

# Producción
npm run api

# Con PM2
pm2 start "npm run api" --name ocr-guias-bot
```

## Variables de entorno

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3002
UPLOAD_DIR=./storage/uploads
```
