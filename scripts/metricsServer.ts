import http from 'http';
import { metricsOutput } from '../lib/alerts/metrics';

const PORT = Number(process.env.METRICS_PORT || 9187);

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 404;
    return res.end();
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
