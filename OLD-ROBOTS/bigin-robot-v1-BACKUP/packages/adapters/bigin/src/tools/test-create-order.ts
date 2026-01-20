/**
 * Test script for createOrder functionality
 *
 * This script tests creating a new orden in Bigin's Ventas Somnio pipeline
 */

import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '../bigin-adapter';
import type { CreateOrdenInput } from '../types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function testCreateOrder() {
  console.log('🧪 Testing Create Order functionality\n');

  // Initialize Robot Base
  console.log('🚀 Initializing Playwright browser...');
  const robot = new RobotBase({
    headless: true, // Set to true for server environments without display
    screenshotsEnabled: true,
    storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage')
  });
  await robot.init();
  console.log('✅ Browser initialized');
  console.log('✅ Robot Base initialized\n');

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

    // Prepare test order data
    const testOrder: CreateOrdenInput = {
      ordenName: `Test Order ${new Date().toISOString().slice(0, 10)}`,
      contactName: 'Test Customer',
      amount: 100000,
      telefono: '+57 300 123 4567',
      direccion: 'Calle 123 #45-67',
      municipio: 'Bogotá',
      departamento: 'Cundinamarca',
      email: 'test@example.com',
      description: 'This is a test order created via automation',
      closingDate: new Date().toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '/')
    };

    console.log('📋 Test Order Data:');
    console.log(JSON.stringify(testOrder, null, 2));
    console.log();

    // Create order
    await adapter.createOrder(testOrder);
    console.log('✅ Order created successfully!');

    console.log('\n✅ Test complete! Check screenshots in storage/artifacts/');
    console.log('Waiting 10 seconds so you can see the result in the browser...');
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
testCreateOrder().catch(console.error);
