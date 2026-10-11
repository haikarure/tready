#!/usr/bin/env bash
set -euo pipefail
TREADY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$TREADY_ROOT/.tooling/node-v24.21.0-linux-x64/bin:$TREADY_ROOT/.tooling/pnpm/node_modules/.bin:$PATH"
if [[ -d /usr/lib/jvm/java-17-openjdk ]]; then export JAVA_HOME=/usr/lib/jvm/java-17-openjdk; fi
if [[ -d "$TREADY_ROOT/.tooling/android-sdk" ]]; then export ANDROID_HOME="$TREADY_ROOT/.tooling/android-sdk"; fi
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}${ANDROID_HOME:+$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:}$PATH"
cd "$TREADY_ROOT"
exec "$@"
