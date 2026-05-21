#!/usr/bin/env bash
# setup-local-redis.sh
# Install and configure Redis on the AlmaLinux VPS.
# Run as root (or with sudo):  sudo bash scripts/setup-local-redis.sh
#
# After this script completes:
#   1. Update REDIS_URL in .env.production (the value is printed at the end)
#   2. pm2 restart ecosystem.config.cjs --env production
#
# Idempotent -- safe to re-run.

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

# ── 3. Always restore original config for a clean baseline ───────────────────
# This ensures previous partial runs don't leave a broken config.
if [[ -f "${CONF}.orig" ]]; then
  cp "${CONF}.orig" "$CONF"
  log "Restored original config from backup."
else
  cp "$CONF" "${CONF}.orig"
  log "Backed up original config to ${CONF}.orig"
fi

# ── 4. Generate password ─────────────────────────────────────────────────────
if [[ -z "$REDIS_PASSWORD" ]]; then
  REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | head -c 40)
  log "Generated Redis password (save this now): $REDIS_PASSWORD"
fi

# ── 5. Create log directory ───────────────────────────────────────────────────
REDIS_LOG_DIR="/var/log/redis"
mkdir -p "$REDIS_LOG_DIR"
chown redis:redis "$REDIS_LOG_DIR" 2>/dev/null || true
chmod 750 "$REDIS_LOG_DIR"
log "Log directory ready: $REDIS_LOG_DIR"

# ── 6. Patch only startup-only directives in the config file ─────────────────
# bind and logfile cannot be changed via CONFIG SET -- they must be in the file.
# We replace existing lines rather than appending to avoid duplicates.

# bind: replace any active bind line with IPv4-only loopback
if grep -qE "^bind " "$CONF"; then
  sed -i 's|^bind .*|bind 127.0.0.1|' "$CONF"
else
  echo "bind 127.0.0.1" >> "$CONF"
fi

# logfile: replace existing or add
if grep -qE "^logfile " "$CONF"; then
  sed -i "s|^logfile .*|logfile $REDIS_LOG_DIR/redis.log|" "$CONF"
else
  echo "logfile $REDIS_LOG_DIR/redis.log" >> "$CONF"
fi

log "Config file patched (bind + logfile only)."

# ── 7. Stop any running Redis instance cleanly ───────────────────────────────
# redis-shutdown may fail if the running instance has a password we don't know.
# That is fine -- systemd will force-kill it. We suppress the error here.
log "Stopping any running Redis instance..."
systemctl stop redis 2>/dev/null || true
sleep 2

# ── 8. Start Redis with the clean (no-password) config ───────────────────────
log "Starting Redis..."
systemctl enable redis
systemctl start redis

STARTED=0
for i in $(seq 1 15); do
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    STARTED=1
    log "Redis is up (no password -- will set next)."
    break
  fi
  sleep 1
done

if [[ $STARTED -eq 0 ]]; then
  log "Redis did not start. Last 25 journal lines:"
  journalctl -u redis --no-pager -n 25 || true
  fail "Redis failed to start. Check the journal above."
fi

# ── 9. Apply settings via CONFIG SET ─────────────────────────────────────────
# Using CONFIG SET is more reliable than editing the conf file for these values.
# requirepass MUST be set last among auth-neutral commands, or set first then
# include -a flag on all subsequent calls.

log "Applying settings via CONFIG SET..."

redis-cli CONFIG SET requirepass "$REDIS_PASSWORD"

# All subsequent commands must authenticate
CLI="redis-cli -a $REDIS_PASSWORD --no-auth-warning"

$CLI CONFIG SET maxclients 500
$CLI CONFIG SET maxmemory "$REDIS_MAXMEMORY"
$CLI CONFIG SET maxmemory-policy allkeys-lru
$CLI CONFIG SET save "3600 1 300 100 60 10000"
$CLI CONFIG SET appendonly yes
$CLI CONFIG SET appendfsync everysec
$CLI CONFIG SET no-appendfsync-on-rewrite no
$CLI CONFIG SET loglevel notice

# ── 10. Persist settings to the config file ───────────────────────────────────
log "Persisting settings to config file..."
$CLI CONFIG REWRITE
log "CONFIG REWRITE done."

# ── 11. Verify ────────────────────────────────────────────────────────────────
log "Verifying..."
$CLI ping | grep -q PONG || fail "Redis not responding after CONFIG REWRITE"

MAX_CLIENTS=$($CLI CONFIG GET maxclients | tail -1)
MAX_MEM=$($CLI CONFIG GET maxmemory-human | tail -1)
log "  maxclients : $MAX_CLIENTS"
log "  maxmemory  : $MAX_MEM"

# ── 12. Print .env.production update ─────────────────────────────────────────
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
echo "  Verify connection count after restart:"
echo "    redis-cli -a '$REDIS_PASSWORD' --no-auth-warning CLIENT LIST | wc -l"
echo ""
echo "========================================================================"
