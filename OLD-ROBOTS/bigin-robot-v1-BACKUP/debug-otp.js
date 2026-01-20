const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://accounts.zoho.com/signin');
  await page.waitForSelector('#login_id');
  await page.fill('#login_id', 'joseromerorincon041100@gmail.com');
  await page.click('#nextbtn');
  await page.waitForTimeout(2000);
  
  await page.fill('#password', 'Jmcarolita123');
  await page.click('#nextbtn');
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: '/home/n8n-claude/proyectos/modelo-ia-distribuida/storage/debug-otp.png' });
  
  // Get all input fields
  const inputs = await page.$$('input');
  console.log(`Found ${inputs.length} input fields`);
  
  for (let i = 0; i < inputs.length; i++) {
    const placeholder = await inputs[i].getAttribute('placeholder');
    const name = await inputs[i].getAttribute('name');
    const id = await inputs[i].getAttribute('id');
    const type = await inputs[i].getAttribute('type');
    console.log(`Input ${i}: placeholder="${placeholder}", name="${name}", id="${id}", type="${type}"`);
  }
  
  await browser.close();
}

debug().catch(console.error);
