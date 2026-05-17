// Measures response times for 2 endpoints and prints summary
(async () => {
  const base = 'http://localhost:3000'
  const endpoints = ['/api/auth/session', '/api/user/profile']
  const iterations = 10
  const warmup = 3
  // fetch polyfill if needed
  let fetchFn = global.fetch
  if (!fetchFn) {
    try { fetchFn = (await import('node-fetch')).default } catch (e) {
      console.error('fetch not available and node-fetch not installed. Install deps before running this script.');
      process.exit(2)
    }
  }

  function mean(arr) { return arr.reduce((a,b)=>a+b,0)/arr.length }
  function median(arr){ const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2 }

  for (const ep of endpoints) {
    console.log('\n--- Measuring', ep, '---')
    // Warmup
    for (let i=0;i<warmup;i++) {
      try { await fetchFn(base+ep, { method: 'GET' }) } catch(e) {}
    }

    const times = []
    const statuses = []
    for (let i=0;i<iterations;i++) {
      const t0 = Date.now()
      try {
        const res = await fetchFn(base+ep, { method: 'GET' })
        const t = Date.now()-t0
        times.push(t)
        statuses.push(res.status)
        console.log(`${ep} #${i+1}: ${t}ms status=${res.status}`)
      } catch (err) {
        const t = Date.now()-t0
        times.push(t)
        statuses.push('ERR')
        console.log(`${ep} #${i+1}: error after ${t}ms -> ${String(err)}`)
      }
    }
    const numericTimes = times.filter(t=>typeof t==='number')
    console.log('\nSummary for', ep)
    console.log('count:', numericTimes.length)
    console.log('mean:', Math.round(mean(numericTimes)) + 'ms')
    console.log('median:', Math.round(median(numericTimes)) + 'ms')
    console.log('statuses:', Array.from(new Set(statuses)).join(', '))
  }
  process.exit(0)
})()
