Now let’s do a clean, production-grade VPS verification run so you can be 100% sure everything is correct.
I’ll give this as a guided checklist you can literally follow line-by-line on the VPS.

---

🧭 VPS Verification Guide (Post-Fix)
Goal:
Confirm that env loading, build artifacts, and PM2 workers are all correct in a fresh production-like state.

---

🟢 PHASE 1 — Clean slate (important)
cd ~/apps/content-engine/ai-tutor
1️⃣ Stop everything

```bash
pm2 stop all
pm2 delete all
```

Verify:

```bash
pm2 list
```

Should be empty.

---

2️⃣ Clean build artifacts

```bash
rm -rf dist node_modules .turbo .cache
```

(Optional but recommended if env was messy earlier)

```bash
rm -f .env
```

⚠️ Do NOT delete .env.production

---

🟢 PHASE 2 — Environment sanity check
3️⃣ Verify only ONE .env.production exists

```bash
find . -name ".env.production" -type f
```

✅ Expected:

```text
./.env.production
```

If you see more → delete the extras.

---

4️⃣ Verify .env.production is correct

```bash
grep -E "NODE_ENV|DATABASE_URL|REDIS_URL" .env.production
```

Expected:

```text
NODE_ENV=production
DATABASE_URL=...
REDIS_URL=rediss://...
```

---

5️⃣ Confirm shell does NOT auto-load env

```bash
echo $REDIS_URL
```

Expected:

```text
(empty)
```

✅ This is GOOD — production must rely on PM2/env injection.

---

🟢 PHASE 3 — Install & Build (critical)
6️⃣ Install dependencies

```bash
npm ci
```

Why ci?
• deterministic
• no hidden cache

---

7️⃣ Generate Prisma client

```bash
npx prisma generate
```

Verify:

```bash
ls node_modules/.prisma/client >/dev/null && echo "Prisma OK"
```

---

8️⃣ Build everything

```bash
npm run build
```

🚨 If this fails, stop here and paste the error.

---

9️⃣ Verify NO dotenv in dist

```bash
grep -R "dotenv" dist || echo "✅ dotenv not present in dist"
```

This is non-negotiable.

---

🟢 PHASE 4 — Runtime verification (before PM2)
🔍 10️⃣ Dry-run worker manually (MOST IMPORTANT)

```bash
NODE_ENV=production \
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d= -f2-)" \
REDIS_URL="$(grep REDIS_URL .env.production | cut -d= -f2-)" \
node dist/worker/entry.js
```

Expected:
• No REDIS_URL missing
• No dotenv errors
• Worker starts (may idle)
If it crashes → paste output.
Ctrl+C to stop.

---

🟢 PHASE 5 — PM2 (correct way)
11️⃣ Start worker with explicit env file

```bash
pm2 start dist/worker/entry.js \
  --name content-engine-worker \
  --env production \
  --env-file .env.production
```

Verify:

```bash
pm2 list
```

Status should be:
online

---

12️⃣ Verify PM2 env injection

```bash
pm2 env content-engine-worker | grep REDIS_URL
```

Expected:

```text
REDIS_URL=rediss://...
```

If empty → STOP (env not injected).

---

13️⃣ Check logs

```bash
pm2 logs content-engine-worker --lines 50
```

Expected:
• No REDIS_URL is not set
• No fatal startup errors

---

🟢 PHASE 6 — Redis + BullMQ validation
14️⃣ Confirm Redis connectivity

```bash
pm2 logs content-engine-worker | grep -i redis
```

No connection errors = good.
(Optional)

```bash
redis-cli -u "$(grep REDIS_URL .env.production | cut -d= -f2-)" ping
```

Expected:
PONG

---

🟢 PHASE 7 — Persistence & reboot safety
15️⃣ Save PM2 state

```bash
pm2 save
```

16️⃣ Enable startup

```bash
pm2 startup
```

Run the command PM2 prints.

---

17️⃣ Reboot test (optional but recommended)

```bash
sudo reboot
```

After reconnect:

```bash
pm2 list
pm2 logs content-engine-worker --lines 20
```

Worker should be back online.

---

✅ SUCCESS CRITERIA
You are fully production-safe if:
• ✅ dotenv absent from dist
• ✅ pm2 env shows REDIS_URL
• ✅ Worker starts without fatal errors
• ✅ Prisma client loads
• ✅ Redis jobs process or idle cleanly

---

🧠 Final architectural truth (important)
Layer Responsibility
.env.production Secrets storage
PM2 Env injection
entry.ts loadEnv (dev only)
bootstrap.ts pure runtime
dist/\*\* dotenv-free
You’ve now aligned with industry-grade Node worker architecture.
