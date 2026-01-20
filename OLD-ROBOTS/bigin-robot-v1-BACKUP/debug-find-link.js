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
  
  // Try different selectors for "Sign in using password"
  const selectors = [
    'a:has-text("Sign in using password")',
    'a:text("Sign in using password")',
    'a.signinwithpasswd',
    'a[class*="passwd"]',
    'a[href*="password"]'
  ];
  
  console.log('Testing selectors:');
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      console.log(`✓ ${sel} -> Found:`, !!el);
      if (el) {
        const text = await el.textContent();
        const isVisible = await el.isVisible();
        console.log(`  Text: "${text.trim()}", Visible: ${isVisible}`);
      }
    } catch (e) {
      console.log(`✗ ${sel} -> Error:`, e.message);
    }
  }
  
  // Get all links and their visibility
  const allLinks = await page.$$eval('a', links => 
    links.map(link => ({
      text: link.textContent.trim(),
      href: link.href,
      class: link.className,
      visible: !!(link.offsetWidth || link.offsetHeight || link.getClientRects().length)
    }))
  );
  
  console.log('\nAll VISIBLE links:');
  allLinks.filter(l => l.visible && l.text).forEach((link, i) => {
    console.log(`Link ${i}: "${link.text}", class="${link.class}"`);
  });
  
  await browser.close();
})();
