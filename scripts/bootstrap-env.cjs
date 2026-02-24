require('dotenv').config({ path: '.env.local' });

const required = ['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required env: ${key}`);
    process.exit(1);
  }
});
