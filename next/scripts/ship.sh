#!/usr/bin/env bash
# Push next/dist to the live pod under lab/next/ (served at /imagelab/next/). Build first.
# Never stop/restart/delete the pod. Orchestrator runs this; agents do not.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ../../.env; set +a
BASE=${BASE:-http://54.68.157.60:43636}
for f in $(find dist -type f ! -name index.html) dist/index.html; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -u "$COMFY_LOCAL_USER:$COMFY_LOCAL_TOKEN" -X PUT \
    --data-binary "@$f" "$BASE/pod/app/api/files?path=$(printf %s "lab/next/${f#dist/}" | jq -sRr @uri)")
  echo "$code $f"
done
