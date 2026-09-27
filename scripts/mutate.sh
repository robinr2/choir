#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

in_scope() {
  local app="$1" file="$2"
  if [ "$app" = voice ]; then
    [[ "$file" == src/voice/*.py ]]
  else
    node -e '
      const path = require("node:path");
      const [app, file] = process.argv.slice(1);
      const globs = require(`./apps/${app}/stryker.config.json`).mutate;
      const matches = (glob) => path.matchesGlob(file, glob);
      const included = globs.filter((glob) => !glob.startsWith("!")).some(matches);
      const excluded = globs.filter((glob) => glob.startsWith("!")).some((glob) => matches(glob.slice(1)));
      process.exit(included && !excluded ? 0 : 1);
    ' "$app" "$file"
  fi
}

if [ "$#" -eq 0 ]; then
  while IFS= read -r file; do
    case "$file" in
      apps/core/* | apps/web/* | apps/voice/*)
        app="${file#apps/}"
        app="${app%%/*}"
        if in_scope "$app" "${file#apps/"$app"/}"; then set -- "$@" "$file"; fi ;;
    esac
  done < <(git diff --cached --name-only --diff-filter=d)
  [ "$#" -gt 0 ] || { echo "No staged files to mutation-test"; exit 0; }
fi

core=() web=() voice=()
for target in "$@"; do
  target="${target%/}"
  [ -e "$target" ] || { echo "No such file or directory: $target" >&2; exit 1; }
  case "$target" in
    apps/core | apps/core/*) core+=("${target#apps/core}") ;;
    apps/web | apps/web/*) web+=("${target#apps/web}") ;;
    apps/voice | apps/voice/*) voice+=("${target#apps/voice}") ;;
    *) echo "Not inside apps/core, apps/web or apps/voice: $target" >&2; exit 1 ;;
  esac
done

stryker() {
  local app="$1" extensions="$2"
  shift 2
  local globs=()
  for target in "$@"; do
    target="${target#/}"
    if [ -z "$target" ]; then
      (cd "apps/$app" && npx stryker run)
      return
    elif [ -d "apps/$app/$target" ]; then
      globs+=("$target/**/*.$extensions")
    else
      globs+=("$target")
    fi
  done
  local exclusions
  exclusions=$(node -p "require('./apps/$app/stryker.config.json').mutate.filter((glob) => glob.startsWith('!')).join(',')")
  (cd "apps/$app" && npx stryker run --mutate "$(IFS=,; echo "${globs[*]}"),$exclusions")
}

mutmut() {
  local patterns=()
  for target in "$@"; do
    target="${target#/}"
    case "$target" in
      "" | src | src/voice) patterns=(); break ;;
      src/voice/*)
        local module="${target#src/voice/}"
        module="${module%.py}"
        patterns+=("voice.${module//\//.}.*") ;;
      *) echo "Voice mutation testing covers src/voice only: apps/voice/$target" >&2; exit 1 ;;
    esac
  done
  (cd apps/voice && ./check-mutants.sh "${patterns[@]}")
}

[ ${#core[@]} -eq 0 ] || stryker core ts "${core[@]}"
[ ${#web[@]} -eq 0 ] || stryker web '{ts,tsx}' "${web[@]}"
[ ${#voice[@]} -eq 0 ] || mutmut "${voice[@]}"
