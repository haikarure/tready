#!/usr/bin/env bash
set -euo pipefail
TREADY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TREADY_ROOT"
mkdir -p .tooling/keys artifacts
if [[ ! -f .tooling/keys/preview.p12 ]]; then
  python - <<'PY'
import secrets
from pathlib import Path
p=Path('.tooling/keys/preview.password')
p.write_text(secrets.token_urlsafe(40)+'\n')
p.chmod(0o600)
PY
  ./scripts/dev.sh keytool -genkeypair -keystore .tooling/keys/preview.p12 -storetype PKCS12 -alias tready-preview -storepass:file .tooling/keys/preview.password -keypass:file .tooling/keys/preview.password -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=Tready Preview, O=Tready'
  chmod 600 .tooling/keys/preview.p12
fi
export TREADY_KEYSTORE_PATH="$TREADY_ROOT/.tooling/keys/preview.p12"
export TREADY_KEYSTORE_PASSWORD_FILE="$TREADY_ROOT/.tooling/keys/preview.password"
./scripts/dev.sh bash -c 'cd apps/android; node ../../node_modules/expo/bin/cli prebuild --platform android --no-install'
./scripts/dev.sh bash -c 'cd apps/android/android; ./gradlew assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64 -Dorg.gradle.jvmargs=-Xmx3072m'
cp apps/android/android/app/build/outputs/apk/release/app-release.apk artifacts/tready-0.1.0-preview.apk
./scripts/dev.sh node node_modules/tsx/dist/cli.mjs scripts/release-metadata.ts
