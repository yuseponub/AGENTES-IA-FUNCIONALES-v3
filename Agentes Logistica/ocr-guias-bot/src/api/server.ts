import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Configurar multer para subida de archivos
const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `guia-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

// Cliente de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Tipos
interface GuiaExtraida {
  numeroGuia: string | null;
  destinatario: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  remitente: string | null;
  fechaCreacion: string | null;
  transportadora: string | null;
  confianza: number;
  datosAdicionales: Record<string, string>;
}

interface OCRResult {
  success: boolean;
  guias: GuiaExtraida[];
  textoCompleto?: string;
  error?: string;
}

// Función para convertir imagen a base64
function imageToBase64(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

// Función para determinar el media type
function getMediaType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] || 'image/jpeg';
}

// Función principal de OCR con Claude Vision
async function extraerDatosGuia(imagePaths: string[]): Promise<OCRResult> {
  console.log(`\n🔍 Procesando ${imagePaths.length} imagen(es) con Claude Vision...`);

  try {
    // Preparar las imágenes para Claude
    const imageContents: Anthropic.ImageBlockParam[] = imagePaths.map(imagePath => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: getMediaType(imagePath),
        data: imageToBase64(imagePath),
      },
    }));

    const prompt = `Analiza las siguientes imágenes de guías de transporte/envío y extrae TODOS los números de guía que encuentres.

INSTRUCCIONES IMPORTANTES:
1. Busca números de guía (también llamados "tracking", "# guía", "número de envío", "código de rastreo")
2. Los números de guía suelen ser:
   - Secuencias largas de números (ej: 53180509486, 1234567890123)
   - Códigos alfanuméricos (ej: ENV123456789, GUA-2024-001)
   - Pueden tener prefijos de la transportadora
3. También extrae si es posible: destinatario, dirección, ciudad, teléfono
4. Si hay múltiples guías en las imágenes, extrae TODAS

FORMATO DE RESPUESTA (JSON válido):
{
  "guias": [
    {
      "numeroGuia": "número de guía encontrado",
      "destinatario": "nombre del destinatario o null",
      "direccion": "dirección de entrega o null",
      "ciudad": "ciudad de entrega o null",
      "telefono": "teléfono o null",
      "remitente": "nombre del remitente o null",
      "fechaCreacion": "fecha si aparece o null",
      "transportadora": "nombre de la transportadora (Envia, Coordinadora, Servientrega, etc) o null",
      "confianza": número entre 0 y 100 indicando confianza en la extracción
    }
  ],
  "textoCompleto": "todo el texto visible en las imágenes"
}

