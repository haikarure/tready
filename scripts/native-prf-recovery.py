"""Restore the controlled PRF credential on the dedicated test AVD.

Uses the installed APK and real provider authentication. Password/PIN files stay
local; only a public wallet address and verification facts enter the report.
"""
import argparse,hashlib,json,re,subprocess,time,xml.etree.ElementTree as ET
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
ADB=[str(ROOT/'.tooling/android-sdk/platform-tools/adb'),'-s','emulator-5556']
def adb(*args):return subprocess.check_output([*ADB,*args],timeout=30)
def hierarchy():
 for _ in range(4):
  adb('shell','rm','-f','/sdcard/tready-prf-test.xml')
  adb('shell','uiautomator','dump','/sdcard/tready-prf-test.xml')
  try:return ET.fromstring(adb('exec-out','cat','/sdcard/tready-prf-test.xml'))
  except (ET.ParseError,subprocess.CalledProcessError):time.sleep(1)
 raise RuntimeError('Fresh provider hierarchy unavailable.')
def labels(nodes):return {value for n in nodes for value in [n.get('text'),n.get('content-desc')] if value}
def tap(n):
 x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));x=str((x1+x2)//2);y=str((y1+y2)//2)
 adb('shell','input','touchscreen','swipe',x,y,x,y,'150');time.sleep(1)
def enter_secret(resource,value):
 for _ in range(10):
  nodes=list(hierarchy().iter('node'))
  if any(n.get('resource-id')==resource and n.get('focused')=='true' for n in nodes):break
  adb('shell','input','keyevent','61')
 else:raise RuntimeError('Credential field did not receive focus.')
 adb('shell','input','keycombination','113','29')
 adb('shell','input','text',value)
 time.sleep(.5)
 # BACK can cancel the ceremony when a hardware keyboard keeps the IME hidden.
 adb('shell','input','keyevent','66')

parser=argparse.ArgumentParser()
parser.add_argument('--vault-password-file',type=Path,required=True)
parser.add_argument('--pin-file',type=Path,required=True)
parser.add_argument('--clear-data',action='store_true')
args=parser.parse_args()
assert adb('emu','avd','name').decode().splitlines()[0]=='tready-api36'
release=json.loads((ROOT/'artifacts/release.json').read_text())
assert release['rpId']=='tready-archzxy.netlify.app'
creation=json.loads((ROOT/'artifacts/completion/native-prf.json').read_text())
expected=creation['address'];assert re.fullmatch(r'0x[0-9a-fA-F]{40}',expected)
provider=adb('shell','settings','get','secure','credential_service_primary').decode().strip()
assert provider.startswith('com.kunzisoft.keepass.free/'), 'Only the inspected test provider is supported here.'
installed=adb('shell','pm','path','xyz.tready.app').decode().strip().split('package:')[1]
assert hashlib.sha256(adb('exec-out','cat',installed)).hexdigest()==release['sha256']
password=args.vault_password_file.read_text().strip();pin=args.pin_file.read_text().strip()
assert password.isalnum() and pin.isdigit()
adb('shell','am','force-stop','xyz.tready.app')
if args.clear_data:assert adb('shell','pm','clear','xyz.tready.app').strip()==b'Success'
adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
start=time.monotonic();started=False;initial_absence=False;last_stage=None;last_auth=0
while time.monotonic()-start<330:
 nodes=list(hierarchy().iter('node'));texts=labels(nodes)
 if started and 'Kunci sesi' in texts and any(t.lower()==expected.lower() for t in texts):break
 if not started:
  label='Pulihkan passkey yang sudah ada' if args.clear_data else 'Buka passkey'
  initial_absence=initial_absence or 'Belum ada wallet' in texts
  target=next((n for n in nodes if label in [n.get('text'),n.get('content-desc')] and n.get('enabled')=='true'),None)
  if target is not None:
   if args.clear_data:assert initial_absence
   tap(target);started=True
  stage='app_initial_state'
 elif any(n.get('resource-id')=='com.android.systemui:id/lockPassword' for n in nodes):
  stage='device_credential_authentication'
  if time.monotonic()-last_auth>30:
   enter_secret('com.android.systemui:id/lockPassword',pin);last_auth=time.monotonic()
 elif any(n.get('resource-id')=='com.kunzisoft.keepass.free:id/password_text_view' for n in nodes):
  stage='provider_vault_authentication'
  if time.monotonic()-last_auth>30:
   enter_secret('com.kunzisoft.keepass.free:id/password_text_view',password);last_auth=time.monotonic()
 else:
  stage='provider_or_PRF_result'
  target=next((n for label in ['Continue','keepass.kdbx (1)'] for n in nodes if label in [n.get('text'),n.get('content-desc')] and n.get('enabled')!='false'),None)
  if target is not None:tap(target)
 if stage!=last_stage:print(json.dumps({'stage':stage,'elapsedSeconds':round(time.monotonic()-start)}),flush=True);last_stage=stage
 time.sleep(1)
else:raise RuntimeError('Native PRF restore did not open the expected wallet within the test window.')
report={**creation,'checkedAt':datetime.now(timezone.utc).isoformat(),
 'classification':'native_Mera_PRF_create_build6_and_same_wallet_restore_on_current_APK',
 'creationApkSha256':creation.get('creationApkSha256',creation['apkSha256']),
 'creationSourceCommit':creation.get('creationSourceCommit',creation['sourceCommit']),
 'apkSha256':release['sha256'],'sourceCommit':release['sourceCommit'],
 'nativePrfRestoreVerified':True,'nativePrfRestartVerified':True,
 'nativePrfDiscoverableRestoreVerified':args.clear_data or creation.get('nativePrfDiscoverableRestoreVerified',False),
 'appDataClearedBeforeRestore':args.clear_data,'initialWalletAbsentObserved':initial_absence,
 'newOrdersSent':0,'ownerTransactionVerified':False,'nativeTradingVerified':False,
 'checksPassed':list(dict.fromkeys(creation['checksPassed']+[
  'installed APK checksum matches release metadata',
  'native PRF get opens the same signing identity on the current APK',
 ]+(['discoverable credential restores the same wallet after clearing app data'] if args.clear_data else [])))}
(ROOT/'artifacts/completion/native-prf.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2),flush=True)
