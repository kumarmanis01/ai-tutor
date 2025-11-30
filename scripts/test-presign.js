/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');

const data = JSON.stringify({ filename: 'test-validate.jpg', contentType: 'image/jpeg', userId: 'validate' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/s3-presign',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch (err) {
      console.log('RESPONSE:', body);
      console.log('parse error:', err);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(2);
});

req.write(data);
req.end();
