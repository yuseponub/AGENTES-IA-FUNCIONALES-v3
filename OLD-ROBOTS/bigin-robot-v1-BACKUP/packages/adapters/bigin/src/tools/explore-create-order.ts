/**
 * Explore Create Order Flow
 *
 * Navigate to Team Pipelines > Ventas Somnio > Ventas Somnio Standard
 * and click on +Orden button to see the form
 */

import dotenv from 'dotenv';
import path from 'path';
import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '../bigin-adapter';

// Load env
dotenv.config({ path: path.join(__dirname, '../../../../../.env') });

async function exploreCreateOrder() {
  console.log('🔍 Exploring Create Order flow in Bigin\n');

  // Initialize robot
  const robot = new RobotBase({
    headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
    slowMo: parseInt(process.env.PLAYWRIGHT_SLOW_MO || '500'),
    screenshotsEnabled: true,
    storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../../../../storage')
  });

  await robot.init();

  // Initialize Bigin adapter
  const bigin = new BiginAdapter(robot, {
    url: process.env.BIGIN_URL!,
    email: process.env.BIGIN_EMAIL!,
    password: process.env.BIGIN_PASSWORD!,
    passphrase: process.env.BIGIN_PASSPHRASE
  });

  try {
    // Login
    await bigin.login();
    console.log('✅ Logged in successfully\n');

    const page = robot.engine.getPage();

    // Step 1: Navigate to Pipelines (should already be there)
    console.log('📍 Step 1: Verifying we are on Pipelines...');
    await robot.engine.wait(2000);

    // Step 2: Look for "Ventas Somnio" pipeline
    console.log('📍 Step 2: Looking for "Ventas Somnio" pipeline...');

    // Take screenshot to see current state
    await page.screenshot({ path: path.join(robot.config.storagePath!, 'artifacts', 'explore-before-navigation.png'), fullPage: true });

    // Try to find and click on "Ventas Somnio"
    const ventasSomnioSelectors = [
      'text=Ventas Somnio',
      'a:has-text("Ventas Somnio")',
      'div:has-text("Ventas Somnio")',
      '[title="Ventas Somnio"]'
    ];

    let foundPipeline = false;
    for (const selector of ventasSomnioSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found "Ventas Somnio" with selector: ${selector}`);
          await element.click();
          foundPipeline = true;
          await robot.engine.wait(3000);
          break;
        }
      } catch (err) {
        // Try next selector
      }
    }

    if (!foundPipeline) {
      console.log('⚠️  Could not find "Ventas Somnio" pipeline automatically');
      console.log('📸 Check screenshots to see available pipelines');
    }

    // Step 3: Look for "+Orden" button
    console.log('📍 Step 3: Looking for "+Orden" button...');
    await page.screenshot({ path: path.join(robot.config.storagePath!, 'artifacts', 'explore-after-navigation.png'), fullPage: true });

    const ordenButtonSelectors = [
      'button:has-text("+Orden")',
      'button:has-text("Orden")',
      'text=+Orden',
      '[title="+Orden"]',
      'button[class*="add"], button[class*="create"]'
    ];

    let foundButton = false;
    for (const selector of ordenButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log(`✅ Found "+Orden" button with selector: ${selector}`);

          // Take screenshot before clicking
          await page.screenshot({ path: path.join(robot.config.storagePath!, 'artifacts', 'explore-before-click-orden.png'), fullPage: true });

          await button.click();
          foundButton = true;
          await robot.engine.wait(3000);

          // Take screenshot of the form
          await page.screenshot({ path: path.join(robot.config.storagePath!, 'artifacts', 'explore-orden-form.png'), fullPage: true });
          console.log('✅ Clicked "+Orden" button, form should be visible');

          break;
        }
      } catch (err) {
        // Try next selector
      }
    }

    if (!foundButton) {
      console.log('⚠️  Could not find "+Orden" button automatically');
    }

    // Step 4: Analyze the form
    console.log('\n📋 Analyzing form fields...');

    // Get all input fields
    const inputs = await page.$$('input, select, textarea');
    console.log(`Found ${inputs.length} form fields`);

    for (let i = 0; i < Math.min(inputs.length, 20); i++) {
      const input = inputs[i];
      const tagName = await input.evaluate((el: any) => el.tagName);
      const type = await input.evaluate((el: any) => el.type || '');
      const name = await input.evaluate((el: any) => el.name || '');
      const placeholder = await input.evaluate((el: any) => el.placeholder || '');
      const id = await input.evaluate((el: any) => el.id || '');

      if (name || placeholder || id) {
        console.log(`  ${i}: <${tagName}> type="${type}" name="${name}" placeholder="${placeholder}" id="${id}"`);
      }
    }

    console.log('\n✅ Exploration complete! Check screenshots in storage/artifacts/');
    console.log('Waiting 30 seconds so you can see the browser...');
    await robot.engine.wait(30000);

  } catch (error) {
    console.error('\n❌ Exploration failed:', error);
  } finally {
    await bigin.close();
  }
}

// Run exploration
exploreCreateOrder().catch(console.error);
