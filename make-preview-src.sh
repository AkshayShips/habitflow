#!/usr/bin/env bash
# Copies only what the Vercel preview build needs into $1 (no node_modules, tests, assets or lockfile).
set -euo pipefail
OUT="$1"; rm -rf "$OUT"; mkdir -p "$OUT"
cd "$(dirname "$0")"
for d in app components features lib theme; do cp -r "$d" "$OUT/$d"; done
find "$OUT" \( -name "*.test.ts" -o -name "*.test.tsx" \) -delete
rm -rf "$OUT/features/sync/testing"
cp app.config.ts babel.config.js metro.config.js tsconfig.json package.json vercel.json "$OUT/"
echo "$OUT ready: $(find "$OUT" -type f | wc -l) files, $(find "$OUT" -type f | xargs cat | wc -c) bytes"
