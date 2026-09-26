#!/bin/sh
set -e
rm -rf mutants
log=$(mktemp)
trap 'rm -rf mutants "$log"' EXIT
status=0
uv run --frozen mutmut run "$@" > "$log" 2>&1 || status=$?
if [ "$#" -gt 0 ] && [ "$status" -ne 0 ]; then
  if grep -q 'nothing matches' "$log"; then
    echo "No mutants in: $*"
    exit 0
  fi
  cat "$log" >&2
  exit "$status"
fi
uv run --frozen mutmut export-cicd-stats > /dev/null
SCOPED="$#" uv run --frozen python - <<'EOF'
import json
import os
import sys
from pathlib import Path

path = Path('mutants/mutmut-cicd-stats.json')
stats = json.loads(path.read_text()) if path.exists() else {'killed': 0, 'total': 0}
failed = ('survived', 'no_tests', 'suspicious', 'timeout', 'segfault', 'skipped')
if os.environ['SCOPED'] != '0':
    passed = not any(stats.get(status, 0) for status in failed)
else:
    passed = stats['killed'] == stats['total']
if not passed:
    sys.stderr.write(f'Not all mutants killed: {stats}\n')
    sys.exit(1)
print(f"Killed {stats['killed']} mutants")
EOF
