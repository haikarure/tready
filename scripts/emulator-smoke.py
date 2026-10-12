"""Review a dedicated emulator: public data + synthetic flow, no ceremony or orders."""
import hashlib, json, re, subprocess, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADB = ROOT / '.tooling/android-sdk/platform-tools/adb'
SERIAL = 'emulator-5556'
OUT = ROOT / 'artifacts/screenshots'
OUT.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output([str(ADB), '-s', SERIAL, *args], timeout=20)

def hierarchy():
    adb('shell', 'uiautomator', 'dump', '/sdcard/tready-smoke.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/tready-smoke.xml'))

def labels():
    return [n.get('text', '') or n.get('content-desc', '') for n in hierarchy().iter('node')]

def tap(label, scroll=False):
    for _ in range(9 if scroll else 1):
        for n in hierarchy().iter('node'):
            if label.casefold() in [(n.get('text') or '').casefold(), (n.get('content-desc') or '').casefold()]:
                if n.get('enabled') == 'false': raise AssertionError(f'Disabled: {label}')
                b = list(map(int, re.findall(r'\d+', n.get('bounds', ''))))
                if len(b) == 4 and b[3] > b[1]:
                    adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
                    time.sleep(.4)
                    return
        if scroll: adb('shell','input','swipe','550','1750','550','650','350')
    raise AssertionError(f'Not found: {label}')

def assert_text(text):
    assert any(text in value for value in labels()), f'Missing: {text}'

def assert_disabled(label):
    matches = [n for n in hierarchy().iter('node') if n.get('content-desc') == label]
    assert matches and all(n.get('enabled') == 'false' for n in matches), f'Expected disabled: {label}'

def assert_enabled(label):
    matches = [n for n in hierarchy().iter('node') if n.get('content-desc') == label]
    assert matches and all(n.get('enabled') == 'true' for n in matches), f'Expected enabled: {label}'

def top():
    # UIAutomator omits offscreen labels; inspect status at the top after actions.
    for _ in range(3): adb('shell','input','swipe','550','650','550','1750','250')

def shot(name):
    (OUT / f'{name}.png').write_bytes(adb('exec-out','screencap','-p'))

cases = []
release = json.loads((ROOT/'artifacts/release.json').read_text())
adb('shell','wm','density','480')  # 1080px / 3 = 360dp
adb('shell','am','force-stop','xyz.tready.app')
adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
time.sleep(3)
assert_text('Belum ada wallet')
if release.get('rpId'):
    assert_enabled('Buat passkey')
    cases.append('standalone start; configured passkey control enabled, ceremony not implied')
else:
    assert_disabled('Buat passkey')
    cases.append('standalone start; passkey disabled without rpId')
shot('account-360dp')
tap('Pilih mode testnet atau latihan'); tap('Latihan'); tap('Rencana')
for _ in range(12):
    if any('LATIHAN · collateral sintetis' in x for x in labels()): break
    time.sleep(1)
assert_text('LATIHAN · collateral sintetis'); shot('plan-360dp')
tap('Review rencana', scroll=True); tap('Eksekusi latihan', scroll=True); tap('Konfirmasi')
time.sleep(1); assert_text('Stop belum terverifikasi'); shot('trade-unprotected-360dp'); cases.append('synthetic entry reaches protection-pending')
tap('Pasang stop close-only', scroll=True); tap('Konfirmasi'); time.sleep(.5)
top(); assert_text('Stop terdaftar'); shot('trade-protected-360dp'); cases.append('synthetic stop registration visible')
tap('Tutup posisi', scroll=True); tap('Konfirmasi'); time.sleep(.5)
top(); assert_text('Tidak ada posisi'); cases.append('synthetic close returns flat')
tap('Bukti'); assert_text('SYNTHETIC REPLAY'); shot('receipt-360dp'); cases.append('receipt clearly labels synthetic results')
adb('shell','am','force-stop','xyz.tready.app');adb('shell','am','start','-n','xyz.tready.app/.MainActivity');time.sleep(2)
tap('Bukti');assert_text('SYNTHETIC REPLAY');cases.append('SQLite receipts survive force-stop/restart')
adb('shell','settings','put','system','font_scale','1.4');time.sleep(1)
adb('shell','am','force-stop','xyz.tready.app');adb('shell','am','start','-n','xyz.tready.app/.MainActivity');time.sleep(2)
shot('account-large-font');tap('Bukti');shot('receipt-large-font');cases.append('navigation and receipts usable at font scale1.4; visual review required')
adb('shell','settings','put','system','font_scale','1.0')
assert hashlib.sha256((ROOT/'artifacts'/release['file']).read_bytes()).hexdigest() == release['sha256']
report = {'classification':'real_emulator_UI_test_of_public_data_and_synthetic_execution_only','testedAt':datetime.now(timezone.utc).isoformat(),'apkSha256':release['sha256'],'appSourceCommit':release['sourceCommit'],'device':'Pixel7 emulator, Android API36 x86_64, 360dp','passed':cases,'screenshots':[f'{name}.png' for name in ['account-360dp','plan-360dp','trade-unprotected-360dp','trade-protected-360dp','receipt-360dp','account-large-font','receipt-large-font']],'not_verified':['physical PRF/biometric/passkey recovery','owner funding/signing','authenticated API','real entry/stop/close/recovery','customer demand']}
(ROOT/'artifacts/emulator-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
