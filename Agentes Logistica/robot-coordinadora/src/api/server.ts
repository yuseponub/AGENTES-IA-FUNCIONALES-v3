import 'dotenv/config';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CoordinadoraAdapter } from '../adapters/coordinadora-adapter.js';

const app = express();
app.use(express.json());

// Cargar lista de TODAS las ciudades de Coordinadora (1488)
let todasLasCiudades: string[] = [];
try {
  const filePath = path.join(process.cwd(), 'ciudades-coordinadora.txt');
  const content = fs.readFileSync(filePath, 'utf-8');
  todasLasCiudades = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  console.log(`📋 Cargadas ${todasLasCiudades.length} ciudades totales`);
} catch (e) {
  console.log('⚠️ No se pudo cargar lista de ciudades');
}

// Cargar lista de ciudades CON RECAUDO (1181)
let ciudadesConRecaudo: Set<string> = new Set();
try {
  const filePath = path.join(process.cwd(), 'ciudades-SI-recaudo.txt');
  const content = fs.readFileSync(filePath, 'utf-8');
  ciudadesConRecaudo = new Set(
    content.split('\n')
      .map(line => line.trim().toUpperCase())
      .filter(line => line.length > 0)
  );
  console.log(`📋 Cargadas ${ciudadesConRecaudo.size} ciudades con recaudo`);
} catch (e) {
  console.log('⚠️ No se pudo cargar lista de ciudades con recaudo');
}

// Mapeo de departamentos a abreviaturas
const MAPEO_DEPARTAMENTOS: Record<string, string> = {
  'ANTIOQUIA': 'ANT',
  'ATLANTICO': 'ATL',
  'BOLIVAR': 'BOL',
  'BOYACA': 'BOY',
  'CALDAS': 'CDAS',
  'CAQUETA': 'CAQ',
  'CASANARE': 'C/NARE',
  'CAUCA': 'CAU',
  'CESAR': 'CES',
  'CHOCO': 'CHOCO',
  'CORDOBA': 'CORD',
  'CUNDINAMARCA': 'C/MARCA',
  'GUAINIA': 'GUAI',
  'GUAVIARE': 'G/VIARE',
  'HUILA': 'HLA',
  'LA GUAJIRA': 'GUAJ',
  'GUAJIRA': 'GUAJ',
  'MAGDALENA': 'MG/LENA',
  'META': 'META',
  'NARIÑO': 'NAR',
  'NARINO': 'NAR',
  'NORTE DE SANTANDER': 'N/STDER',
  'PUTUMAYO': 'P/MAYO',
  'QUINDIO': 'QDIO',
  'RISARALDA': 'RS',
  'SAN ANDRES': 'S/ANDRES',
  'SAN ANDRES Y PROVIDENCIA': 'S/ANDRES',
  'SANTANDER': 'STDER',
  'SUCRE': 'SUCRE',
  'TOLIMA': 'TOL',
  'VALLE': 'VALLE',
  'VALLE DEL CAUCA': 'VALLE',
  'VAUPES': 'V/PES',
  'VICHADA': 'VICH',
  'AMAZONAS': 'AMAZ',
  'ARAUCA': 'ARAU',
  'BOGOTA': 'C/MARCA',
  'BOGOTA D.C.': 'C/MARCA',
  'BOGOTA D.C': 'C/MARCA',
  'DISTRITO CAPITAL': 'C/MARCA',
};

// Función para normalizar texto (quitar acentos, mayúsculas)
function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Función para buscar ciudad exacta en la lista
function buscarCiudadExacta(municipio: string, departamento: string): string | null {
  const municipioNorm = normalizar(municipio);
  const deptoNorm = normalizar(departamento);
  const abrevDepto = MAPEO_DEPARTAMENTOS[deptoNorm] || deptoNorm;

  // Buscar coincidencia exacta: "MUNICIPIO (ABREV)" (normalizando ambos lados)
  const busqueda1 = `${municipioNorm} (${abrevDepto})`;
  const encontrada = todasLasCiudades.find(c => normalizar(c) === busqueda1);
  if (encontrada) return encontrada;

  // Buscar solo por municipio (si hay una sola coincidencia)
  const coincidencias = todasLasCiudades.filter(c =>
    normalizar(c).startsWith(municipioNorm + ' (')
  );
  if (coincidencias.length === 1) return coincidencias[0];

  // Buscar con abreviatura en cualquier posición
  const conAbrev = coincidencias.find(c => c.includes(`(${abrevDepto})`));
  if (conAbrev) return conAbrev;

  return null;
}

