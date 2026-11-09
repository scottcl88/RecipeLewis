#!/usr/bin/env bash
# Build the app against the emulators, run the QA harness, then stop. Dev only. Needs Java + Chromium.
#   bash scripts/run-qa.sh <emulator-data-dir> <screenshot-out-dir>
set -euo pipefail
DATA=${1:?emulator data dir (from emulators:exec --export-on-exit)}
OUT=${2:?output dir}
export NO_PROXY=127.0.0.1,localhost; unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy NODE_USE_ENV_PROXY
VITE_USE_EMULATOR=1 npx vite build --outDir dist-emu --emptyOutDir
npx firebase emulators:exec --only auth,firestore,storage --project demo-recipelewis --import "$DATA" "
  node scripts/dev-user.mjs pending@example.test 'Passw0rd!test' none >/dev/null &&
  (npx vite preview --outDir dist-emu --port 4173 --host 127.0.0.1 >/tmp/preview.log 2>&1 & echo \$! >/tmp/preview.pid; sleep 3;
   THEME=\${THEME:-} node scripts/qa-shots.mjs http://127.0.0.1:4173 '$OUT'; kill \$(cat /tmp/preview.pid))"
