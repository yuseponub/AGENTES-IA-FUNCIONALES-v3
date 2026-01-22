import 'dotenv/config';
import { CoordinadoraAdapter } from '../adapters/coordinadora-adapter.js';

/**
 * Test de creación de pedido en Coordinadora
 *
 * CUIDADO: Este script CREA un pedido real en el portal
 * Solo ejecutar cuando estés listo para probar
 */
async function testCrearPedido() {
  console.log('🧪 Test de Creación de Pedido en Coordinadora');
  console.log('=============================================\n');
  console.log('⚠️  ADVERTENCIA: Este script creará un pedido REAL');
  console.log('');

  const adapter = new CoordinadoraAdapter({
    url: process.env.COORDINADORA_URL || 'https://ff.coordinadora.com/',
    user: process.env.COORDINADORA_USER || '',
    password: process.env.COORDINADORA_PASSWORD || '',
  });

  try {
    // Datos de prueba
    const testData = {
      nombreDestinatario: 'Juan Perez Prueba',
      telefonoDestinatario: '3001234567',
      direccionDestinatario: 'Calle 123 #45-67 Barrio Centro',
      ciudadDestino: 'BOGOTA',
      departamentoDestino: 'CUNDINAMARCA',
      valorDeclarado: 50000,
      contenido: 'Mercancía de prueba',
      referencia1: 'TEST-001',
      peso: 1,
      alto: 10,
      ancho: 15,
      largo: 20,
    };

    console.log('📦 Datos del pedido de prueba:');
    console.log(`   Nombre: ${testData.nombreDestinatario}`);
    console.log(`   Teléfono: ${testData.telefonoDestinatario}`);
    console.log(`   Dirección: ${testData.direccionDestinatario}`);
    console.log(`   Ciudad: ${testData.ciudadDestino}`);
    console.log(`   Valor: $${testData.valorDeclarado}`);
    console.log('');

    // Crear pedido
    const result = await adapter.createGuia(testData);

    console.log('\n📊 Resultado:');
    console.log(`   Éxito: ${result.success}`);
    if (result.success) {
      console.log(`   Número de pedido: ${result.numeroGuia}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await adapter.close();
    console.log('\n✅ Test completado');
  }
}

// Preguntar antes de ejecutar
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  testCrearPedido();
} else {
  console.log('🧪 Test de Creación de Pedido en Coordinadora');
  console.log('=============================================\n');
  console.log('⚠️  Este script creará un pedido REAL en Coordinadora.');
  console.log('');
  console.log('Para ejecutar, usa:');
  console.log('  npx tsx src/tools/test-crear-pedido.ts --confirm');
  console.log('');
}
