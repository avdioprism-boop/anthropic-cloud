const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navigating to github.com...');
    const response = await page.goto('https://github.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    console.log('Status:', response?.status());
    const body = await response?.text();
    console.log('Response body (first 500 chars):', body?.substring(0, 500));
    
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  await browser.close();
})();
