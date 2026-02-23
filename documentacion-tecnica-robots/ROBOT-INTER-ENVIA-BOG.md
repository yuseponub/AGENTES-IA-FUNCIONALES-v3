# DOCUMENTACION COMPLETA: Robot Inter-Envia-Bog

> **Fecha de documentacion**: Febrero 2026
> **Version del sistema**: v3.1.0
> **Repositorio**: `AGENTES-IA-FUNCIONALES-v3`

---

## 1. VISION GENERAL

### Proposito
El **robot-inter-envia-bog** es un servidor Node.js/TypeScript que genera documentos de envio (PDFs y Excel) para tres transportadoras colombianas:

| Transportadora | Tipo de Documento | Endpoint |
|---------------|-------------------|----------|
| **Interrapidisimo** | PDF (guias 4x6") | `/api/generar-guias` |
| **Bogota** | PDF (guias 4x6") | `/api/generar-guias` |
| **Envia** | Excel (.xlsx) | `/api/generar-excel-envia` |

### Ubicacion en el Repositorio
```
/Agentes Logistica/robot-inter-envia-bog/
```

### Puerto de Ejecucion
```
Puerto: 3002
IP Docker: 172.18.0.1
URL interna: http://172.18.0.1:3002
```

---

## 2. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────────┐
│                           VPS SERVER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────────────────┐    ┌─────────────────┐   │
│  │  Slack   │───▶│   n8n (Docker)       │───▶│ Robot Inter/    │   │
│  │  #bots   │    │   Puerto: 5678       │    │ Envia/Bog       │   │
│  └──────────┘    │   Workflow ID:       │    │ Puerto: 3002    │   │
│                  │   eaG7RWwFFu1tbbEC   │    └─────────────────┘   │
│                  └──────────────────────┘              │            │
│                           │                            ▼            │
│                           │              ┌─────────────────────────┐│
│                           │              │ /opt/n8n/local-files/   ││
│                           │              │ (PDFs y Excel)          ││
│                           │              └─────────────────────────┘│
│                           ▼                            │            │
│  ┌──────────────────────────────────────┐              ▼            │
│  │         Claude AI (Anthropic)        │   ┌──────────────────┐   │
│  │    claude-sonnet-4-20250514         │   │ Caddy (HTTPS)    │   │
│  │    Transformacion de datos           │   │ Sirve archivos   │   │
│  └──────────────────────────────────────┘   └──────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               Bigin (Zoho CRM) - API REST                     │  │
│  │               https://www.zohoapis.com/bigin/v1/              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos
```
Slack (comando)
    │
    ▼
n8n (obtiene ordenes de Bigin)
    │
    ▼
Claude AI (transforma/normaliza datos)
    │
    ▼
Robot Inter/Envia/Bog (genera PDF/Excel)
    │
    ▼
Almacena en /opt/n8n/local-files/
    │
    ▼
Caddy (sirve via HTTPS)
    │
    ▼
n8n (actualiza Bigin + notifica Slack)
```

---

## 3. ESTRUCTURA DE ARCHIVOS

```
robot-inter-envia-bog/
├── src/
│   ├── server.ts          # Servidor Express principal
│   ├── generate-guide.ts  # Logica de generacion de PDFs
│   └── test-guide.ts      # Scripts de prueba
├── package.json           # Dependencias y scripts
└── README.md              # Documentacion del proyecto
```

---

## 4. DEPENDENCIAS (package.json)

```json
{
  "name": "interrapidisimo-bot",
  "version": "1.0.0",
  "description": "Generador de guias para Interrapidisimo desde Bigin",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx src/server.ts",
    "generate": "tsx src/generate-guides.ts",
    "test": "tsx src/test-guide.ts"
  },
  "dependencies": {
    "express": "4.18.2",
    "pdfkit": "0.15.0",
    "cors": "2.8.5",
    "exceljs": "4.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/pdfkit": "^0.13.3",
    "@types/cors": "^2.8.17",
    "tsx": "4.7.0",
    "typescript": "5.3.3"
  }
}
```

### Descripcion de Dependencias

| Paquete | Version | Proposito |
|---------|---------|-----------|
| `express` | 4.18.2 | Framework web para API REST |
| `pdfkit` | 0.15.0 | Generacion de documentos PDF |
| `cors` | 2.8.5 | Manejo de CORS |
| `exceljs` | 4.4.0 | Generacion de archivos Excel |
| `tsx` | 4.7.0 | Ejecutor de TypeScript |
| `typescript` | 5.3.3 | Compilador TypeScript |

---

## 5. API ENDPOINTS

### GET /api/health
Verificar estado del servicio.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-23T10:00:00.000Z"
}
```

---

### POST /api/generar-guias
Genera multiples guias PDF en un solo documento.

**Request Body:**
```json
{
  "guias": [
    {
      "numero": "001",
      "ciudad": "BOGOTA",
      "nombre": "JUAN",
      "apellido": "PEREZ",
      "direccion": "Calle 100 #15-20",
      "barrio": "Chapinero",
      "telefono": "3001234567",
      "valorCobrar": 77900,
      "pagoAnticipado": false
    },
    {
      "numero": "002",
      "ciudad": "MEDELLIN",
      "nombre": "MARIA",
      "apellido": "LOPEZ",
      "direccion": "Carrera 45 #30-15",
      "barrio": "Poblado",
      "telefono": "3109876543",
      "valorCobrar": 109900,
      "pagoAnticipado": true
    }
  ]
}
```

**Campos requeridos:**
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `numero` | string | Numero de guia/envio |
| `ciudad` | string | Ciudad destino |
| `nombre` | string | Nombre del destinatario |
| `apellido` | string | Apellido del destinatario |
| `direccion` | string | Direccion de entrega |
| `barrio` | string | Barrio |
| `telefono` | string | Telefono contacto |
| `valorCobrar` | number | Valor a cobrar (COP) |
| `pagoAnticipado` | boolean | Indica si ya esta pagado |

**Respuesta exitosa:**
```json
{
  "success": true,
  "filename": "guias_1708678800000.pdf",
  "pdfUrl": "https://tu-dominio.com/files/guias_1708678800000.pdf",
  "totalGuias": 2
}
```

---

### POST /api/generar-excel-envia
Genera archivo Excel para transportadora Envia.

**Request Body:**
```json
{
  "ordenes": [
    {
      "valor": 77900,
      "nombre": "JUAN PEREZ",
      "telefono": "3001234567",
      "direccion": "Calle 100 #15-20",
      "municipio": "BOGOTA",
      "departamento": "CUNDINAMARCA"
    }
  ]
}
```

**Columnas del Excel generado:**
| Columna | Descripcion |
|---------|-------------|
| Valor | Monto a cobrar |
| Nombre | Nombre completo |
| Telefono | Numero de contacto |
| Direccion | Direccion completa |
| Municipio | Ciudad/Municipio |
| Departamento | Departamento |

**Respuesta exitosa:**
```json
{
  "success": true,
  "filename": "ordenes_envia_1708678800000.xlsx",
  "excelUrl": "https://tu-dominio.com/files/ordenes_envia_1708678800000.xlsx",
  "totalOrdenes": 1
}
```

---

### GET /api/descargar/:filename
Descarga un archivo generado.

**Ejemplo:**
```
GET /api/descargar/guias_1708678800000.pdf
```

---

### GET /api/listar-pdfs
Lista todos los PDFs disponibles.

**Respuesta:**
```json
{
  "files": [
    "guias_1708678800000.pdf",
    "guias_1708678900000.pdf"
  ]
}
```

---

## 6. ESPECIFICACIONES DEL PDF

### Dimensiones
- **Tamano**: 4x6 pulgadas (formato etiqueta de envio)
- **Puntos**: 288 x 432 puntos

### Contenido de cada guia
```
┌────────────────────────────────┐
│         [LOGO SOMNIO]         │
│                                │
│      ENVIO #: 001              │
│      PRIORIDAD                 │
│                                │
│  ─────────────────────────────│
│  DESTINATARIO:                 │
│  JUAN PEREZ                    │
│  Calle 100 #15-20              │
│  Barrio: Chapinero             │
│  BOGOTA                        │
│  Tel: 3001234567               │
│  ─────────────────────────────│
│                                │
│  VALOR A COBRAR:               │
│       $77.900                  │
│                                │
│  [CODIGO DE BARRAS]            │
│                                │
│  ████ PAGO ANTICIPADO ████     │  <- Solo si aplica
└────────────────────────────────┘
```

### Formato de valores
- Moneda colombiana con separador de miles: `$77.900`
- Texto en mayusculas para ciudades y nombres

---

## 7. WORKFLOW N8N RELACIONADO

### Archivo
```
/Agentes Logistica/Robots Logistica.json
```

### Workflow ID
```
eaG7RWwFFu1tbbEC
```

### Comandos Slack que activan el robot

| Comando | Transportadora | Endpoint llamado |
|---------|---------------|------------------|
| `generar guias inter` | Interrapidisimo | `/api/generar-guias` |
| `generar guias bogota` | Bogota | `/api/generar-guias` |
| `generar excel envia` | Envia | `/api/generar-excel-envia` |

### Flujo n8n para Interrapidisimo

```
1. Slack Trigger: "generar guias inter"
              │
              ▼
2. Bigin: Obtener Ordenes (Stage = "ROBOT INTER")
              │
              ▼
3. Claude API: Transformar datos
   - Input: datos crudos de Bigin
   - Output: JSON normalizado
              │
              ▼
4. HTTP Request: POST http://172.18.0.1:3002/api/generar-guias
              │
              ▼
5. Bigin: Actualizar ordenes
   - Stage: "ESPERANDO GUIAS"
   - Transportadora: "INTERRAPIDISIMO"
              │
              ▼
6. Slack: Enviar link de descarga
```

### Transformaciones de Claude AI

| Campo Original | Transformacion | Resultado |
|---------------|----------------|-----------|
| `573163709528` | Quitar prefijo 57 | `3163709528` |
| `bucaramanga + santander` | Formato ciudad | `BUCARAMANGA (STDER)` |
| Precio $77,900 | Calcular unidades | 1 unidad |
| Precio $109,900 | Calcular unidades | 2 unidades |
| Precio $139,900 | Calcular unidades | 3 unidades |

---

## 8. INTEGRACION CON BIGIN (ZOHO CRM)

### Stages del Pipeline

| Stage | Robot que lo procesa | Stage destino |
|-------|---------------------|---------------|
| `ROBOT INTER` | robot-inter-envia-bog | `ESPERANDO GUIAS` |
| `ROBOT ENVIA` | robot-inter-envia-bog | `ESPERANDO GUIAS` |
| `ROBOT COORD` | robot-coordinadora | `COORDINADORA` |

### Autenticacion OAuth 2.0
```
1. n8n envia refresh_token a: https://accounts.zoho.com/oauth/v2/token
2. Obtiene access_token (valido ~1 hora)
3. Header: Authorization: Zoho-oauthtoken [token]
```

---

## 9. DESPLIEGUE

### Requisitos
- Node.js 18+
- Acceso a `/opt/n8n/local-files/` con permisos de escritura
- Caddy configurado para servir archivos

### Instalacion
```bash
cd /Agentes\ Logistica/robot-inter-envia-bog
npm install
```

### Ejecucion en desarrollo
```bash
npm run dev
```

### Ejecucion en produccion (PM2)
```bash
pm2 start npm --name "robot-guias" -- run dev
pm2 save
pm2 startup
```

### Variables de entorno
```env
PORT=3002
OUTPUT_DIR=/opt/n8n/local-files
```

### Configuracion de Caddy
```caddyfile
tu-dominio.com {
    handle /files/* {
        root * /opt/n8n/local-files
        file_server
    }
}
```

---

## 10. TROUBLESHOOTING

| Problema | Causa | Solucion |
|----------|-------|----------|
| `EADDRINUSE` | Puerto 3002 en uso | `lsof -i :3002 -t \| xargs kill -9` |
| `Connection Refused` | IP incorrecta | Usar `172.18.0.1:3002` |
| PDF no se genera | Permisos | `chmod 755 /opt/n8n/local-files/` |
| Timeout | Muchas guias | Aumentar timeout en n8n |
| Error CORS | Origen no permitido | Verificar configuracion cors |

### Logs
```bash
# Ver logs en tiempo real
pm2 logs robot-guias

# Ver ultimas 100 lineas
pm2 logs robot-guias --lines 100
```

### Verificar estado
```bash
curl http://localhost:3002/api/health
```

---

## 11. PRUEBAS

### Probar generacion de guias
```bash
curl -X POST http://localhost:3002/api/generar-guias \
  -H "Content-Type: application/json" \
  -d '{
    "guias": [{
      "numero": "TEST001",
      "ciudad": "BOGOTA",
      "nombre": "JUAN",
      "apellido": "PRUEBA",
      "direccion": "Calle Test 123",
      "barrio": "Centro",
      "telefono": "3001234567",
      "valorCobrar": 77900,
      "pagoAnticipado": false
    }]
  }'
```

### Probar generacion de Excel
```bash
curl -X POST http://localhost:3002/api/generar-excel-envia \
  -H "Content-Type: application/json" \
  -d '{
    "ordenes": [{
      "valor": 77900,
      "nombre": "JUAN PRUEBA",
      "telefono": "3001234567",
      "direccion": "Calle Test 123",
      "municipio": "BOGOTA",
      "departamento": "CUNDINAMARCA"
    }]
  }'
```

---

## 12. RELACION CON OTROS COMPONENTES

### Robots del sistema

| Robot | Puerto | Funcion |
|-------|--------|---------|
| **robot-inter-envia-bog** | 3002 | PDFs y Excel |
| **robot-coordinadora** | 3001 | Pedidos TMS Coordinadora |
| **bigin-robot-api-rest** | 3000 | Crear ordenes en Bigin |

### Sistema v3DSL completo

Este robot es parte del sistema de automatizacion de ventas por WhatsApp:

```
Cliente WhatsApp
       │
       ▼
Callbell → n8n (Historial V3)
       │
       ▼
State Analyzer (Claude) → Data Extractor
       │
       ▼
Order Manager → Bigin (Stage: "ROBOT INTER")
       │
       ▼
Operador: Comando Slack "generar guias inter"
       │
       ▼
n8n → Robot Inter/Envia/Bog → PDF
       │
       ▼
Bigin (Stage: "ESPERANDO GUIAS")
```

---

## 13. REFERENCIAS

- **Repositorio**: [AGENTES-IA-FUNCIONALES-v3](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3)
- **Carpeta del robot**: [robot-inter-envia-bog](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/tree/master/Agentes%20Logistica/robot-inter-envia-bog)
- **Workflow n8n**: [Robots Logistica.json](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/Robots%20Logistica.json)
- **Arquitectura logistica**: [ARQUITECTURA.md](https://github.com/yuseponub/AGENTES-IA-FUNCIONALES-v3/blob/master/Agentes%20Logistica/ARQUITECTURA.md)
