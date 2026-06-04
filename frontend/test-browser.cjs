const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    console.log("Navigating to localhost:5173...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 5000 });
    
    console.log("Waiting 2s...");
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Closing...");
    await browser.close();
  } catch (err) {
    console.error("Script error:", err);
    process.exit(1);
  }
})();
