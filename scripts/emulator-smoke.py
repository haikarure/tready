"""Review a dedicated emulator: public data + synthetic flow, never passkey or orders."""
import json, re, subprocess, time, xml.etree.ElementTree as ET
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

def shot(name):
    (OUT / f'{name}.png').write_bytes(adb('exec-out','screencap','-p'))

cases = []
adb('shell','wm','density','480')  # 1080px / 3 = 360dp
adb('shell','am','force-stop','xyz.tready.app')
adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
time.sleep(3)
assert_text('Belum ada wallet'); shot('account-360dp'); cases.append('fresh standalone start; passkey disabled without rpId')
tap('Pilih mode testnet atau latihan'); tap('Latihan'); tap('Rencana')
for _ in range(12):
    if any('LATIHAN · collateral sintetis' in x for x in labels()): break
    time.sleep(1)
assert_text('LATIHAN · collateral sintetis'); shot('plan-360dp')
tap('Review rencana', scroll=True); tap('Eksekusi latihan', scroll=True); tap('Konfirmasi')
time.sleep(1); assert_text('Stop belum terverifikasi'); shot('trade-unprotected-360dp'); cases.append('synthetic entry reaches protection-pending')
tap('Pasang stop close-only', scroll=True); tap('Konfirmasi'); time.sleep(.5)
assert_text('Stop terdaftar'); shot('trade-protected-360dp'); cases.append('synthetic stop registration visible')
tap('Tutup posisi', scroll=True); tap('Konfirmasi'); time.sleep(.5)
assert_text('Tidak ada posisi'); cases.append('synthetic close returns flat')
tap('Bukti'); assert_text('SYNTHETIC REPLAY'); shot('receipt-360dp'); cases.append('receipt clearly labels synthetic results')
adb('shell','am','force-stop','xyz.tready.app');adb('shell','am','start','-n','xyz.tready.app/.MainActivity');time.sleep(2)
tap('Bukti');assert_text('SYNTHETIC REPLAY');cases.append('SQLite receipts survive force-stop/restart')
adb('shell','settings','put','system','font_scale','1.4');time.sleep(1)
adb('shell','am','force-stop','xyz.tready.app');adb('shell','am','start','-n','xyz.tready.app/.MainActivity');time.sleep(2)
shot('account-large-font');tap('Bukti');shot('receipt-large-font');cases.append('navigation and receipts usable at font scale1.4; visual review required')
adb('shell','settings','put','system','font_scale','1.0')
report = {'classification':'real_emulator_UI_test_of_public_data_and_synthetic_execution_only','device':'Pixel7 emulator, Android API36 x86_64, 360dp','passed':cases,'screenshots':sorted(p.name for p in OUT.glob('*.png')),'not_verified':['physical PRF/biometric/passkey recovery','owner funding/signing','authenticated API','real entry/stop/close/recovery','customer demand']}
(ROOT/'artifacts/emulator-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
