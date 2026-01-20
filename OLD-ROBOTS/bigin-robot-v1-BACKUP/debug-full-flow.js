const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://accounts.zoho.com/signin');
  await page.waitForTimeout(2000);
  
  // Enter email
  console.log('Entering email...');
  await page.fill('#login_id', process.env.BIGIN_EMAIL);
  await page.click('#nextbtn');
  
  console.log('Waiting 5 seconds...');
  await page.waitForTimeout(5000);
  
  // Check what's visible
  const title = await page.title();
  console.log('\nPage title:', title);
  
  const text = await page.textContent('body');
  console.log('\nPage contains "Verify push":', text.includes('Verify push'));
  console.log('Page contains "password":', text.includes('password'));
  
  // Try to find the password field
  const passwordField = await page.$('#password');
  console.log('\nPassword field exists:', !!passwordField);
  if (passwordField) {
    const isVisible = await passwordField.isVisible();
    console.log('Password field visible:', isVisible);
  }
  
  // Find all visible text
  console.log('\nVisible headings:');
  const headings = await page.$$eval('h1, h2, h3, .heading', els => els.map(el => el.textContent.trim()));
  headings.forEach(h => console.log(' -', h));
  
  // Get screenshot
  await page.screenshot({ path: '/home/n8n-claude/proyectos/modelo-ia-distribuida/debug-after-email.png', fullPage: true });
  console.log('\nScreenshot saved to debug-after-email.png');
  
  await browser.close();
})();
