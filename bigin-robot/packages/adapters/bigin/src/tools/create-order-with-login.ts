/**
 * Create order - Handles login and creates order
 * Run this manually, approve OneAuth when prompted
 */

import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '../bigin-adapter';
import type { CreateOrdenInput } from '../types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function createOrderWithLogin() {
  console.log('🧪 Creating order in Bigin (with manual OneAuth approval)\n');

  // Initialize Robot Base - headless false so you can see and approve OneAuth
  console.log('🚀 Initializing Playwright browser (visible mode)...');
  console.log('⚠️  IMPORTANT: You will need to approve the OneAuth push notification!\n');

  const robot = new RobotBase({
    headless: false, // Visible browser
    screenshotsEnabled: true,
    storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../../../../../storage')
  });

  try {
    await robot.init();
    console.log('✅ Browser initialized\n');
  } catch (err) {
    console.error('❌ Could not initialize browser (maybe no display available)');
    console.error('   Try running with: DISPLAY=:0 node dist/tools/create-order-with-login.js');
    throw err;
  }

  // Initialize Bigin adapter
  const adapter = new BiginAdapter(robot, {
    url: process.env.BIGIN_URL || 'https://accounts.zoho.com/signin',
    email: process.env.BIGIN_EMAIL!,
    password: process.env.BIGIN_PASSWORD!,
    passphrase: process.env.BIGIN_PASSPHRASE
  });

  try {
    // Login (will show OneAuth notification - user must approve)
    console.log('🔐 Logging in...');
    console.log('📱 Watch for the OneAuth verification number and approve it in your app!\n');
    await adapter.login();
    console.log('\n✅ Logged in successfully!\n');

    // Get today's date in DD/MM/YYYY format
    const today = new Date();
    const closingDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Prepare order data
    const orderData: CreateOrdenInput = {
      ordenName: `Orden Prueba ${today.toISOString().slice(0, 10)}`,
      // contactName: empty as specified
      subPipeline: 'Ventas Somnio Standard',
      stage: 'Nuevo Ingreso',
      closingDate: closingDate,
      amount: 50000,
      telefono: '573001234567',
      direccion: 'Calle 123 #45-67 Barrio Centro',
      municipio: 'Bogotá',
      departamento: 'Cundinamarca',
      email: 'cliente.prueba@example.com',
      description: 'WPP'
    };

    console.log('📋 Order Data:');
    console.log(JSON.stringify(orderData, null, 2));
    console.log();

    // Create order
    console.log('🚀 Creating order...\n');
    await adapter.createOrder(orderData);

    console.log('\n✅✅✅ ORDER CREATED SUCCESSFULLY! ✅✅✅');
    console.log('📸 Check screenshots in storage/artifacts/');
    console.log('\nKeeping browser open for 15 seconds so you can verify...');
    await robot.engine.wait(15000);
  } catch (error) {
    console.error('\n❌ Failed:', error);
    console.log('\n📸 Check error screenshots in storage/artifacts/');
    await robot.engine.wait(5000);
    throw error;
  } finally {
    await adapter.close();
    console.log('\n🔴 Browser closed');
  }
}

// Run
createOrderWithLogin().catch((err) => {
  console.error('\n❌ Script failed:', err.message);
  process.exit(1);
});
