// Lightweight fetch logger preloader for verbose HTTP debugging
// Usage: node --require ./scripts/_fetch-logger.cjs scripts/test-mvp-flow.cjs
(function () {
  try {
    const origFetch = globalThis.fetch;
    if (!origFetch) return;
    globalThis.fetch = async function (input, init = {}) {
      try {
        const method = (init && init.method) || (input && input.method) || 'GET';
        const url = typeof input === 'string' ? input : (input && input.url) || '<unknown-url>';
        console.log(`[fetch] → ${method} ${url}`);
        if (init && init.headers) console.log('[fetch]   headers:', JSON.stringify(init.headers));
        if (init && init.body) {
          let bodyPreview = init.body;
          try {
            bodyPreview = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
          } catch (_e) {}
          if (bodyPreview && bodyPreview.length > 1000)
            bodyPreview = bodyPreview.slice(0, 1000) + '...';
          console.log('[fetch]   body:', bodyPreview);
        }
        const res = await origFetch(input, init);
        // Try to read response text safely
        let text = '';
        try {
          const clone = res.clone();
          text = await clone.text();
          if (text && text.length > 2000) text = text.slice(0, 2000) + '...';
        } catch (e) {
          text = `<unreadable: ${e.message}>`;
        }
        console.log(`[fetch] ← ${res.status} ${res.statusText} ${url}`);
        if (text) console.log('[fetch]   response body:', text);
        return res;
      } catch (err) {
        console.error('[fetch] wrapper error', err && err.stack ? err.stack : err);
        return origFetch(input, init);
      }
    };
    console.log('[fetch-logger] installed');
  } catch (err) {
    console.error('[fetch-logger] failed to install', err && err.stack ? err.stack : err);
  }
})();
