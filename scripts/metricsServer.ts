import http from 'http';
import { metricsOutput } from '@/lib/alerts/metrics';

// health/readiness endpoints
function healthResponse(res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
}

const PORT = Number(process.env.METRICS_PORT || 9187);

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 404;
    return res.end();
  }

  if (req.url === '/health' || req.url === '/ready') {
    // Basic health/readiness: metrics registry exists and service is up.
    return healthResponse(res);
  }

  if (req.url === '/metrics') {
    try {
      const body = await metricsOutput();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.end(body);
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ event: 'metrics_server_listening', port: PORT }));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
