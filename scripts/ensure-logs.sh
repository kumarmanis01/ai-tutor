#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p logs
chown "$(id -u -n):$(id -g -n)" logs || true
chmod 0755 logs
echo "logs/ ensured at $ROOT/logs" 
