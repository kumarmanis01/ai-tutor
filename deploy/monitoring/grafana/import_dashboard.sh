#!/usr/bin/env bash
# Simple script to import a Grafana dashboard JSON into a Grafana instance
# Usage: GRAFANA_URL=https://grafana.example.com GRAFANA_API_KEY=ey... ./import_dashboard.sh outbox_deadletter.json

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <dashboard-json-file>" >&2
  exit 2
fi

FILE="$1"

if [ -z "${GRAFANA_URL:-}" ] || [ -z "${GRAFANA_API_KEY:-}" ]; then
  echo "Please set GRAFANA_URL and GRAFANA_API_KEY environment variables." >&2
  exit 2
fi

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE" >&2
  exit 2
fi

echo "Importing dashboard $FILE to $GRAFANA_URL"

PAYLOAD=$(jq -c '{dashboard: (input | .dashboard), overwrite: true}' < "$FILE")

curl -sS -X POST "$GRAFANA_URL/api/dashboards/db" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq .

echo "Done."
