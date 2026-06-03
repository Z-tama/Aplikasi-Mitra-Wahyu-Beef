#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env.deploy ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.deploy
  set +a
fi

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_PAGES_PROJECT:=aplikasi-mitra-wahyu-beef}"

EXPECTED_PROJECT="aplikasi-mitra-wahyu-beef"
if [ "$CLOUDFLARE_PAGES_PROJECT" != "$EXPECTED_PROJECT" ]; then
  echo "ABORT: Aplikasi Mitra Wahyu Beef hanya boleh deploy ke $EXPECTED_PROJECT, bukan $CLOUDFLARE_PAGES_PROJECT" >&2
  exit 1
fi

if [ ! -f PROJECT_IDENTITY.md ] || ! grep -q "Aplikasi Mitra Wahyu Beef" PROJECT_IDENTITY.md; then
  echo "ABORT: PROJECT_IDENTITY.md Mitra tidak ditemukan. Pastikan sedang di folder aplikasi Mitra." >&2
  exit 1
fi

export HOME="${HOME:-/home/node/.openclaw/workspace}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/home/node/.openclaw/workspace/.config}"

npm run build
npx wrangler pages deploy dist \
  --project-name "$CLOUDFLARE_PAGES_PROJECT" \
  --branch main \
  --commit-dirty=true
