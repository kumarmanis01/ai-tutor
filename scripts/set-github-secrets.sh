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

get_var(){
  key="$1"
  # search .env.local then .env for the key
  for f in .env.local .env; do
    if [ -f "$f" ]; then
      # extract first matching line KEY=VALUE
      line=$(grep -m1 "^${key}=" "$f" || true)
      if [ -n "$line" ]; then
        v=${line#*=}
        v=${v#"}
        v=${v%"}
        v=${v#\'}
        v=${v%\'}
        echo "$v"
        return
      fi
    fi
  done
  echo ""
}

SECRETS=(DATABASE_URL REDIS_URL OPS_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM PUSHGATEWAY_URL)

for name in "${SECRETS[@]}"; do
  value=$(get_var "$name")
  if [ -n "$value" ]; then
    echo "Setting secret $name"
    echo -n "$value" | gh secret set "$name" -R "$REPO" -b -
  else
    echo "Skipping $name (not found in .env or .env.local)"
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
