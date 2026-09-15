#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$REPO_ROOT/public/samples/generaluser-gs-2.0.3"
DEST="$DEST_DIR/GeneralUser-GS.sf2"
UPSTREAM_COMMIT="684543d5e5efaef08d02be50dcda8d552478fa60"
SOURCE="https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/${UPSTREAM_COMMIT}/GeneralUser-GS.sf2"

mkdir -p "$DEST_DIR"

echo ">> fetching GeneralUser GS 2.0.3 from pinned upstream commit $UPSTREAM_COMMIT"
curl --fail --location --retry 3 --retry-all-errors --output "$DEST.tmp" "$SOURCE"

size=$(wc -c < "$DEST.tmp" | tr -d ' ')
if [ "$size" -lt 25000000 ]; then
  echo "error: GeneralUser-GS.sf2 download is unexpectedly small: $size bytes" >&2
  rm -f "$DEST.tmp"
  exit 1
fi

mv "$DEST.tmp" "$DEST"
echo ">> GeneralUser GS 2.0.3 downloaded to $DEST ($size bytes)"
