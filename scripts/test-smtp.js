const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Load .env.local into process.env for local verification (non-destructive)
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      // Strip optional surrounding quotes
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
} else {
  console.warn('.env.local not found at', envPath);
}

(async () => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: true,
    requireTLS: true,
    tls: { ciphers: 'SSLv3' },
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
    debug: true,
  });

  try {
    await transporter.verify();
    console.log('SMTP verified successfully');
  } catch (err) {
    console.error('SMTP verify failed:', err);
    process.exitCode = 1;
  }
})();