IMPORTANTE:
- Si no puedes leer claramente un número de guía, indica confianza baja
- Extrae TODOS los números de guía visibles, incluso si hay múltiples en una imagen
- Para guías de "Envía" (Envia), el número de guía suele empezar con ciertos prefijos
- Responde SOLO con el JSON, sin explicaciones adicionales`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extraer el texto de la respuesta
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    console.log('📄 Respuesta de Claude:', responseText.substring(0, 500));

    // Parsear el JSON de la respuesta
    let parsedResponse: { guias: GuiaExtraida[]; textoCompleto?: string };
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.error('❌ Error parseando respuesta:', parseError);
      return {
        success: false,
        guias: [],
        textoCompleto: responseText,
        error: 'No se pudo parsear la respuesta de Claude',
      };
    }

    const guiasEncontradas = parsedResponse.guias || [];
    console.log(`✅ Encontradas ${guiasEncontradas.length} guía(s)`);

    return {
      success: guiasEncontradas.length > 0,
      guias: guiasEncontradas,
      textoCompleto: parsedResponse.textoCompleto,
    };

  } catch (error) {
    console.error('❌ Error en OCR:', error);
    return {
      success: false,
      guias: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ocr-guias-bot',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

/**
 * POST /api/ocr/imagenes
 * Recibe múltiples imágenes y extrae los datos de guías
 *
 * Form-data: files[] (múltiples archivos)
 */
app.post('/api/ocr/imagenes', upload.array('files', 20), async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📷 POST /api/ocr/imagenes');
  console.log('═'.repeat(60));

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No se recibieron archivos',
    });
  }

  console.log(`📁 Recibidos ${files.length} archivo(s)`);

  try {
    const imagePaths = files.map(f => f.path);
    const result = await extraerDatosGuia(imagePaths);

    // Limpiar archivos temporales
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * POST /api/ocr/base64
 * Recibe imágenes en base64 y extrae los datos de guías
 *
 * Body: { imagenes: [{ data: "base64...", type: "image/jpeg" }, ...] }
 */
app.post('/api/ocr/base64', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📷 POST /api/ocr/base64');
  console.log('═'.repeat(60));

  const { imagenes } = req.body;

  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un array de imagenes en base64',
    });
  }

  console.log(`📁 Recibidas ${imagenes.length} imagen(es) en base64`);

  try {
    // Guardar temporalmente las imágenes
    const tempPaths: string[] = [];
    for (let i = 0; i < imagenes.length; i++) {
      const img = imagenes[i];
      const ext = img.type?.split('/')[1] || 'jpg';
      const tempPath = path.join(uploadDir, `temp-${Date.now()}-${i}.${ext}`);

      // Remover prefijo data:image/...;base64, si existe
      let base64Data = img.data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));
      tempPaths.push(tempPath);
    }

    const result = await extraerDatosGuia(tempPaths);

    // Limpiar archivos temporales
    for (const tempPath of tempPaths) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * POST /api/ocr/urls
 * Recibe URLs de imágenes y extrae los datos de guías
 *
 * Body: {
 *   urls: ["https://...", ...],
 *   slackToken?: "xoxb-..." // Token de Slack para descargar archivos privados
 * }
 */
app.post('/api/ocr/urls', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📷 POST /api/ocr/urls');
  console.log('═'.repeat(60));

  const { urls, slackToken: requestSlackToken } = req.body;

  // Usar token del request o del .env como fallback
  const slackToken = requestSlackToken || process.env.SLACK_BOT_TOKEN;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un array de urls de imágenes',
    });
  }

  console.log(`📁 Recibidas ${urls.length} URL(s)`);
  if (slackToken) {
    console.log('🔑 Token de Slack disponible (env o request)');
  }

  try {
    // Descargar las imágenes
    const tempPaths: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Configurar headers para descarga
      const fetchOptions: RequestInit = {};

      // Si es URL de Slack y tenemos token, agregar autenticación
      if (url.includes('files.slack.com') && slackToken) {
        fetchOptions.headers = {
          'Authorization': `Bearer ${slackToken}`,
        };
        console.log(`🔐 Descargando con auth: ${url.substring(0, 60)}...`);
      } else if (url.includes('files.slack.com') && !slackToken) {
        console.warn(`⚠️ URL de Slack sin token - puede fallar: ${url.substring(0, 60)}...`);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        console.error(`❌ Error descargando ${url}: ${response.status} ${response.statusText}`);
        throw new Error(`Error descargando imagen: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Determinar extensión
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.split('/')[1] || 'jpg';
      const tempPath = path.join(uploadDir, `url-${Date.now()}-${i}.${ext}`);

      fs.writeFileSync(tempPath, Buffer.from(buffer));
      tempPaths.push(tempPath);
    }

    const result = await extraerDatosGuia(tempPaths);

    // Limpiar archivos temporales
    for (const tempPath of tempPaths) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * POST /api/match-guias
 * Recibe guías extraídas por OCR y órdenes de Bigin, y hace el match
 * También valida que los datos de envío sean correctos
 *
 * Body: {
 *   guiasOCR: [{ numeroGuia, destinatario, telefono, direccion, ciudad, ... }],
 *   ordenesBigin: [{ id, Deal_Name, Phone, Direcci_n, Municipio_Dept, ... }],
 *   transportadora: "ENVIA" | "INTER" (opcional)
 * }
 */
