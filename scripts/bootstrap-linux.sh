#!/usr/bin/env bash
set -euo pipefail
TREADY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TREADY_ROOT"
if [[ "$(uname -m)" != x86_64 ]]; then printf '%s\n' 'Bootstrap ini untuk Linux x86_64. Siapkan Node24/JDK17/Android SDK sesuai platform.' >&2; exit 1; fi
mkdir -p .tooling
if [[ ! -x .tooling/node-v24.21.0-linux-x64/bin/node ]]; then
  curl --fail --location --silent --show-error https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz -o .tooling/node.tar.xz
  curl --fail --location --silent --show-error https://nodejs.org/dist/v24.21.0/SHASUMS256.txt -o .tooling/node-shasums.txt
  python - <<'PY'
import hashlib
from pathlib import Path
expected=next(line.split()[0] for line in Path('.tooling/node-shasums.txt').read_text().splitlines() if line.endswith('node-v24.21.0-linux-x64.tar.xz'))
assert hashlib.sha256(Path('.tooling/node.tar.xz').read_bytes()).hexdigest()==expected
PY
  tar -xf .tooling/node.tar.xz -C .tooling
fi
if [[ ! -x .tooling/pnpm/node_modules/.bin/pnpm ]]; then ./scripts/dev.sh npm install --prefix .tooling/pnpm pnpm@11.28.5 --no-audit --no-fund; fi
if [[ ! -x .tooling/android-sdk/cmdline-tools/latest/bin/sdkmanager ]]; then
  curl --fail --location --silent --show-error https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip -o .tooling/android-tools.zip
  python - <<'PY'
import hashlib,zipfile
from pathlib import Path
p=Path('.tooling/android-tools.zip')
assert hashlib.sha1(p.read_bytes()).hexdigest()=='e025545c62a8e64c7559119566a569fb1dec5f60'
with zipfile.ZipFile(p) as z: z.extractall('.tooling/android-sdk')
Path('.tooling/android-sdk/cmdline-tools').rename('.tooling/android-sdk/cmdline-unpacked')
Path('.tooling/android-sdk/cmdline-tools').mkdir()
Path('.tooling/android-sdk/cmdline-unpacked').rename('.tooling/android-sdk/cmdline-tools/latest')
PY
fi
./scripts/dev.sh java -version
./scripts/dev.sh sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1'
./scripts/dev.sh pnpm install --frozen-lockfile
