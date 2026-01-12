#!/usr/bin/env bash
set -euo pipefail

# Archive existing logs then flush PM2-managed logs and reload log handles.
# Safe to run on the VPS from the project root.

LOG_DIR="$(pwd)/logs"
ARCHIVE_DIR="$LOG_DIR/archive/$(date +%Y%m%d_%H%M%S)"

mkdir -p "$LOG_DIR" "$ARCHIVE_DIR"

# Move current logs into an archive folder (preserve names)
shopt -s nullglob
for f in "$LOG_DIR"/*.log "$LOG_DIR"/*.txt; do
  [ -e "$f" ] || continue
  mv "$f" "$ARCHIVE_DIR/"
done

# Ask PM2 to flush its internal logs (clears rotated logs)
if command -v pm2 >/dev/null 2>&1; then
  pm2 flush || true
  pm2 reloadLogs || true
fi

echo "Logs archived to: $ARCHIVE_DIR"
echo "PM2 logs flushed and reloaded (if pm2 available)."
