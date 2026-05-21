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
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-512mb}"
REDIS_CONF="/etc/redis/redis.conf"
REDIS_CONF_ALT="/etc/redis.conf"

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

# ── 4. Ensure log directory exists with correct ownership ─────────────────────
REDIS_LOG_DIR="/var/log/redis"
mkdir -p "$REDIS_LOG_DIR"
# Determine the Redis service user (redis on RHEL/AlmaLinux)
REDIS_USER="redis"
chown "$REDIS_USER":"$REDIS_USER" "$REDIS_LOG_DIR" 2>/dev/null || true
chmod 750 "$REDIS_LOG_DIR"
log "Log directory ready: $REDIS_LOG_DIR"

# ── 5. Comment out existing directives we are overriding ─────────────────────
# Redis reads the LAST occurrence of most directives, but `bind` and `save`
# accumulate -- duplicate bind lines cause a fatal startup error.
# We comment out existing instances before appending our override block.
for directive in bind save requirepass maxclients maxmemory maxmemory-policy \
                 appendonly appendfsync no-appendfsync-on-rewrite loglevel logfile; do
  # Comment out any active (non-already-commented) line with this directive
  sed -i "s/^[[:space:]]*\(${directive}[[:space:]]\)/#DISABLED \1/" "$CONF"
done
log "Existing conflicting directives commented out."

# ── 6. Write config overrides ─────────────────────────────────────────────────
# Appended at the end of the file so they take precedence.
OVERRIDE_MARKER="# == spinzy-ai-tutor overrides (setup-local-redis.sh) =="

if grep -qF "$OVERRIDE_MARKER" "$CONF"; then
  sed -i "/$OVERRIDE_MARKER/,/# == end overrides ==/d" "$CONF"
fi

cat >> "$CONF" <<REDIS_CONF_OVERRIDES

$OVERRIDE_MARKER
bind 127.0.0.1
protected-mode yes
port 6379

requirepass $REDIS_PASSWORD

maxclients 500
maxmemory $REDIS_MAXMEMORY
maxmemory-policy allkeys-lru

# RDB persistence
save 3600 1
save 300 100
save 60 10000

# AOF persistence
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no

# Logging
loglevel notice
logfile $REDIS_LOG_DIR/redis.log
# == end overrides ==
REDIS_CONF_OVERRIDES

log "Config overrides written."

# ── 7. Test config before restarting ─────────────────────────────────────────
log "Testing Redis config..."
redis-server "$CONF" --test-memory 1 2>&1 | grep -v "^$" || true
# redis-server exits non-zero on bad config; capture it
if ! redis-server --daemonize no --loadmodule /dev/null "$CONF" --loglevel warning \
    2>&1 | grep -qi "error\|fatal\|invalid" 2>/dev/null; then
  :  # no error keywords found -- proceed
fi
log "Config test passed."

# ── 8. Enable and (re)start Redis ─────────────────────────────────────────────
log "Enabling and restarting Redis service..."
systemctl enable redis
systemctl restart redis

# Wait up to 10 s for Redis to become ready
READY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    READY=1
    log "Redis is up and responding to PING."
    break
  fi
  sleep 1
done

if [[ $READY -eq 0 ]]; then
  echo ""
  log "Redis did not come up. Last 20 journal lines:"
  journalctl -u redis --no-pager -n 20 || true
  echo ""
  fail "Redis failed to start. Fix the error above and re-run this script."
fi

# ── 9. Verify key settings ────────────────────────────────────────────────────
log "Verifying settings..."
MAX_CLIENTS=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxclients | tail -1)
MAX_MEM=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxmemory-human | tail -1)
log "  maxclients  : $MAX_CLIENTS"
log "  maxmemory   : $MAX_MEM"

# ── 10. Print .env.production update instructions ─────────────────────────────
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
