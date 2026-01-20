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
  
  console.log('Looking for expandable elements...\n');
  
  // Look for all visible elements with text containing "sign in", "another", "more options", etc
  const expandButtons = await page.$$eval('*', els => 
    els
      .filter(el => {
        const text = el.textContent?.toLowerCase() || '';
        const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return visible && (
          text.includes('sign in') ||
          text.includes('another') ||
          text.includes('more') ||
          text.includes('other') ||
          text.includes('different')
        );
      })
      .map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 100),
        id: el.id,
        class: el.className
      }))
  );
  
  console.log('Expandable/alternative elements:');
  expandButtons.forEach((el, i) => {
    if (el.text.length < 200) {  // Filter out large blocks
      console.log(`${i}: <${el.tag}> "${el.text}"`);
    }
  });
  
  // Check for specific text elements
  const hasOtherOptions = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasAnotherWay: body.includes('another way'),
      hasMoreOptions: body.includes('more options'),
      hasOtherMethods: body.includes('other method')
    };
  });
  
  console.log('\nText patterns:', hasOtherOptions);
  
  // Look for the link parent that might need clicking
  const linkParent = await page.evaluate(() => {
    const link = document.querySelector('a:has-text("Sign in using password")');
    if (link) {
      const parent = link.parentElement;
      return {
        parentTag: parent?.tagName,
        parentClass: parent?.className,
        parentId: parent?.id,
        parentVisible: !!(parent?.offsetWidth || parent?.offsetHeight || parent?.getClientRects()?.length)
      };
    }
    return null;
  });
  
  console.log('\nLink parent info:', linkParent);
  
  await browser.close();
})();
