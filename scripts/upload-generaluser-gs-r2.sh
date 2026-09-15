#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SF2_FILE="${SF2_FILE:-$REPO_ROOT/public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2}"
R2_PREFIX="${R2_PREFIX:-generaluser-gs-2.0.3}"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi

for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  if [ -z "${!var:-}" ]; then
    echo "error: missing env var: $var" >&2
    exit 1
  fi
done

if [ ! -f "$SF2_FILE" ]; then
  echo "error: SF2 file not found: $SF2_FILE" >&2
  echo "       run 'bash scripts/fetch-generaluser-gs.sh' first" >&2
  exit 1
fi

DIR="$(dirname "$SF2_FILE")"
NAME="$(basename "$SF2_FILE")"

echo ">> uploading $NAME to r2:$R2_BUCKET/$R2_PREFIX/$NAME"
docker run --rm \
  -v "$DIR:/data:ro" \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_REGION=auto \
  rclone/rclone:latest \
  copyto "/data/$NAME" "r2:${R2_BUCKET}/${R2_PREFIX}/${NAME}" \
    --header-upload "Cache-Control: public, max-age=31536000, immutable" \
    --header-upload "Content-Type: application/octet-stream" \
    --checksum \
    --progress

echo ">> done."
