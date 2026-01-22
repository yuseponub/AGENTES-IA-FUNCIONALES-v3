import 'dotenv/config';
import { CoordinadoraAdapter } from '../adapters/coordinadora-adapter.js';

/**
 * Test para verificar que podemos obtener el último número de pedido
 */
async function testUltimoPedido() {
  console.log('🧪 Test: Obtener último número de pedido');
  console.log('========================================\n');

  const adapter = new CoordinadoraAdapter({
    url: process.env.COORDINADORA_URL || 'https://ff.coordinadora.com/',
    user: process.env.COORDINADORA_USER || '',
    password: process.env.COORDINADORA_PASSWORD || '',
  });

  try {
    const lastNumber = await adapter.getLastPedidoNumber();
    console.log(`\n📊 Resultado:`);
    console.log(`   Último pedido: ${lastNumber}`);
    console.log(`   Siguiente pedido sería: ${lastNumber + 1}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await adapter.close();
  }
}

testUltimoPedido();