// Función para verificar si ciudad acepta recaudo
function ciudadAceptaRecaudo(ciudad: string): boolean {
  const ciudadNorm = normalizar(ciudad);
  // Buscar en el set normalizando cada ciudad
  for (const c of ciudadesConRecaudo) {
    if (normalizar(c) === ciudadNorm) return true;
  }
  return false;
}

// Crear nuevo adapter para cada sesión (abre browser, lo cierra al terminar)
async function createAdapter(): Promise<CoordinadoraAdapter> {
  const adapter = new CoordinadoraAdapter({
    url: process.env.COORDINADORA_URL || 'https://ff.coordinadora.com/',
    user: process.env.COORDINADORA_USER || '',
    password: process.env.COORDINADORA_PASSWORD || '',
  });

  console.log('🚀 Iniciando browser...');
  await adapter.init();

  console.log('🔐 Haciendo login en Coordinadora...');
  const loginOk = await adapter.login();
  if (!loginOk) {
    await adapter.close();
    throw new Error('Error en login de Coordinadora');
  }
  console.log('✅ Login exitoso');

  return adapter;
}

// Función legacy para compatibilidad (deprecada)
function getAdapter(): CoordinadoraAdapter {
  throw new Error('getAdapter() deprecado. Usar createAdapter() con async/await');
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS - Datos que n8n enviará (ya limpios por la IA)
// ═══════════════════════════════════════════════════════════════════

interface PedidoInput {
  // Datos del destinatario (YA LIMPIOS por n8n/IA)
  identificacion: string;      // Teléfono sin 57, sin espacios (10 dígitos)
  nombres: string;             // Solo el nombre
  apellidos: string;           // Solo los apellidos
  direccion: string;           // Dirección completa
  ciudad: string;              // Ciudad para buscar en dropdown
  departamento: string;        // Para filtrar ciudad correcta
  celular: string;             // Igual que identificación
  email?: string;              // Opcional

  // Datos del pedido
  referencia: string;          // "AA1" normalmente
  unidades: number;            // 1, 2, o 3 según valor
  totalConIva: number;         // 77900, 109900, 139900, etc.
  valorDeclarado: number;      // Siempre 55000
  esRecaudoContraentrega: boolean; // true=SI, false=NO (pago anticipado)

  // Medidas (valores por defecto si no se envían)
  peso?: number;               // Default: 0.08
  alto?: number;               // Default: 5
  largo?: number;              // Default: 5
  ancho?: number;              // Default: 10

  // Metadata de Bigin (para referencia)
  biginOrderId?: string;       // ID de la orden en Bigin
  biginOrderName?: string;     // Nombre de la orden en Bigin
}

// ═══════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/health
 * Verifica que el robot está funcionando
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'coordinadora-bot',
    timestamp: new Date().toISOString(),
    ciudadesTotales: todasLasCiudades.length,
    ciudadesConRecaudo: ciudadesConRecaudo.size,
  });
});

/**
 * POST /api/validar-ciudad
 * Valida y normaliza el nombre de la ciudad para Coordinadora
 * Verifica si acepta recaudo contraentrega
 */
app.post('/api/validar-ciudad', (req, res) => {
  const { municipio, departamento, esRecaudo } = req.body;

  if (!municipio || !departamento) {
    return res.status(400).json({
      success: false,
      error: 'Faltan campos: municipio y departamento son requeridos',
    });
  }

  const ciudadExacta = buscarCiudadExacta(municipio, departamento);

  if (!ciudadExacta) {
    return res.json({
      success: false,
      error: `No se encontró el municipio "${municipio}" en ${departamento}`,
      municipio,
      departamento,
    });
  }

  const aceptaRecaudo = ciudadAceptaRecaudo(ciudadExacta);

  // Si va con recaudo pero no acepta, es error
  if (esRecaudo && !aceptaRecaudo) {
    return res.json({
      success: false,
      error: `El municipio ${ciudadExacta} NO acepta recaudo contraentrega`,
      ciudadExacta,
      aceptaRecaudo: false,
      municipio,
      departamento,
    });
  }

  res.json({
    success: true,
    ciudadExacta,
    aceptaRecaudo,
    municipio,
    departamento,
  });
});

/**
 * POST /api/validar-pedidos
 * Valida múltiples pedidos de una vez (para usar después de Claude)
 */
