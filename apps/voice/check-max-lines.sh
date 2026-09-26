#!/bin/sh
set -e
dirs=''
for d in src tests; do
  if [ -d "$d" ]; then dirs="$dirs $d"; fi
done
if [ -z "$dirs" ]; then exit 0; fi
find $dirs -name '*.py' -exec awk '
  FNR == 1 && NR > 1 { check() }
  FNR == 1 { file = FILENAME; count = 0 }
  NF { count++ }
  END { if (file != "") check(); exit failed }
  function check(max) {
    max = file ~ /^tests\// ? 400 : 200
    if (count > max) {
      printf "%s: %d non-blank lines (max %d)\n", file, count, max
      failed = 1
    }
  }
' {} +
