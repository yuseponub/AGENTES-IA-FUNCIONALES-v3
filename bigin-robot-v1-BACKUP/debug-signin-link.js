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
  
  // Find all links and buttons with specific text
  const links = await page.$$eval('a, button', elements => 
    elements.map(el => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      href: el.href || '',
      id: el.id,
      class: el.className
    }))
  );
  
  console.log('\nAll links and buttons:');
  links.filter(l => l.text).forEach((link, i) => {
    console.log(`${link.tag} ${i}: text="${link.text}"`);
  });
  
  // Specifically look for "Sign in another way"
  const signInLink = links.find(l => l.text.toLowerCase().includes('sign in'));
  console.log('\nFound "sign in" link:', signInLink);
  
  await browser.close();
})();
