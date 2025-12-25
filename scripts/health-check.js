(async () => {
  try {
    const metricsUrl = process.env.METRICS_URL || 'http://localhost:3000/api/metrics'
    const jobsUrl = process.env.JOBS_STATUS_URL || 'http://localhost:3000/api/admin/jobs/status'

    console.log('Checking metrics endpoint:', metricsUrl)
    const mres = await fetch(metricsUrl)
    if (!mres.ok) {
      console.error('Metrics endpoint returned non-200:', mres.status)
      process.exitCode = 2
      return
    }
    const mtext = await mres.text()
    if (mtext.length === 0) console.warn('Metrics endpoint returned empty body (204/empty)')
    else if (!/job_runs_total|job_failures_total|job_duration_ms/.test(mtext)) {
      console.warn('Metrics endpoint does not contain expected job_* metrics')
    } else {
      console.log('Metrics endpoint contains job_* metrics')
    }

    console.log('Checking jobs status endpoint:', jobsUrl)
    const jres = await fetch(jobsUrl)
    if (!jres.ok) {
      console.error('Jobs status endpoint returned non-200:', jres.status)
      process.exitCode = 3
      return
    }
    const jjson = await jres.json()
    if (!jjson.jobs || !Array.isArray(jjson.jobs)) {
      console.error('Jobs status response missing jobs array')
      process.exitCode = 4
      return
    }
    console.log('Registered jobs:', jjson.jobs.map((j) => j.name || j).join(', ') || '(none)')
    console.log('Health check passed')
  } catch (err) {
    console.error('Health check failed', err)
    process.exitCode = 1
  }
})()
