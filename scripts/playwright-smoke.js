const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let foundGlobalError = false;

  page.on('console', (msg) => {
    try {
      const text = msg.text();
      console.log('[PAGE console]', text);
      if (text && text.toLowerCase().includes('global is not defined')) {
        foundGlobalError = true;
      }
    } catch (e) {
      console.log('[PAGE console] (could not read)');
    }
  });

  page.on('pageerror', (err) => {
    console.error('[PAGE error]', err && err.message ? err.message : String(err));
    if (String(err).toLowerCase().includes('global is not defined')) foundGlobalError = true;
  });

  try {
    const url = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000/profile';
    console.log('Visiting', url);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Give client scripts a short window to run
    await page.waitForTimeout(2000);

    if (foundGlobalError) {
      console.error('Detected "global is not defined" in page console');
      await browser.close();
      process.exit(2);
    }

    console.log('No obvious "global is not defined" error observed');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Smoke run error', err);
    try { await browser.close(); } catch {}
    process.exit(3);
  }
})();
