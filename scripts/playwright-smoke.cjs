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
    // Use domcontentloaded instead of networkidle to avoid hanging on long-lived
    // requests (SSE/WebSocket). Allow a 30s timeout for the navigation.
    try {
      // Use 'commit' to proceed once the navigation is committed (headers received).
      // This avoids waiting for full DOMContentLoaded on streaming/SSR pages.
      await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
    } catch (commitErr) {
      console.warn(
        'Goto commit warning:',
        commitErr && commitErr.message ? commitErr.message : String(commitErr)
      );
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
      } catch (domErr) {
        console.warn(
          'Goto domcontentloaded warning:',
          domErr && domErr.message ? domErr.message : String(domErr)
        );
      }
    }

    // Give client scripts a short window to run even if navigation partially timed out
    await page.waitForTimeout(2500);

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
    try {
      await browser.close();
    } catch {}
    process.exit(3);
  }
})();
