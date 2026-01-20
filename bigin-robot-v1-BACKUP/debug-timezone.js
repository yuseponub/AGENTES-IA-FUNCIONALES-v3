const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://accounts.zoho.com/signin');
  await page.waitForTimeout(2000);
  
  // Enter email
  await page.fill('#login_id', process.env.BIGIN_EMAIL);
  await page.click('#nextbtn');
  await page.waitForTimeout(5000);
  
  console.log('\n⏳ Waiting for push notification approval...');
  console.log('Please approve in your OneAuth app!\n');
  
  // Wait up to 60 seconds for approval
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(3000);
    const url = page.url();
    
    if (!url.includes('signin') && !url.includes('push')) {
      console.log('✅ Redirected! Checking page content...\n');
      break;
    }
    console.log('⏱️  ' + (i * 3) + 's elapsed...');
  }
  
  // Check what's on the page
  const pageText = await page.evaluate(() => document.body.textContent);
  console.log('Page contains "Update your time zone":', pageText.includes('Update your time zone'));
  console.log('Page contains "Remind me later":', pageText.includes('Remind me later'));
  
  // Try to find timezone elements
  const selectors = [
    'text=Update your time zone'
  ];
  
  console.log('\nTrying selector:');
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      console.log('  ' + sel + ': ' + (el ? '✓ FOUND' : '✗ not found'));
    } catch (e) {
      console.log('  ' + sel + ': ERROR - ' + e.message);
    }
  }
  
  await browser.close();
})();
