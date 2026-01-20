/**
 * Test script - Create a real order with user specifications
 */

import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '../bigin-adapter';
import type { CreateOrdenInput } from '../types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function createRealOrder() {
  console.log('🧪 Creating real order in Bigin\n');

  // Initialize Robot Base
  console.log('🚀 Initializing Playwright browser...');
  const robot = new RobotBase({
    headless: true, // Running in server environment
    screenshotsEnabled: true,
    storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage')
  });
  await robot.init();
  console.log('✅ Browser initialized\n');

  // Initialize Bigin adapter
  const adapter = new BiginAdapter(robot, {
    url: process.env.BIGIN_URL || 'https://accounts.zoho.com/signin',
    email: process.env.BIGIN_EMAIL!,
    password: process.env.BIGIN_PASSWORD!,
    passphrase: process.env.BIGIN_PASSPHRASE
  });

  try {
    // Login
    await adapter.login();
    console.log('✅ Logged in successfully\n');

    // Get today's date in DD/MM/YYYY format
    const today = new Date();
    const closingDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Prepare order data with user specifications
    const orderData: CreateOrdenInput = {
      ordenName: `Orden Prueba ${today.toISOString().slice(0, 10)}`,
      // contactName: empty as specified
      subPipeline: 'Ventas Somnio Standard',
      stage: 'Nuevo Ingreso',
      closingDate: closingDate, // Today's date
      amount: 50000, // Example amount - valor de la promo
      telefono: '573001234567', // Sin + y números pegados
      direccion: 'Calle 123 #45-67 Barrio Centro', // nomenclatura + barrio
      municipio: 'Bogotá',
      departamento: 'Cundinamarca',
      email: 'cliente.prueba@example.com',
      description: 'WPP',
      // callBell: empty (no access to conversation link)
      // transportadora: empty (en stage "Nuevo Ingreso")
      // guia: empty (en stage "Nuevo Ingreso")
    };

    console.log('📋 Order Data:');
    console.log(JSON.stringify(orderData, null, 2));
    console.log();

    // Create order
    console.log('🚀 Creating order...\n');
    await adapter.createOrder(orderData);

    console.log('\n✅ Order created successfully!');
    console.log('📸 Check screenshots in storage/artifacts/');
    console.log('\nWaiting 10 seconds so you can see the result...');
    await robot.engine.wait(10000);
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Close browser
    await adapter.close();
    console.log('🔴 Browser closed\n');
  }
}

// Run the test
createRealOrder().catch(console.error);