app.post('/api/validar-pedidos', (req, res) => {
  const pedidos = req.body.pedidos || req.body;

  if (!Array.isArray(pedidos)) {
    return res.status(400).json({
      success: false,
      error: 'Se esperaba un array de pedidos',
    });
  }

  const resultados = pedidos.map((pedido: any, index: number) => {
    const { ciudad, departamento, esRecaudoContraentrega } = pedido;

    // Extraer municipio de ciudad si viene en formato "MUNICIPIO (DEPTO)"
    let municipio = ciudad;
    if (ciudad && ciudad.includes('(')) {
      municipio = ciudad.split('(')[0].trim();
    }

    const ciudadExacta = buscarCiudadExacta(municipio, departamento || '');

    if (!ciudadExacta) {
      return {
        ...pedido,
        _index: index,
        _error: `No se encontró el municipio "${municipio}" en "${departamento}"`,
        _valido: false,
      };
    }

    const aceptaRecaudo = ciudadAceptaRecaudo(ciudadExacta);

    if (esRecaudoContraentrega && !aceptaRecaudo) {
      return {
        ...pedido,
        _index: index,
        _error: `${ciudadExacta} NO acepta recaudo contraentrega`,
        _valido: false,
        ciudad: ciudadExacta,
        _aceptaRecaudo: false,
      };
    }

    return {
      ...pedido,
      _index: index,
      _valido: true,
      ciudad: ciudadExacta,
      _aceptaRecaudo: aceptaRecaudo,
    };
  });

  const validos = resultados.filter((r: any) => r._valido);
  const invalidos = resultados.filter((r: any) => !r._valido);

  res.json({
    success: invalidos.length === 0,
    total: pedidos.length,
    validos: validos.length,
    invalidos: invalidos.length,
    pedidos: resultados,
  });
});

/**
 * GET /api/ultimo-pedido
 * Obtiene el último número de pedido en Coordinadora
 */
