/**
 * Bigin Robot API v2 - Browser On-Demand
 *
 * ARQUITECTURA:
 * 1. Petición llega
 * 2. Se crea instancia del navegador
 * 3. Login → Acción → Logout
 * 4. Se cierra el navegador
 * 5. Respuesta enviada
 *
 * BENEFICIOS:
 * - No consume CPU/RAM cuando no hay peticiones
 * - Cada petición tiene un navegador limpio
 * - No hay problemas de sesión expirada
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { BiginAdapter } from './bigin-adapter';
import { errorHandler, asyncHandler, ApiError } from './middleware/errorHandler';
import type { ApiResponse, CreateOrdenInput, RobotConfig, BiginConfig } from './types';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.ROBOT_API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`\n${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============ CONFIGURACIÓN ============

const robotConfig: RobotConfig = {
  headless: true,
  screenshotsEnabled: process.env.SCREENSHOTS_ENABLED !== 'false',
  storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../storage')
};

const biginConfig: BiginConfig = {
  url: process.env.BIGIN_URL || 'https://accounts.zoho.com/signin',
  email: process.env.BIGIN_EMAIL || '',
  password: process.env.BIGIN_PASSWORD || '',
  passphrase: process.env.BIGIN_PASSPHRASE
};

// ============ RUTAS ============

// Health check
app.get('/', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'Robot API v2 - Browser On-Demand',
    data: {
      version: '2.0.0',
      mode: 'on-demand',
      endpoints: {
        health: '/health',
        createOrder: 'POST /bigin/create-order'
      }
    }
  };
  res.json(response);
});

app.get('/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      mode: 'browser-on-demand',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});

app.get('/bigin/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'ready',
      mode: 'on-demand (browser inicia con cada petición)'
    }
  };
  res.json(response);
});

/**
 * POST /bigin/create-order
 *
 * FLUJO BROWSER ON-DEMAND:
 * 1. Crear instancia BiginAdapter
 * 2. Iniciar navegador
 * 3. Login
 * 4. Crear orden
 * 5. Cerrar navegador (SIEMPRE, incluso si hay error)
 * 6. Responder
 */
app.post('/bigin/create-order', asyncHandler(async (req: express.Request, res: express.Response) => {
  const orderData: CreateOrdenInput = req.body;

  // Validar
  if (!orderData.ordenName) {
    throw new ApiError(400, 'ordenName es requerido');
  }

  if (!biginConfig.email || !biginConfig.password) {
    throw new ApiError(500, 'Faltan credenciales de Bigin en .env');
  }

  console.log('═'.repeat(50));
  console.log('📦 NUEVA ORDEN:', orderData.ordenName);
  console.log('═'.repeat(50));

  // Crear adapter (browser on-demand)
  const adapter = new BiginAdapter(robotConfig, biginConfig);
  let result = null;
  let error = null;

  try {
    // 1. Iniciar navegador
    await adapter.init();

    // 2. Login
    await adapter.login();

    // 3. Crear orden
    result = await adapter.createOrder(orderData);

  } catch (e) {
    error = e;
    console.error('❌ Error en operación:', e);
  } finally {
    // 4. SIEMPRE cerrar navegador (libera recursos)
    try {
      await adapter.close();
    } catch (closeError) {
      console.error('⚠️ Error cerrando navegador:', closeError);
    }
  }

  // 5. Responder
  if (error) {
    throw new ApiError(500, `Error creando orden: ${error instanceof Error ? error.message : error}`);
  }

  const response: ApiResponse = {
    success: true,
    message: 'Orden creada exitosamente',
    data: {
      ordenName: orderData.ordenName,
      orderId: result?.orderId || 'unknown',
      orderUrl: result?.orderUrl || ''
    }
  };

  console.log('═'.repeat(50));
  console.log('✅ ORDEN COMPLETADA');
  console.log('═'.repeat(50));

  res.json(response);
}));

// Error handler (debe ser último)
app.use(errorHandler);

// Iniciar servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   🤖 ROBOT API v2 - BROWSER ON-DEMAND               ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║                                                      ║');
    console.log('║   MODO: On-Demand (navegador inicia/cierra por      ║');
    console.log('║         cada petición)                               ║');
    console.log('║                                                      ║');
    console.log('║   BENEFICIOS:                                        ║');
    console.log('║   - CPU/RAM liberados cuando no hay peticiones      ║');
    console.log('║   - Sin problemas de sesión expirada                ║');
    console.log('║   - Cada petición = navegador limpio                ║');
    console.log('║                                                      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`🚀 Servidor en: http://localhost:${PORT}`);
    console.log(`📖 Endpoints:`);
    console.log(`   GET  /              - Info API`);
    console.log(`   GET  /health        - Health check`);
    console.log(`   GET  /bigin/health  - Estado robot`);
    console.log(`   POST /bigin/create-order - Crear orden\n`);
    console.log('✅ Listo para recibir peticiones!\n');
  });
}

export default app;
