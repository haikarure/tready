"""Probe and cancel a known provider's passkey prompt on a dedicated emulator.

No external device is paired, no credential is created, and no funds/orders
are used. Native provider UI/cancellation does not prove a PRF happy path.
"""
import hashlib, json, re, subprocess, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
ADB=[str(ROOT/'.tooling/android-sdk/platform-tools/adb'),'-s','emulator-5556']
def adb(*args): return subprocess.check_output([*ADB,*args],timeout=25)
assert adb('emu','avd','name').decode().splitlines()[0]=='tready-api36'
release=json.loads((ROOT/'artifacts/release.json').read_text())
assert release['rpId']=='tready-archzxy.netlify.app'
assert not release['enrollmentConfigured']
assert hashlib.sha256((ROOT/'artifacts'/release['file']).read_bytes()).hexdigest()==release['sha256']
accounts=adb('shell','dumpsys','account').decode()
match=re.search(r'Accounts:\s*(\d+)',accounts)
assert match and match.group(1)=='0', 'This signed-out probe requires an empty test emulator.'
provider=adb('shell','settings','get','secure','credential_service_primary').decode().strip()
assert any(name in provider for name in ['com.google.android.gms','com.kunzisoft.keepass.libre','com.kunzisoft.keepass.free']), 'Inspect an unknown provider before probing.'

def hierarchy():
    adb('shell','rm','-f','/sdcard/tready-passkey-probe.xml')
    adb('shell','uiautomator','dump','/sdcard/tready-passkey-probe.xml')
    return ET.fromstring(adb('exec-out','cat','/sdcard/tready-passkey-probe.xml'))
def labels(root): return [n.get('text','') or n.get('content-desc','') for n in root.iter('node')]
def tap(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))

adb('shell','settings','put','system','font_scale','1.0')
adb('shell','am','force-stop','xyz.tready.app')
adb('logcat','-c')
adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
time.sleep(3)
for _ in range(6):
    root=hierarchy()
    button=next((n for n in root.iter('node') if n.get('content-desc')=='Buat passkey'),None)
    if button is not None: break
    time.sleep(1)
assert button is not None and button.get('enabled')=='true'
tap(button)
prompt='Create passkey to sign in to Tready?' if 'com.kunzisoft.keepass.' in provider else 'Create passkey on another device?'
for _ in range(10):
    root=hierarchy()
    if any(prompt in text for text in labels(root)): break
    time.sleep(1)
assert any(prompt in text for text in labels(root)), 'Provider UI differs; inspect the emulator before proceeding.'
(ROOT/'artifacts/screenshots/native-passkey-provider-prompt.png').write_bytes(adb('exec-out','screencap','-p'))
adb('shell','input','keyevent','4')
expected='Permintaan passkey dibatalkan.'
for _ in range(12):
    root=hierarchy()
    if any(expected in text for text in labels(root)): break
    time.sleep(1)
assert any(expected in text for text in labels(root)), 'Expected actionable cancellation message.'
assert 'Belum ada wallet' in labels(root)
logs=adb('logcat','-d','-v','brief').decode(errors='replace')
exceptions=['CreateCredentialCancellationException','CreatePublicKeyCredentialDomException']
exception=next((name for name in exceptions if name in logs),None)
assert exception, 'Expected native Android cancellation exception evidence.'
(ROOT/'artifacts/screenshots/native-passkey-cancelled.png').write_bytes(adb('exec-out','screencap','-p'))
api_disabled=False
for _ in range(8):
    root=hierarchy()
    button=next((n for n in root.iter('node') if n.get('content-desc')=='Otorisasi API trading'),None)
    if button is not None:
        api_disabled=button.get('enabled')=='false'
        break
    adb('shell','input','swipe','550','1750','550','650','350')
assert api_disabled
report={'classification':'native_Android_provider_prompt_and_cancellation_probe',
        'testedAt':datetime.now(timezone.utc).isoformat(),'apkSha256':release['sha256'],
        'appSourceCommit':release['sourceCommit'],'rpId':release['rpId'],
        'device':'tready-api36, Android API36 Google APIs x86_64 emulator',
        'credentialProvider':provider,'configuredAccountCount':0,
        'providerPrompt':prompt,
        'nativeFailureClass':exception,'nativePasskeySucceeded':False,'nativePrfVerified':False,
        'checksPassed':['native passkey bridge opens the configured provider prompt',
                        'cancelling the native prompt produces a cancellation message and no wallet',
                        'unconfigured Perpl enrollment remains disabled'],
        'screenshots':['screenshots/native-passkey-provider-prompt.png','screenshots/native-passkey-cancelled.png'],
        'notVerified':['native PRF happy path','hardware biometrics','provider sync/restore',
                       'funding, authenticated API or live trading']}
(ROOT/'artifacts/native-passkey-probe.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
