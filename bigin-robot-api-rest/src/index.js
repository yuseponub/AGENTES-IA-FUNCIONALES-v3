/**
 * Bigin Robot API REST
 *
 * Crea órdenes en Bigin usando la API REST de Zoho
 * Sin browser automation - Mucho más rápido y confiable
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Token management
let currentAccessToken = process.env.ZOHO_ACCESS_TOKEN;

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken() {
  try {
    console.log('🔄 Refreshing access token...');

    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });

    currentAccessToken = response.data.access_token;
    console.log('✅ Access token refreshed');

    return currentAccessToken;
  } catch (error) {
    console.error('❌ Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Convert order_body format to Bigin API format
 */
function convertToBiginFormat(orderBody) {
  // Convertir fecha de DD/MM/YYYY a YYYY-MM-DD
  let closingDate = orderBody.closingDate;
  if (closingDate && closingDate.includes('/')) {
    const [day, month, year] = closingDate.split('/');
    closingDate = `${year}-${month}-${day}`;
  }

  return {
    data: [
      {
        Deal_Name: orderBody.ordenName,
        Sub_Pipeline: process.env.BIGIN_SUB_PIPELINE || 'Ventas Somnio Standard',
        Stage: orderBody.stage || 'Nuevo Ingreso',
        Closing_Date: closingDate,
        Amount: orderBody.amount,
        Phone: orderBody.telefono,
        Street: orderBody.direccion,
        City: orderBody.municipio,
        State: orderBody.departamento,
        Email: orderBody.email,
        Description: orderBody.description || '',
        // Campos custom
        CallBell: orderBody.callBell
      }
    ]
  };
}

/**
 * Create order in Bigin
 */
async function createBiginOrder(orderBody, retryCount = 0) {
  try {
    const biginData = convertToBiginFormat(orderBody);

    console.log('📝 Creating order:', orderBody.ordenName);
    console.log('📊 Bigin data:', JSON.stringify(biginData, null, 2));

    const response = await axios.post(
      `${process.env.BIGIN_API_DOMAIN}/bigin/v2/Pipelines`,
      biginData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data.data[0];

    if (result.status === 'success') {
      const orderId = result.details.id;
      const orderUrl = `https://bigin.zoho.com/bigin/org857936781/Home#/deals/${orderId}?section=activities`;

      console.log('✅ Order created successfully');
      console.log('📎 Order ID:', orderId);
      console.log('🔗 Order URL:', orderUrl);

      return {
        success: true,
        message: 'Order created successfully',
        data: {
          ordenName: orderBody.ordenName,
          orderId: orderId,
          orderUrl: orderUrl
        }
      };
    } else {
      throw new Error(`Bigin API error: ${result.message}`);
    }

  } catch (error) {
    // Si el token expiró, refrescar y reintentar
    if (error.response?.data?.code === 'INVALID_TOKEN' && retryCount === 0) {
      console.log('⚠️  Token expired, refreshing...');
      await refreshAccessToken();
      return createBiginOrder(orderBody, retryCount + 1);
    }

    console.error('❌ Error creating order:', error.response?.data || error.message);
    throw error;
  }
}

// Routes

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bigin Robot API REST - Running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      createOrder: 'POST /bigin/create-order'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/bigin/create-order', async (req, res) => {
  try {
    const orderBody = req.body;

    // Validar campos requeridos
    if (!orderBody.ordenName) {
      return res.status(400).json({
        success: false,
        error: 'ordenName is required'
      });
    }

    // Crear orden
    const result = await createBiginOrder(orderBody);

    res.json(result);

  } catch (error) {
    console.error('❌ Error in /bigin/create-order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error creating order'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   🤖 BIGIN ROBOT API REST v1.0                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║                                                      ║');
  console.log('║   🚀 API REST - Sin browser automation              ║');
  console.log('║   ⚡ Rápido, confiable, sin OneAuth                 ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Servidor en: http://localhost:${PORT}`);
  console.log(`📖 Endpoints:`);
  console.log(`   GET  /              - Info API`);
  console.log(`   GET  /health        - Health check`);
  console.log(`   POST /bigin/create-order - Crear orden\n`);
  console.log('✅ Listo para recibir peticiones!\n');
});
