import 'dotenv/config';
import { CoordinadoraAdapter } from '../adapters/coordinadora-adapter.js';

/**
 * Script para probar el login en Coordinadora
 * Ejecutar: npm run test:login-coordinadora
 */
async function testLogin() {
  console.log('🧪 Test de Login en Coordinadora');
  console.log('================================\n');

  const adapter = new CoordinadoraAdapter({
    url: process.env.COORDINADORA_URL || 'https://ff.coordinadora.com/',
    user: process.env.COORDINADORA_USER || '',
    password: process.env.COORDINADORA_PASSWORD || '',
  });

  try {
    console.log('📍 URL:', process.env.COORDINADORA_URL);
    console.log('👤 Usuario:', process.env.COORDINADORA_USER);
    console.log('');

    const success = await adapter.login();

    if (success) {
      console.log('\n✅ Login exitoso!');
      console.log('🔍 Revisa el navegador para ver la interfaz de Coordinadora');
      console.log('   Toma screenshots del proceso de creación de guías');
      console.log('\nPresiona Ctrl+C para cerrar...');

      // Mantener el navegador abierto para explorar
      await new Promise(() => {});
    } else {
      console.log('\n❌ Login falló');
      await adapter.close();
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    await adapter.close();
    process.exit(1);
  }
}

testLogin();
