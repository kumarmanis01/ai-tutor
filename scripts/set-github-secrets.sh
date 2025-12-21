#!/usr/bin/env bash
set -eu

# Usage: ./scripts/set-github-secrets.sh --repo owner/repo [--kubeconfig /path/to/kubeconfig]

REPO=""
KUBECONFIG_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2;;
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [ -z "$REPO" ]; then
  echo "--repo is required (format: owner/repo)" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install from https://cli.github.com/" >&2
  exit 1
fi

echo "Reading required vars from .env and .env.local (if present)"

get_var_any(){
  # Accepts a list of candidate keys and returns the first found value from .env.local or .env
  for candidate in "$@"; do
    for f in .env.local .env; do
      if [ -f "$f" ]; then
        line=$(grep -m1 "^${candidate}=" "$f" || true)
        if [ -n "$line" ]; then
          v=${line#*=}
          v=${v#"}
          v=${v%"}
          v=${v#\'}
          v=${v%\'}
          echo "$v"
          return 0
        fi
      fi
    done
  done
  return 1
}

declare -A MAP
MAP=(
  [DATABASE_URL]="DATABASE_URL"
  [REDIS_URL]="REDIS_URL UPSTASH_REDIS_REST_URL"
  [OPS_EMAIL]="OPS_EMAIL EMAIL_FROM EMAIL_SERVER_USER"
  [SMTP_HOST]="SMTP_HOST EMAIL_SERVER_HOST"
  [SMTP_PORT]="SMTP_PORT EMAIL_SERVER_PORT"
  [SMTP_USER]="SMTP_USER EMAIL_SERVER_USER"
  [SMTP_PASS]="SMTP_PASS EMAIL_SERVER_PASSWORD"
  [SMTP_FROM]="SMTP_FROM EMAIL_FROM"
  [PUSHGATEWAY_URL]="PUSHGATEWAY_URL"
)

for name in "${!MAP[@]}"; do
  set -- ${MAP[$name]}
  value=$(get_var_any "$@" || true)
  if [ -n "$value" ]; then
    echo "Setting secret $name (from candidates: ${MAP[$name]})"
    echo -n "$value" | gh secret set "$name" -R "$REPO" -b -
  else
    echo "Skipping $name (not found among: ${MAP[$name]})"
  fi
done

if [ -n "$KUBECONFIG_PATH" ]; then
  if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo "kubeconfig path not found: $KUBECONFIG_PATH" >&2; exit 1
  fi
  echo "Encoding kubeconfig as KUBE_CONFIG_DATA and setting repo secret"
  base64 -w0 "$KUBECONFIG_PATH" | gh secret set KUBE_CONFIG_DATA -R "$REPO" -b -
fi

echo "All done. Trigger the workflow 'Deploy Evaluator to Staging' or run it manually in Actions." 