app.get('/api/ultimo-pedido', async (req, res) => {
  console.log('📋 GET /api/ultimo-pedido');

  let coordinadora: CoordinadoraAdapter | null = null;

  try {
    coordinadora = await createAdapter();
    const ultimoPedido = await coordinadora.getLastPedidoNumber();

    res.json({
      success: true,
      ultimoPedido,
      siguientePedido: ultimoPedido + 1,
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  } finally {
    if (coordinadora) {
      console.log('🔒 Cerrando browser...');
      await coordinadora.close();
    }
  }
});

/**
 * POST /api/crear-pedido
 * Crea un pedido en Coordinadora con datos ya limpios
 *
 * Body: PedidoInput (datos ya procesados por n8n/IA)
 */
app.post('/api/crear-pedido', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📦 POST /api/crear-pedido');
  console.log('═'.repeat(60));

  const input: PedidoInput = req.body;

  // Validaciones básicas
  const errores: string[] = [];

  if (!input.identificacion) errores.push('Falta: identificacion');
  if (!input.nombres) errores.push('Falta: nombres');
  if (!input.apellidos) errores.push('Falta: apellidos');
  if (!input.direccion) errores.push('Falta: direccion');
  if (!input.ciudad) errores.push('Falta: ciudad');
  if (!input.celular) errores.push('Falta: celular');
  if (!input.totalConIva) errores.push('Falta: totalConIva');

  // Validar celular (10 dígitos)
  const celularLimpio = input.celular?.replace(/\D/g, '');
  if (celularLimpio && celularLimpio.length !== 10) {
    errores.push(`Celular debe tener 10 dígitos (tiene ${celularLimpio.length})`);
  }

  if (errores.length > 0) {
    console.log('❌ Validación fallida:', errores);
    return res.status(400).json({
      success: false,
      error: 'Datos incompletos o inválidos',
      detalles: errores,
    });
  }

  console.log('📋 Datos recibidos:');
  console.log(`   Nombre: ${input.nombres} ${input.apellidos}`);
  console.log(`   Ciudad: ${input.ciudad} (${input.departamento})`);
  console.log(`   Celular: ${input.celular}`);
  console.log(`   Valor: $${input.totalConIva}`);
  console.log(`   Recaudo: ${input.esRecaudoContraentrega ? 'SI' : 'NO'}`);

  // Validar recaudo contraentrega
  if (input.esRecaudoContraentrega && !ciudadAceptaRecaudo(input.ciudad)) {
    console.log(`❌ Ciudad ${input.ciudad} NO acepta recaudo contraentrega`);
    return res.status(400).json({
      success: false,
      error: `El municipio ${input.ciudad} NO permite recaudo contraentrega. Debe enviarse como pago anticipado.`,
      ciudad: input.ciudad,
      biginOrderId: input.biginOrderId,
    });
  }

  if (input.esRecaudoContraentrega) {
    console.log(`   ✓ Ciudad ${input.ciudad} acepta recaudo`);
  }

  let coordinadora: CoordinadoraAdapter | null = null;

  try {
    // Crear nuevo adapter (abre browser y hace login)
    coordinadora = await createAdapter();

    // Si es pago anticipado (no recaudo), el total debe ser 0
    const totalFinal = input.esRecaudoContraentrega ? input.totalConIva : 0;

    // Crear pedido con datos directos
    const result = await coordinadora.createGuiaConDatosCompletos({
      identificacion: input.identificacion,
      nombres: input.nombres,
      apellidos: input.apellidos,
      direccion: input.direccion,
      ciudad: input.ciudad,
      departamento: input.departamento,
      celular: input.celular,
      email: input.email || undefined,
      referencia: input.referencia || 'AA1',
      unidades: input.unidades || 1,
      totalIva: 0,
      totalConIva: totalFinal,
      valorDeclarado: input.valorDeclarado || 55000,
      esRecaudoContraentrega: input.esRecaudoContraentrega,
      peso: input.peso || 0.08,
      alto: input.alto || 5,
      largo: input.largo || 5,
      ancho: input.ancho || 10,
    });

    if (result.success) {
      console.log(`✅ Pedido creado: ${result.numeroGuia}`);
      res.json({
        success: true,
        numeroPedido: result.numeroGuia,
        mensaje: `Pedido ${result.numeroGuia} creado exitosamente`,
        biginOrderId: input.biginOrderId,
      });
    } else {
      console.log(`❌ Error: ${result.error}`);
      res.status(500).json({
        success: false,
        error: result.error,
        biginOrderId: input.biginOrderId,
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      biginOrderId: input.biginOrderId,
    });
  } finally {
    // Siempre cerrar el browser al terminar
    if (coordinadora) {
      console.log('🔒 Cerrando browser...');
      await coordinadora.close();
      console.log('✅ Browser cerrado');
    }
  }
});

/**
 * POST /api/crear-pedidos-batch
 * Crea múltiples pedidos en secuencia
 */
app.post('/api/crear-pedidos-batch', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📦 POST /api/crear-pedidos-batch');
  console.log('═'.repeat(60));

  const pedidos: PedidoInput[] = req.body.pedidos;

  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un array de pedidos',
    });
  }

  console.log(`📋 Procesando ${pedidos.length} pedidos...`);

  const resultados: any[] = [];

  for (let i = 0; i < pedidos.length; i++) {
    const pedido = pedidos[i];
    console.log(`\n[${i + 1}/${pedidos.length}] Procesando: ${pedido.nombres} ${pedido.apellidos}`);

    try {
      // Hacer request interno al endpoint individual
      const response = await fetch(`http://localhost:${PORT}/api/crear-pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      const result = await response.json();
      resultados.push({
        ...result,
        index: i,
        biginOrderId: pedido.biginOrderId,
      });

      // Pausa entre pedidos para no sobrecargar
      if (i < pedidos.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (error) {
      resultados.push({
        success: false,
        error: error instanceof Error ? error.message : 'Error',
        index: i,
        biginOrderId: pedido.biginOrderId,
      });
    }
  }

  const exitosos = resultados.filter(r => r.success).length;
  const fallidos = resultados.filter(r => !r.success).length;

  console.log(`\n📊 Resumen: ${exitosos} exitosos, ${fallidos} fallidos`);

  res.json({
    success: fallidos === 0,
    total: pedidos.length,
    exitosos,
    fallidos,
    resultados,
  });
});

// ═══════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 COORDINADORA BOT API');
  console.log('═'.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Endpoints disponibles:');
  console.log(`   GET  /api/health         - Estado del servicio`);
  console.log(`   GET  /api/ultimo-pedido  - Último número de pedido`);
  console.log(`   POST /api/crear-pedido   - Crear un pedido`);
  console.log(`   POST /api/crear-pedidos-batch - Crear múltiples pedidos`);
  console.log('');
  console.log('⏳ Esperando requests de n8n...');
  console.log('═'.repeat(60) + '\n');
});
