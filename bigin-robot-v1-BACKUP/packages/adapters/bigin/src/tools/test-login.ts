/**
 * Test Bigin Login
 *
 * Quick test to verify login works
 */

import dotenv from 'dotenv';
import path from 'path';
import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '../bigin-adapter';

// Load env
dotenv.config({ path: path.join(__dirname, '../../../../../.env') });

async function testLogin() {
  console.log('🧪 Testing Bigin Login\n');

  // Validate env vars
  if (!process.env.BIGIN_URL || !process.env.BIGIN_EMAIL || !process.env.BIGIN_PASSWORD) {
    console.error('❌ Missing environment variables!');
    console.error('Please copy .env.example to .env and fill in your Bigin credentials');
    process.exit(1);
  }

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
    otp: process.env.BIGIN_OTP,
    passphrase: process.env.BIGIN_PASSPHRASE
  });

  try {
    // Test login
    await bigin.login();

    console.log('\n✅ Login test passed!');
    console.log('Press Ctrl+C to exit or wait 10 seconds...');

    // Wait 10 seconds so you can see the browser
    await robot.engine.wait(10000);

  } catch (error) {
    console.error('\n❌ Login test failed:', error);
    process.exit(1);
  } finally {
    await bigin.close();
  }
}

// Run test
testLogin().catch(console.error);
