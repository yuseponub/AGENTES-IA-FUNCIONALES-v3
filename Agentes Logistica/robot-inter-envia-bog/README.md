# Robot Inter/Envia/Bog - Analisis Profundo

Servidor Node.js que genera guias PDF para Interrapidisimo/Bogota y archivos Excel para Envia.

**DIFERENCIA CON ROBOT COORDINADORA:** Este robot NO usa browser automation (Playwright). Genera archivos directamente usando librerias de Node.js (PDFKit, ExcelJS).

## Tabla de Contenidos

1. [IMPORTANTE: Operacion del Robot](#importante-operacion-del-robot)
2. [Arquitectura General](#arquitectura-general)
3. [Funciones por Transportadora](#funciones-por-transportadora)
4. [Generacion de PDFs (PDFKit)](#generacion-de-pdfs-pdfkit)
5. [Generacion de Excel (ExcelJS)](#generacion-de-excel-exceljs)
6. [API Endpoints](#api-endpoints)
7. [Estructura del Codigo](#estructura-del-codigo)
8. [Flujo Completo](#flujo-completo)
9. [Configuracion](#configuracion)
10. [GUIA: Crear Generadores Similares](#guia-crear-generadores-similares)

---

## IMPORTANTE: Operacion del Robot

### Servidor donde debe correr

```
SERVIDOR: VPS de produccion (mismo donde corre n8n)
RUTA: /root/proyectos/interrapidisimo-bot
PUERTO: 3002
ARCHIVOS: /opt/n8n/local-files/
URL PUBLICA: https://n8n.automatizacionesmorf.com/download/
```

**CRITICO**: El robot DEBE correr en el mismo servidor que n8n porque:
- n8n llama al robot via `http://172.18.0.1:3002` (IP del host Docker)
- Los archivos se guardan en `/opt/n8n/local-files/`
- Caddy sirve los archivos en `https://n8n.automatizacionesmorf.com/download/`

### Iniciar el servidor

```bash
# Opcion 1: Desarrollo (con hot-reload)
cd /root/proyectos/interrapidisimo-bot
npm run dev

# Opcion 2: Produccion (background con nohup)
cd /root/proyectos/interrapidisimo-bot
nohup npx tsx src/server.ts > /tmp/interrapidisimo-bot.log 2>&1 &

# Opcion 3: Produccion con PM2 (recomendado)
cd /root/proyectos/interrapidisimo-bot
npx pm2 start "npm run dev" --name interrapidisimo-bot --cwd /root/proyectos/interrapidisimo-bot
npx pm2 save
```

### Verificar que esta corriendo

```bash
# Ver si el puerto esta en uso
lsof -i :3002

# Health check
curl http://localhost:3002/api/health

# Ver logs (si uso nohup)
tail -f /tmp/interrapidisimo-bot.log

# Ver logs (si uso pm2)
npx pm2 logs interrapidisimo-bot
```

### Detener el servidor

```bash
# Si uso nohup
lsof -i :3002 -t | xargs kill -9

# Si uso pm2
npx pm2 stop interrapidisimo-bot
npx pm2 delete interrapidisimo-bot
```

### Reiniciar el servidor

```bash
# Matar proceso actual y reiniciar
lsof -i :3002 -t | xargs kill -9 2>/dev/null
cd /root/proyectos/interrapidisimo-bot
nohup npx tsx src/server.ts > /tmp/interrapidisimo-bot.log 2>&1 &

# O con pm2
npx pm2 restart interrapidisimo-bot
```

### Archivos Generados

```
RUTA LOCAL: /opt/n8n/local-files/
URL PUBLICA: https://n8n.automatizacionesmorf.com/download/{filename}

Ejemplos:
- PDF: guias-inter-1737654321000.pdf
- Excel: envia-1737654321000.xlsx

Los archivos son servidos por Caddy (configurado en el VPS).
```

### Troubleshooting Comun

| Problema | Solucion |
|----------|----------|
| "Connection refused" desde n8n | Verificar robot corriendo: `lsof -i :3002` |
| "Cannot find module pdfkit" | Reinstalar: `npm install` |
| PDF vacio o corrupto | Verificar que existen assets (logo, barcode) |
| Excel no abre | Verificar permisos de `/opt/n8n/local-files/` |
| Puerto ocupado | Matar proceso: `lsof -i :3002 -t \| xargs kill -9` |
| Link no funciona | Verificar Caddy sirviendo `/opt/n8n/local-files/` |

---

## Arquitectura General

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│    n8n      │────>│  Robot API       │────>│  Archivos           │
│  (trigger)  │     │  (Express:3002)  │     │  (PDF/Excel)        │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                            │                         │
                            v                         v
                    ┌──────────────────┐     ┌─────────────────────┐
                    │  PDFKit/ExcelJS  │     │  /opt/n8n/local-files
                    │  (generacion)    │     │  (almacenamiento)   │
                    └──────────────────┘     └─────────────────────┘
                                                      │
                                                      v
                                             ┌─────────────────────┐
                                             │  Caddy (web server) │
                                             │  URL publica        │
                                             └─────────────────────┘
```

**Componentes:**
- **n8n**: Orquestador que dispara el robot via HTTP
- **Express Server**: API REST que recibe datos
- **PDFKit**: Genera PDFs de guias (Inter, Bogota)
- **ExcelJS**: Genera Excel (Envia)
- **Caddy**: Sirve archivos estaticos con URL publica

**NOTA:** Este robot NO usa browser. Todo es generacion directa de archivos.

---

## Funciones por Transportadora

| Transportadora | Endpoint | Output | Uso |
|----------------|----------|--------|-----|
| Interrapidisimo | `/api/generar-guias` | PDF | Guias para envios nacionales |
| Bogota | `/api/generar-guias` | PDF | Guias para envios en Bogota |
| Envia | `/api/generar-excel-envia` | Excel | Lista de ordenes para subir a Envia |

### Interrapidisimo / Bogota (Comparten endpoint)

Ambas transportadoras usan el mismo endpoint porque la diferencia es solo la ciudad de destino.

```
Stage Bigin: ROBOT INTER / ROBOT BOGOTA
Endpoint: POST /api/generar-guias
Output: PDF con guias formato 4x6 pulgadas
```

### Envia

```
Stage Bigin: ROBOT ENVIA
Endpoint: POST /api/generar-excel-envia
Output: Excel con columnas especificas para Envia
```

---

## Generacion de PDFs (PDFKit)

### Libreria Utilizada

```json
{
  "pdfkit": "^0.15.0"
}
```

PDFKit es una libreria de Node.js para crear PDFs programaticamente.

### Formato de Guia

```
Tamaño: 4x6 pulgadas (288 x 432 puntos)
Margenes: 10 puntos

Estructura:
┌────────────────────────────┐
│      [LOGO SOMNIO]         │
├────────────────────────────┤
│  ENVIO PRIORIDAD {numero}  │
├────────────────────────────┤
│  ENVIAR A:                 │
│  {NOMBRE APELLIDO}         │
│  {direccion} Barrio {barrio}│
│  {CIUDAD}                  │
│  {telefono}                │
├────────────────────────────┤
│  VALOR A COBRAR:           │
│       ${valor}             │
│    (PAGO ANTICIPADO)       │  <- Solo si aplica
├────────────────────────────┤
│     [CODIGO BARRAS]        │
│      4512345678906         │
└────────────────────────────┘
```

### Codigo Clave de Generacion

```typescript
import PDFDocument from 'pdfkit';

// Crear documento
const doc = new PDFDocument({
  size: [288, 432],  // 4x6 pulgadas
  margins: { top: 10, bottom: 10, left: 10, right: 10 }
});

// Insertar logo
doc.image('assets/logo-somnio.png', x, y, { width: 180 });

// Texto con fuente
doc.fontSize(12).font('Helvetica-Bold');
doc.text('ENVIO PRIORIDAD 1', 10, 63);

// Linea separadora
doc.moveTo(10, 55).lineTo(278, 55).stroke();

// Valor con formato
const valor = data.pagoAnticipado ? '$0' : `$${data.valorCobrar.toLocaleString('es-CO')}`;
doc.fontSize(24).text(valor, 10, 205, { align: 'center' });

// Generar buffer
const chunks: Buffer[] = [];
doc.on('data', chunk => chunks.push(chunk));
doc.on('end', () => resolve(Buffer.concat(chunks)));
doc.end();
```

### Assets Requeridos

```
assets/
├── logo-somnio.png    # Logo de la empresa (180px ancho)
└── barcode.png        # Codigo de barras generico
```

### Deteccion de Pago Anticipado

```typescript
const tienePagoAnticipado =
  p.pagoAnticipado ||                           // Flag explicito
  nombreCompleto.includes('&') ||               // Nombre con &
  (p.tags && p.tags.includes('PAGO ANTICIPADO')); // Tag de Bigin

// Si es pago anticipado:
// - Valor mostrado: $0
// - Texto adicional: "PAGO ANTICIPADO"
```

---

## Generacion de Excel (ExcelJS)

### Libreria Utilizada

```json
{
  "exceljs": "^4.4.0"
}
```

ExcelJS permite crear archivos Excel (.xlsx) con formato.

### Estructura del Excel para Envia

```
| Valor | Nombre completo | Telefono | Direccion completa | Municipio | Departamento |
|-------|-----------------|----------|-------------------|-----------|--------------|
| 77900 | Juan Perez      | 300...   | Calle 123...      | Medellin  | Antioquia    |
```

### Codigo Clave de Generacion

```typescript
import ExcelJS from 'exceljs';

// Crear workbook y worksheet
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Ordenes Envía');

// Definir columnas
worksheet.columns = [
  { header: 'Valor', key: 'valor', width: 15 },
  { header: 'Nombre completo', key: 'nombreCompleto', width: 30 },
  { header: 'Telefono', key: 'telefono', width: 15 },
  { header: 'Direccion completa', key: 'direccion', width: 40 },
  { header: 'Municipio', key: 'municipio', width: 20 },
  { header: 'Departamento', key: 'departamento', width: 20 }
];

// Estilo para encabezados
worksheet.getRow(1).font = { bold: true };
worksheet.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' }
};

// Agregar filas
ordenes.forEach(orden => {
  worksheet.addRow({
    valor: orden.Valor || 0,
    nombreCompleto: orden['Nombre completo'] || '',
    telefono: orden.Telefono || '',
    direccion: orden['Direccion completa'] || '',
    municipio: orden.Municipio || '',
    departamento: orden.Departamento || ''
  });
});

// Guardar archivo
await workbook.xlsx.writeFile(filepath);
```

### Formato de Columnas Envia

| Columna | Descripcion | Fuente en Bigin |
|---------|-------------|-----------------|
| Valor | Monto a cobrar | Amount |
| Nombre completo | Nombre + Apellido | Deal_Name |
| Telefono | Sin 57, 10 digitos | Telefono |
| Direccion completa | Direccion | Direcci_n |
| Municipio | Ciudad destino | Municipio_Dept |
| Departamento | Departamento | Departamento |

---

## API Endpoints

### GET /api/health

Estado del servicio.

```json
{ "status": "ok", "service": "interrapidisimo-bot" }
```

### POST /api/generar-guia

Genera una sola guia PDF.

**Request:**
```json
{
  "numero": 1,
  "ciudad": "BOGOTA",
  "nombre": "JUAN",
  "apellido": "PEREZ",
  "direccion": "Calle 123 #45-67",
  "barrio": "Centro",
  "telefono": "3001234567",
  "valorCobrar": 77900
}
```

**Response:**
```json
{
  "success": true,
  "filename": "guia-BOGOTA-1-1737654321000.pdf",
  "downloadUrl": "https://n8n.automatizacionesmorf.com/download/guia-BOGOTA-1-1737654321000.pdf",
  "size": 12345
}
```

### POST /api/generar-guias

Genera multiples guias en un solo PDF (una pagina por guia).

**Request:**
```json
{
  "pedidos": [
    {
      "ciudad": "BOGOTA",
      "nombres": "JUAN",
      "apellidos": "PEREZ",
      "direccion": "Calle 123 #45-67",
      "barrio": "Centro",
      "celular": "3001234567",
      "totalConIva": 77900,
      "pagoAnticipado": false
    },
    {
      "ciudad": "MEDELLIN",
      "nombres": "MARIA",
      "apellidos": "GARCIA",
      "direccion": "Carrera 50 #30-20",
      "barrio": "Poblado",
      "celular": "3109876543",
      "totalConIva": 109900,
      "pagoAnticipado": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "filename": "guias-inter-1737654321000.pdf",
  "downloadUrl": "https://n8n.automatizacionesmorf.com/download/guias-inter-1737654321000.pdf",
  "size": 24680,
  "guias": [
    { "numero": 1, "nombre": "JUAN PEREZ", "ciudad": "BOGOTA" },
    { "numero": 2, "nombre": "MARIA GARCIA", "ciudad": "MEDELLIN" }
  ]
}
```

### POST /api/generar-excel-envia

Genera Excel para Envia.

**Request:**
```json
{
  "ordenes": [
    {
      "Valor": 77900,
      "Nombre completo": "Juan Perez",
      "Telefono": "3001234567",
      "Direccion completa": "Calle 123 #45-67",
      "Municipio": "Bogota",
      "Departamento": "Cundinamarca"
    }
  ],
  "biginIds": ["123456789"]
}
```

**Response:**
```json
{
  "success": true,
  "total": 1,
  "filename": "envia-1737654321000.xlsx",
  "downloadUrl": "https://n8n.automatizacionesmorf.com/download/envia-1737654321000.xlsx",
  "ordenes": [...],
  "biginIds": ["123456789"]
}
```

### GET /api/download/:filename

Descarga directa de archivo generado.

### GET /api/guias

Lista archivos PDF generados.

---

## Estructura del Codigo

```
robot-inter-envia-bog/
├── src/
│   ├── server.ts           # Express API (endpoints)
│   ├── generate-guide.ts   # Generacion de PDFs
│   └── test-guide.ts       # Script de testing
├── assets/
│   ├── logo-somnio.png     # Logo para PDF
│   └── barcode.png         # Codigo de barras
├── package.json
└── tsconfig.json
```

### Archivos Principales

| Archivo | Funcion |
|---------|---------|
| `server.ts` | API Express con todos los endpoints |
| `generate-guide.ts` | Funciones `generateGuide()` y `generateMultipleGuides()` |

---

## Flujo Completo

### Flujo Interrapidisimo/Bogota

```
1. n8n recibe comando "generar guias inter" en Slack
                    │
2. n8n obtiene ordenes de Bigin (Stage = ROBOT INTER)
                    │
3. n8n prepara datos y llama POST /api/generar-guias
                    │
4. Robot genera PDF con PDFKit
   ├── Una pagina por guia
   ├── Logo, datos, valor
   └── Detecta pago anticipado
                    │
5. Robot guarda PDF en /opt/n8n/local-files/
                    │
6. Robot retorna downloadUrl a n8n
                    │
7. n8n actualiza Bigin (Stage, Transportadora)
                    │
8. n8n envia mensaje a Slack con link
```

### Flujo Envia

```
1. n8n recibe comando "generar excel envia" en Slack
                    │
2. n8n obtiene ordenes de Bigin (Stage = ROBOT ENVIA)
                    │
3. n8n prepara datos y llama POST /api/generar-excel-envia
                    │
4. Robot genera Excel con ExcelJS
   ├── Columnas especificas Envia
   ├── Encabezados con estilo
   └── Una fila por orden
                    │
5. Robot guarda Excel en /opt/n8n/local-files/
                    │
6. Robot retorna downloadUrl a n8n
                    │
7. n8n actualiza Bigin (Stage → ESPERANDO GUIAS, Transportadora → ENVIA)
                    │
8. n8n envia mensaje a Slack con link
```

---

## Configuracion

### Variables de Entorno

```bash
PORT=3002   # Puerto del servidor (default: 3002)
```

### Constantes en Codigo

```typescript
// server.ts
const OUTPUT_DIR = '/opt/n8n/local-files';
const PUBLIC_URL = 'https://n8n.automatizacionesmorf.com/download';

// generate-guide.ts
const PAGE_WIDTH = 4 * 72;   // 288 puntos (4 pulgadas)
const PAGE_HEIGHT = 6 * 72;  // 432 puntos (6 pulgadas)
```

### Dependencias

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "pdfkit": "^0.15.0",
  "exceljs": "^4.4.0"
}
```

---

## GUIA: Crear Generadores Similares

Esta guia explica como crear un robot similar para generar otros tipos de archivos.

### Paso 1: Estructura Base

```bash
mkdir mi-generador
cd mi-generador
mkdir -p src assets

touch src/server.ts
touch src/generate-file.ts
touch package.json
```

### Paso 2: package.json

```json
{
  "name": "mi-generador",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pdfkit": "^0.15.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "@types/express": "^4.17.21"
  }
}
```

### Paso 3: Server Base (Boilerplate)

```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import { generarArchivo } from './generate-file';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3003;
const OUTPUT_DIR = '/opt/n8n/local-files';
const PUBLIC_URL = 'https://n8n.automatizacionesmorf.com/download';

// Crear directorio si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'mi-generador' });
});

// Endpoint principal
app.post('/api/generar', async (req, res) => {
  try {
    const datos = req.body;

    // Validar datos
    if (!datos || Object.keys(datos).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren datos'
      });
    }

    // Generar archivo
    const buffer = await generarArchivo(datos);

    // Guardar archivo
    const filename = `archivo-${Date.now()}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    console.log(`✅ Archivo generado: ${filename}`);

    res.json({
      success: true,
      filename,
      downloadUrl: `${PUBLIC_URL}/${filename}`,
      size: buffer.length
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
```

### Paso 4: Generador PDF Base (Boilerplate)

```typescript
// src/generate-file.ts
import PDFDocument from 'pdfkit';

interface DatosArchivo {
  titulo: string;
  contenido: string;
  // ... otros campos
}

export function generarArchivo(datos: DatosArchivo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Titulo
    doc.fontSize(24).font('Helvetica-Bold');
    doc.text(datos.titulo, { align: 'center' });
    doc.moveDown();

    // Contenido
    doc.fontSize(12).font('Helvetica');
    doc.text(datos.contenido);

    doc.end();
  });
}
```

### Paso 5: Generador Excel Base (Boilerplate)

```typescript
// src/generate-excel.ts
import ExcelJS from 'exceljs';
import * as path from 'path';

interface FilaExcel {
  campo1: string;
  campo2: number;
  // ... otros campos
}

export async function generarExcel(
  filas: FilaExcel[],
  outputPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Datos');

  // Definir columnas
  worksheet.columns = [
    { header: 'Campo 1', key: 'campo1', width: 20 },
    { header: 'Campo 2', key: 'campo2', width: 15 },
  ];

  // Estilo encabezados
  worksheet.getRow(1).font = { bold: true };

  // Agregar filas
  filas.forEach(fila => worksheet.addRow(fila));

  // Guardar
  await workbook.xlsx.writeFile(outputPath);
}
```

### Checklist de Implementacion

```
□ FASE 1: SETUP
  □ Crear estructura de carpetas
  □ Configurar package.json
  □ Instalar dependencias: npm install
  □ Crear server.ts base
  □ Probar health check

□ FASE 2: GENERADOR
  □ Definir formato de salida (PDF/Excel/otro)
  □ Definir estructura de datos de entrada
  □ Implementar funcion generadora
  □ Probar generacion local

□ FASE 3: INTEGRACION
  □ Conectar generador con endpoint
  □ Guardar archivos en OUTPUT_DIR
  □ Retornar downloadUrl
  □ Probar desde curl/Postman

□ FASE 4: N8N
  □ Crear nodo HTTP Request
  □ Usar IP 172.18.0.1 (no localhost)
  □ Parsear respuesta
  □ Usar downloadUrl en Slack
```

### Tips para PDFKit

```typescript
// Tamaños de pagina comunes
'LETTER'           // 8.5 x 11 pulgadas
'A4'               // 210 x 297 mm
[288, 432]         // 4 x 6 pulgadas (personalizado)

// Fuentes disponibles por defecto
'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'
'Times-Roman', 'Times-Bold', 'Times-Italic'
'Courier', 'Courier-Bold', 'Courier-Oblique'

// Insertar imagen
doc.image('path/to/image.png', x, y, { width: 100 });

// Texto con opciones
doc.text('Texto', x, y, {
  width: 200,           // Ancho maximo
  align: 'center',      // left, center, right, justify
  lineGap: 5            // Espacio entre lineas
});

// Linea
doc.moveTo(x1, y1).lineTo(x2, y2).stroke();

// Nueva pagina
doc.addPage();
```

### Tips para ExcelJS

```typescript
// Estilos de celda
worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
worksheet.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '4472C4' }
};

// Ancho de columna
worksheet.getColumn('A').width = 25;

// Formato de numero
worksheet.getColumn('B').numFmt = '$#,##0.00';

// Bordes
worksheet.getCell('A1').border = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

// Alinear texto
worksheet.getCell('A1').alignment = { horizontal: 'center' };

// Combinar celdas
worksheet.mergeCells('A1:C1');
```

### Errores Comunes y Soluciones

| Error | Causa | Solucion |
|-------|-------|----------|
| `Cannot find module 'pdfkit'` | Dependencia no instalada | `npm install pdfkit` |
| `ENOENT: no such file` | Asset no existe | Verificar ruta de imagenes |
| PDF vacio | doc.end() no llamado | Asegurar `doc.end()` al final |
| Excel corrupto | writeFile fallido | Verificar permisos de carpeta |
| Texto cortado en PDF | Ancho insuficiente | Ajustar `width` en text() |
| Imagen no aparece | Ruta incorrecta | Usar path.join para rutas |

---

## Notas Importantes

1. **Sin browser**: Este robot NO usa Playwright, genera archivos directamente
2. **Mismo servidor que n8n**: Usar IP 172.18.0.1 para comunicacion
3. **Archivos en /opt/n8n/local-files/**: Caddy los sirve publicamente
4. **Assets necesarios**: Logo y barcode deben existir en `assets/`
5. **Buffer vs File**: Se genera buffer en memoria, luego se guarda a disco
6. **Formato 4x6**: Las guias son para etiquetas de envio estandar
7. **Pago anticipado**: Se detecta por nombre con & o tag de Bigin
8. **Un servidor, multiples funciones**: PDF (Inter/Bog) y Excel (Envia) en mismo robot
9. **Puerto 3002**: Diferente al robot Coordinadora (3001)
10. **No hay login/sesion**: No requiere autenticacion, genera archivos directamente
