# Spinzy Production Deployment Guide

## Hostinger VPS + AlmaLinux + PM2 + Nginx + Redis

This document provides a **very detailed deployment checklist tailored for Hostinger VPS** so that you can later generate **automation scripts (bash / Ansible / CI)** from it.

The goal is to deploy Spinzy with:

* AlmaLinux VPS
* Nginx reverse proxy
* Node.js runtime
* PM2 process manager
* Redis queue engine
* PostgreSQL database
* BullMQ workers
* Next.js web application
* AI content generation pipeline

This architecture supports the Spinzy platform consisting of:

```text
Student App
Admin App
API Layer
Worker Processes
AI Generation Jobs
Analytics
```

---

## 1. Hostinger VPS Preparation

### Step 1 — Create VPS in Hostinger

Recommended configuration for MVP:

```text
CPU: 4 vCPU
RAM: 8 GB
Storage: 80 GB SSD
OS: AlmaLinux 9
```

Next.js server, BullMQ workers, Redis, and AI job queues will all run reliably.

---

## 2. Access the Server

After VPS creation Hostinger provides: **IP address**, **root password**

Login from your machine:

```bash
ssh root@SERVER_IP
```

Example:

```bash
ssh root@185.xxx.xxx.xxx
```

---

## 3. Update the System

Immediately update the OS.

```bash
dnf update -y
```

Also install base utilities:

```bash
dnf install -y curl wget nano git unzip tar
```

---

## 4. Create a Non-Root Deployment User

Never run production apps as root.

Create user:

```bash
adduser spinzy
```

Set password:

```bash
passwd spinzy
```

Add sudo privileges:

```bash
usermod -aG wheel spinzy
```

Switch to user:

```bash
su - spinzy
```

---

## 5. Setup SSH Key Authentication

From your local machine:

```bash
ssh-copy-id spinzy@SERVER_IP
```

Then disable password login. Edit ssh config:

```bash
sudo nano /etc/ssh/sshd_config
```

Set: `PasswordAuthentication no`

Restart ssh:

```bash
sudo systemctl restart sshd
```

---

## 6. Configure Firewall

Hostinger VPS uses firewalld.

Start firewall:

```bash
sudo systemctl enable firewalld
sudo systemctl start firewalld
```

Allow required ports:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
```

Reload firewall:

```bash
sudo firewall-cmd --reload
```

---

## 7. Install Node.js Runtime

Spinzy requires Node 20.

Install NodeSource repo:

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
```

Install node:

```bash
sudo dnf install -y nodejs
```

Verify:

```bash
node -v
npm -v
```

Expected: `v20.x`

---

## 8. Install PM2 Process Manager

PM2 runs all application processes.

Install globally:

```bash
sudo npm install -g pm2
```

Verify:

```bash
pm2 -v
```

---

## 9. Install Nginx Reverse Proxy

Install nginx:

```bash
sudo dnf install -y nginx
```

Enable service:

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

Test:

```bash
curl http://localhost
```

---

## 10. Install Redis

Redis powers BullMQ queues.

Install redis:

```bash
sudo dnf install -y redis
```

Enable service:

```bash
sudo systemctl enable redis
sudo systemctl start redis
```

Test:

```bash
redis-cli ping
```

Expected response: `PONG`

---

## 11. Create Application Directory

Create the deployment directory.

```bash
sudo mkdir -p /opt/spinzy
```

Give ownership:

```bash
sudo chown -R spinzy:spinzy /opt/spinzy
```

Move into directory:

```bash
cd /opt/spinzy
```

---

## 12. Clone Spinzy Repository

Example:

```bash
git clone https://github.com/YOUR_REPO/spinzy.git app
```

Move into app folder:

```bash
cd app
```

---

## 13. Install Node Dependencies

Install all packages.

```bash
npm install
```

---

## 14. Create Environment Variables

Create `.env` file.

```bash
nano .env
```

Example configuration:

```env
NODE_ENV=production

DATABASE_URL=postgres_connection_string

REDIS_URL=redis://127.0.0.1:6379

OPENAI_API_KEY=xxxxx

NEXTAUTH_SECRET=random_string

NEXTAUTH_URL=https://spinzyacademy.com
```

