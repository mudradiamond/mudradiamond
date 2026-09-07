#!/usr/bin/env bash
# Run every suite. Called before a push; anything failing means don't ship.
set -e
cd "$(dirname "$0")/.."
fail=0
for t in tests/test-*.js; do
  echo ""
  echo "=============================================="
  echo " $t"
  echo "=============================================="
  node "$t" || fail=1
done
echo ""
[ $fail -eq 0 ] && echo "✅ all suites passed" || { echo "❌ some suites failed"; exit 1; }
