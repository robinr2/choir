#!/bin/sh
set -e
rm -rf mutants
trap 'rm -rf mutants' EXIT
uv run --frozen mutmut run > /dev/null || true
uv run --frozen mutmut export-cicd-stats > /dev/null
uv run --frozen python - <<'EOF'
import json
import sys
from pathlib import Path

path = Path('mutants/mutmut-cicd-stats.json')
stats = json.loads(path.read_text()) if path.exists() else {'killed': 0, 'total': 0}
if stats['killed'] != stats['total']:
    sys.stderr.write(f'Not all mutants killed: {stats}\n')
    sys.exit(1)
EOF
