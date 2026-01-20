/**
 * Simple order creation - assumes you're already logged in to Bigin
 * This version skips the login and goes straight to order creation
 */

import { RobotBase } from '@modelo-ia/robot-base';
import type { CreateOrdenInput } from '../types';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function simpleCreateOrder() {
  console.log('🧪 Simple Order Creation (no login)\n');

  const robot = new RobotBase({
    headless: false,
    screenshotsEnabled: true,
    storagePath: path.join(__dirname, '../../../../../storage')
  });

  try {
    await robot.init();
    console.log('✅ Browser initialized\n');
  } catch (err) {
    console.error('❌ Browser init failed. Using headless mode...');
    process.exit(1);
  }

  const page = robot.engine.getPage();

  try {
    console.log('📍 Step 1: Navigate to Bigin...');
    await robot.engine.goto('https://bigin.zoho.com');
    await robot.engine.wait(5000);
    console.log('✅ Loaded Bigin');

    console.log('\n⚠️  MANUAL STEP: Please log in to Bigin in the browser window');
    console.log('    Once you see the Pipelines page, press ENTER here...');

    // Wait for user to press enter
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    console.log('\n📍 Step 2: Navigating to Ventas Somnio...');

    // Click on Ventas Somnio
    const ventasSomnioSelectors = [
      'text=Ventas Somnio',
      'a:has-text("Ventas Somnio")'
    ];

    let found = false;
    for (const selector of ventasSomnioSelectors) {
      try {
        const el = await page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          console.log(`✅ Clicked Ventas Somnio`);
          found = true;
          break;
        }
      } catch (e) {}
    }

    if (!found) {
      throw new Error('Could not find Ventas Somnio pipeline');
    }

    await robot.engine.wait(2000);

    console.log('📍 Step 3: Clicking +Orden button...');
    await page.locator('button:has-text("Orden")').first().click();
    console.log('✅ Clicked +Orden');

    await robot.engine.wait(2000);

    // Get today's date
    const today = new Date();
    const closingDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    console.log('\n📍 Step 4: Filling form...');

    // Fill order name
    await page.locator('input[placeholder*="Orden Name"], input[name*="ordenName"]').first().fill(`Orden Prueba ${today.toISOString().slice(0, 10)}`);
    console.log('✓ Orden Name filled');

    // Sub Pipeline
    try {
      await page.locator('input[placeholder*="Sub Pipeline"], select[name*="subPipeline"]').first().click();
      await robot.engine.wait(500);
      await page.locator('text="Ventas Somnio Standard"').first().click();
      console.log('✓ Sub Pipeline selected');
    } catch (e) {
      console.log('⚠️  Could not set Sub Pipeline');
    }

    // Stage
    try {
      await page.locator('input[placeholder*="Stage"], select[name*="stage"]').first().click();
      await robot.engine.wait(500);
      await page.locator('text="Nuevo Ingreso"').first().click();
      console.log('✓ Stage selected');
    } catch (e) {
      console.log('⚠️  Could not set Stage');
    }

    // Closing Date
    await page.locator('input[placeholder*="DD/MM/YYYY"]').first().fill(closingDate);
    console.log(`✓ Closing Date: ${closingDate}`);

    // Amount
    await page.locator('input[placeholder*="Amount"], input[name*="amount"]').first().fill('50000');
    console.log('✓ Amount: 50000');

    // Telefono
    await page.locator('input[placeholder*="Telefono"], input[name*="telefono"]').first().fill('573001234567');
    console.log('✓ Telefono filled');

    // Direccion
    await page.locator('input[placeholder*="Direcci"], input[name*="direccion"]').first().fill('Calle 123 #45-67 Barrio Centro');
    console.log('✓ Direccion filled');

    // Municipio
    await page.locator('input[placeholder*="Municipio"], input[name*="municipio"]').first().fill('Bogotá');
    console.log('✓ Municipio filled');

    // Departamento
    await page.locator('input[placeholder*="Departamento"], input[name*="departamento"]').first().fill('Cundinamarca');
    console.log('✓ Departamento filled');

    // Email
    await page.locator('input[placeholder*="email"], input[name*="email"]').first().fill('cliente.prueba@example.com');
    console.log('✓ Email filled');

    // Description
    await page.locator('textarea[placeholder*="orden"], textarea[name*="description"]').first().fill('WPP');
    console.log('✓ Description filled');

    console.log('\n📍 Step 5: Saving order...');
    await page.locator('button:has-text("Save")').first().click();
    console.log('✅ Clicked Save button');

    await robot.engine.wait(5000);

    console.log('\n✅✅✅ ORDER CREATED! ✅✅✅');
    console.log('\nKeeping browser open for 30 seconds so you can verify...');
    await robot.engine.wait(30000);

  } catch (error) {
    console.error('\n❌ Error:', error);
    await robot.engine.wait(5000);
  } finally {
    await robot.close();
    console.log('\n🔴 Browser closed');
  }
}

simpleCreateOrder().catch(console.error);
