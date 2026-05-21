#!/usr/bin/env bash
# setup-local-redis.sh
# Install and configure Redis on the AlmaLinux VPS.
# Run once as root (or with sudo) on the VPS:
#   sudo bash scripts/setup-local-redis.sh
#
# After this script completes:
#   1. Update REDIS_URL in .env.production (see the printed value at the end)
#   2. Run: pm2 restart ecosystem.config.cjs --env production
#
# Idempotent -- safe to re-run if something changes.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REDIS_PASSWORD="${REDIS_PASSWORD:-}"          # pass via env, or script generates one
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-512mb}"  # leave headroom for Node processes
REDIS_CONF="/etc/redis/redis.conf"
REDIS_CONF_ALT="/etc/redis.conf"             # some AlmaLinux versions use this path

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[setup-local-redis] $*"; }
fail() { echo "[setup-local-redis] ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root or with sudo"

# ── 1. Install Redis ──────────────────────────────────────────────────────────
log "Installing Redis..."
if command -v redis-server &>/dev/null; then
  log "Redis already installed: $(redis-server --version)"
else
  dnf install -y redis || fail "dnf install redis failed"
  log "Redis installed."
fi

# ── 2. Locate redis.conf ──────────────────────────────────────────────────────
if [[ -f "$REDIS_CONF" ]]; then
  CONF="$REDIS_CONF"
elif [[ -f "$REDIS_CONF_ALT" ]]; then
  CONF="$REDIS_CONF_ALT"
else
  fail "Cannot find redis.conf (tried $REDIS_CONF and $REDIS_CONF_ALT)"
fi
log "Using config: $CONF"

# Back up original only once
[[ -f "${CONF}.orig" ]] || cp "$CONF" "${CONF}.orig"

# ── 3. Generate or validate password ─────────────────────────────────────────
if [[ -z "$REDIS_PASSWORD" ]]; then
  REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 40)
  log "Generated Redis password (save this): $REDIS_PASSWORD"
fi

# ── 4. Write config overrides ─────────────────────────────────────────────────
# We append an override block rather than parsing the existing file,
# so re-runs are idempotent and we never corrupt the original syntax.
OVERRIDE_MARKER="# == spinzy-ai-tutor overrides (setup-local-redis.sh) =="

if grep -qF "$OVERRIDE_MARKER" "$CONF"; then
  # Remove old override block before re-applying
  sed -i "/$OVERRIDE_MARKER/,/# == end overrides ==/d" "$CONF"
fi

cat >> "$CONF" <<REDIS_CONF_OVERRIDES

$OVERRIDE_MARKER
bind 127.0.0.1 -::1
protected-mode yes
port 6379

requirepass $REDIS_PASSWORD

maxclients 500
maxmemory $REDIS_MAXMEMORY
maxmemory-policy allkeys-lru

# RDB snapshots
save 3600 1
save 300 100
save 60 10000

# AOF persistence for durability
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no

# Logging
loglevel notice
logfile /var/log/redis/redis.log

# Disable slow commands that can block the single-threaded server
rename-command DEBUG ""
rename-command CONFIG "CONFIG_SPINZY_INTERNAL"
rename-command FLUSHALL ""
rename-command FLUSHDB ""
# == end overrides ==
REDIS_CONF_OVERRIDES

log "Config overrides written."

# ── 5. Enable and (re)start Redis ────────────────────────────────────────────
log "Enabling Redis service..."
systemctl enable redis
systemctl restart redis

# Wait up to 5 s for Redis to become ready
for i in 1 2 3 4 5; do
  if redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    log "Redis is up and responding to PING."
    break
  fi
  sleep 1
done

redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping 2>/dev/null | grep -q PONG \
  || fail "Redis did not respond to PING after restart"

# ── 6. Verify key settings ────────────────────────────────────────────────────
log "Verifying settings..."
MAX_CLIENTS=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxclients | tail -1)
MAX_MEM=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxmemory-human | tail -1)
log "  maxclients  : $MAX_CLIENTS"
log "  maxmemory   : $MAX_MEM"

# ── 7. Open firewall only on loopback (no external exposure) ─────────────────
# Redis is bound to 127.0.0.1 only, so no firewall rule needed.
# This is intentional -- never expose Redis to the internet.
log "Redis is bound to 127.0.0.1 only (no firewall rule needed)."

# ── 8. Print .env.production update instructions ─────────────────────────────
NEW_REDIS_URL="redis://default:${REDIS_PASSWORD}@127.0.0.1:6379"
echo ""
echo "========================================================================"
echo "  SETUP COMPLETE"
echo "========================================================================"
echo ""
echo "  Update .env.production on your VPS:"
echo ""
echo "    REDIS_URL=$NEW_REDIS_URL"
echo ""
echo "  Then restart PM2:"
echo "    pm2 restart ecosystem.config.cjs --env production"
echo ""
echo "  Verify connection after restart:"
echo "    redis-cli -a '$REDIS_PASSWORD' --no-auth-warning ping"
echo "    redis-cli -a '$REDIS_PASSWORD' --no-auth-warning CLIENT LIST | wc -l"
echo ""
echo "========================================================================"