---

## 15. Setup Database

Spinzy database is PostgreSQL. Recommended providers: **Neon**, **Supabase**, **AWS RDS**. Use connection string in `.env`.

---

## 16. Run Prisma Migrations

Apply schema to production database.

```bash
npx prisma migrate deploy
```

---

## 17. Generate Prisma Client

```bash
npx prisma generate
```

---

## 18. Build Next.js Application

Build production bundle.

```bash
npm run build
```

This creates: `.next`, `dist`

---

## 19. Verify Worker Files

Ensure worker files exist. Example:

```text
dist/workers/contentWorker.js
dist/workers/questionWorker.js
dist/workers/analyticsWorker.js
```

Workers process BullMQ queues.

---

## 20. Create PM2 Ecosystem File

Create configuration:

```bash
nano ecosystem.config.js
```

Example:

```javascript
module.exports = {
  apps: [

    {
      name: "spinzy-web",
      script: "npm",
      args: "start",
      cwd: "/opt/spinzy/app",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },

    {
      name: "spinzy-worker-content",
      script: "dist/workers/contentWorker.js",
      cwd: "/opt/spinzy/app"
    },

    {
      name: "spinzy-worker-questions",
      script: "dist/workers/questionWorker.js",
      cwd: "/opt/spinzy/app"
    },

    {
      name: "spinzy-worker-analytics",
      script: "dist/workers/analyticsWorker.js",
      cwd: "/opt/spinzy/app"
    }

  ]
};
```

---

## 21. Start All Services

Run:

```bash
pm2 start ecosystem.config.js
```

Check processes:

```bash
pm2 list
```

You should see: spinzy-web, spinzy-worker-content, spinzy-worker-questions, spinzy-worker-analytics

---

## 22. Enable Auto Start

Ensure processes start on reboot.

```bash
pm2 startup
pm2 save
```

---

## 23. Configure Nginx Reverse Proxy

Create site config:

```bash
sudo nano /etc/nginx/conf.d/spinzy.conf
```

Example:

```nginx
server {
    listen 80;
    server_name spinzyacademy.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## 24. Restart Nginx

```bash
sudo systemctl restart nginx
```

---

## 25. Install SSL Certificate

Install certbot:

```bash
sudo dnf install certbot python3-certbot-nginx -y
```

Generate SSL:

```bash
sudo certbot --nginx -d spinzyacademy.com
```

---

## 26. Enable SSL Auto Renewal

Check timer:

```bash
systemctl list-timers
```

Certbot auto-renew runs automatically.

---

## 27. Monitor Logs

View application logs:

```bash
pm2 logs
```

Log location: `~/.pm2/logs`

---

## 28. Setup Health Endpoint

Add endpoint: `/api/health`

Example response:

```json
{
  "status": "ok"
}
```

Monitoring tools can use this.

---

## 29. Setup Monitoring Tools

**Recommended:** UptimeRobot, BetterStack, Sentry

**Monitor:** API uptime, Worker failures, Queue backlog

---

## 30. Verify Complete System

Test full flow:

- Dashboard loads
- Lesson starts
- Practice works
- Homework assigned
- Workers generate content
- Redis queues process jobs
- Database writes succeed

If all checks pass: **Spinzy is production ready.**

---

## Final Production Architecture

```text
Users
   │
   ▼
Nginx Reverse Proxy
   │
   ▼
Next.js Web Server (PM2)
   │
   ▼
API Layer
   │
   ▼
PostgreSQL Database
   │
   ▼
Redis Queue Engine
   │
   ▼
BullMQ Workers
   │
   ▼
AI Content Generation
```

---

## Expected MVP Capacity

One Hostinger VPS with **4 vCPU**, **8GB RAM** can support approximately **5k – 10k students** before splitting workers to separate machines.

---

## Next Evolution (When Scaling)

Future architecture:

```text
Server 1 → Web App
Server 2 → Workers
Server 3 → Redis
Server 4 → Database
```

This supports **100k+ students** without major architectural changes.

---

*End of Deployment Guide*