app.post('/api/match-guias', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('🔗 POST /api/match-guias');
  console.log('═'.repeat(60));

  const { guiasOCR, ordenesBigin, transportadora } = req.body;

  if (!Array.isArray(guiasOCR) || !Array.isArray(ordenesBigin)) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren arrays de guiasOCR y ordenesBigin',
    });
  }

  console.log(`📋 Guías OCR: ${guiasOCR.length}, Órdenes Bigin: ${ordenesBigin.length}`);
  console.log(`📦 Transportadora: ${transportadora || 'No especificada'}`);

  try {
    // Usar Claude para hacer el match inteligente y validar datos
    const prompt = `Eres un experto en logística colombiana. Tu tarea es hacer MATCH entre guías de transportadora y órdenes de un CRM, y VALIDAR que los datos de envío sean correctos.

## CONTEXTO IMPORTANTE:
- Las guías fueron creadas por personal de oficinas de la transportadora (NO por nosotros)
- Los datos pueden tener pequeñas variaciones de formato pero deben ser esencialmente correctos
- Transportadora: ${transportadora || 'Envía/Inter'}

## DATOS A COMPARAR:

### GUÍAS EXTRAÍDAS POR OCR (de fotos de transportadora):
${JSON.stringify(guiasOCR, null, 2)}

### ÓRDENES DE BIGIN (nuestro CRM - datos correctos de referencia):
${JSON.stringify(ordenesBigin, null, 2)}

## REGLAS DE MATCHING (por prioridad):

### 1. TELÉFONO (MUY IMPORTANTE):
- Debe coincidir el número (ignorar prefijo 57, espacios, guiones)
- Si el teléfono coincide, es casi seguro que es la misma orden
- Ejemplos equivalentes: "3001234567" = "573001234567" = "300 123 4567"

### 2. DIRECCIÓN (MUY IMPORTANTE):
- Puede tener variaciones menores pero debe ser la misma ubicación
- Ejemplos equivalentes:
  - "Calle 8 #6-27" ≈ "CL 8 # 6-27" ≈ "Calle 8 No. 6-27"
  - "Carrera 15 #45-30" ≈ "CR 15 # 45-30" ≈ "KR 15 #45-30"
  - "Av 68 con 80" ≈ "Avenida 68 #80"
- Abreviaturas comunes: CL=Calle, CR/KR=Carrera, AV=Avenida, DG=Diagonal, TV=Transversal

### 3. MUNICIPIO Y DEPARTAMENTO (MUY IMPORTANTE):
- Deben coincidir (ignorar mayúsculas, tildes)
- Ejemplos: "Bogotá" = "BOGOTA" = "Bogota D.C."

### 4. NOMBRE (MENOS IMPORTANTE):
- Puede tener errores de escritura
- Solo usar como referencia adicional, no como criterio principal

## CASO ESPECIAL - INTERRAPIDÍSIMO OFICINA:
Si la transportadora es INTER y la dirección en la guía dice algo como:
- "Recoge en oficina"
- "Oficina Inter"
- "Sede Interrapidisimo"
- "Retira en punto"

Entonces es necesario que coincida:
- Teléfono (SIEMPRE ES OBLIGATORIO)
- Municipio/Ciudad
- Departamento
(La dirección exacta NO es necesaria en este caso, porque recoge en oficina)

## VALIDACIÓN DE DATOS:
Para cada match, verifica si los datos de la GUÍA coinciden con los datos de BIGIN:
- datosCorrectos: true si teléfono, dirección, municipio y departamento son correctos
- discrepancias: lista de diferencias encontradas (si las hay)

## RESPONDE CON JSON:
{
  "matches": [
    {
      "guia": { ...datos completos de la guía OCR... },
      "orden": { ...datos completos de la orden Bigin... },
      "confianza": número 0-100,
      "razon": "explicación del match",
      "datosCorrectos": true/false,
      "esRecogeEnOficina": true/false,
      "discrepancias": [
        {
          "campo": "telefono|direccion|municipio|departamento",
          "valorGuia": "valor en la guía",
          "valorBigin": "valor correcto en Bigin",
          "severidad": "alta|media|baja"
        }
      ]
    }
  ],
  "guiasSinMatch": [ ...guías que no encontraron orden... ],
  "ordenesSinMatch": [ ...órdenes que no encontraron guía... ],
  "resumen": {
    "totalMatches": número,
    "matchesCorrectos": número,
    "matchesConDiscrepancias": número,
    "discrepanciasAltas": número
  }
}

## CRITERIOS DE CONFIANZA:
- 95-100%: Teléfono + dirección + municipio coinciden exactamente
- 85-94%: Teléfono coincide + dirección/municipio similar
- 70-84%: Múltiples campos coinciden con variaciones menores
- 50-69%: Solo algunos campos coinciden (revisar manualmente)
- <50%: Probablemente no es match

IMPORTANTE: Responde SOLO con el JSON, sin explicaciones adicionales.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parsear respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo parsear la respuesta de Claude');
    }

    const matchResult = JSON.parse(jsonMatch[0]);

    console.log(`✅ Matches encontrados: ${matchResult.matches?.length || 0}`);
    console.log(`📊 Correctos: ${matchResult.resumen?.matchesCorrectos || 0}`);
    console.log(`⚠️ Con discrepancias: ${matchResult.resumen?.matchesConDiscrepancias || 0}`);

    res.json({
      success: true,
      ...matchResult,
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 OCR GUIAS BOT');
  console.log('═'.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Endpoints disponibles:');
  console.log(`   GET  /api/health        - Estado del servicio`);
  console.log(`   POST /api/ocr/imagenes  - OCR de archivos (form-data)`);
  console.log(`   POST /api/ocr/base64    - OCR de imágenes en base64`);
  console.log(`   POST /api/ocr/urls      - OCR de URLs de imágenes`);
  console.log(`   POST /api/match-guias   - Match entre guías OCR y órdenes Bigin`);
  console.log('');
  console.log('⏳ Esperando requests...');
  console.log('═'.repeat(60) + '\n');
});
