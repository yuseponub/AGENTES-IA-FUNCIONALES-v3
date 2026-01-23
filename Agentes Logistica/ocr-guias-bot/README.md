# OCR Guías Bot

Robot para extraer datos de guías de transportadoras usando **Claude Vision**.

## Funcionalidades

- OCR de imágenes de guías (JPG, PNG, WebP, GIF)
- Extracción automática de: número de guía, destinatario, dirección, ciudad, teléfono, transportadora
- Match inteligente entre guías OCR y órdenes de Bigin
- Validación de datos de envío
- Soporte para múltiples transportadoras (Envía, Coordinadora, Inter, Servientrega)

## Instalación

```bash
npm install
```

## Configuración

Crear archivo `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
PORT=3002
UPLOAD_DIR=./storage/uploads
```

## Uso

```bash
# Desarrollo
npm run api:dev

# Producción
npm run api

# Con PM2
pm2 start "npm run api" --name ocr-guias-bot
```

## Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check del servicio |
| POST | `/api/ocr/imagenes` | OCR de archivos (form-data) |
| POST | `/api/ocr/base64` | OCR de imágenes en base64 |
| POST | `/api/ocr/urls` | OCR de URLs de imágenes |
| POST | `/api/match-guias` | Match entre guías OCR y órdenes Bigin |

## Ejemplo de uso

### OCR desde URLs

```bash
curl -X POST http://localhost:3002/api/ocr/urls \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://ejemplo.com/guia1.jpg",
      "https://ejemplo.com/guia2.png"
    ]
  }'
```

### Respuesta

```json
{
  "success": true,
  "guias": [
    {
      "numeroGuia": "53180509486",
      "destinatario": "Juan Pérez",
      "direccion": "Calle 123 #45-67",
      "ciudad": "Bogotá",
      "telefono": "3001234567",
      "transportadora": "Envia",
      "confianza": 95
    }
  ]
}
```

## Workflows n8n

- `n8n/Ingresar-Guias-Inter.json` - Workflow para guías de Interrapidísimo
- `n8n/Ingresar-Guias-Envia.json` - Workflow para guías de Envía

## Documentación detallada

Ver [API-DOCS.md](./API-DOCS.md) para documentación completa de la API.
