"""Render a qualified preview from actual Android captures and public RPC footage."""
import hashlib,json,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
WORK=ROOT/'.tooling/demo-render';WORK.mkdir(exist_ok=True)
FONT='/usr/share/fonts/TTF/DejaVuSans.ttf'
release=json.loads((ROOT/'artifacts/release.json').read_text())
native=json.loads((ROOT/'artifacts/completion/native-prf.json').read_text())
smoke=json.loads((ROOT/'artifacts/emulator-smoke.json').read_text())
assert native['nativePrfDiscoverableRestoreVerified'] and native['apkSha256']==smoke['apkSha256']==release['sha256']
def ffmpeg(*args):
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2',*args],check=True)
def encode(name,*args):
 out=WORK/(name+'.mp4')
 ffmpeg(*args,'-an','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-r','30','-threads','2',str(out))
 return out
intro=encode('intro','-f','lavfi','-i','color=c=0x0b111a:s=720x1600:r=30:d=8','-vf',f'drawtext=fontfile={FONT}:textfile={ROOT}/.tooling/demo-intro.txt:fontcolor=0xd6f58b:fontsize=30:line_spacing=15:x=45:y=450')
flow=encode('flow','-i',str(ROOT/'.tooling/tready-preview-demo-raw.mp4'),'-vf','scale=720:1600:force_original_aspect_ratio=decrease,pad=720:1600:(ow-iw)/2:(oh-ih)/2:color=0x0b111a,fps=30')
caption=WORK/'native-caption.txt';caption.write_text('After native PRF recovery\nSame wallet after app data reset\nRecorded app state / Android emulator\nFunding and APK trading remain pending\n')
wallet=encode('wallet','-loop','1','-framerate','30','-i',str(ROOT/'artifacts/completion/screenshots/native-prf-restored.png'),'-t','8','-vf',f'scale=720:1600,drawbox=x=0:y=0:w=720:h=205:color=0x0b111a@0.95:t=fill,drawtext=fontfile={FONT}:textfile={caption}:fontcolor=0xd6f58b:fontsize=22:line_spacing=10:x=26:y=34')
proof=encode('proof','-i',str(ROOT/'.tooling/proof-browser/proof-live.webm'),'-vf','scale=720:1600:force_original_aspect_ratio=decrease,pad=720:1600:(ow-iw)/2:(oh-ih)/2:color=0x0b111a,fps=30')
outro=encode('outro','-f','lavfi','-i','color=c=0x0b111a:s=720x1600:r=30:d=10','-vf',f'drawtext=fontfile={FONT}:textfile={ROOT}/.tooling/demo-outro.txt:fontcolor=0xd6f58b:fontsize=27:line_spacing=15:x=40:y=440')
listing=WORK/'concat.txt';listing.write_text(''.join(f"file '{p}'\n" for p in [intro,flow,wallet,proof,outro]))
output=ROOT/'.tooling/tready-preview-demo-final.mp4'
ffmpeg('-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(output))
duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(output)]))
assert duration<180
data=output.read_bytes()
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'classification':'APK_build7_synthetic_workflow_native_PRF_recovered_wallet_state_and_live_RPC_receipts','apkSha256':release['sha256'],'version':release['version'],'seconds':duration,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'appFlowSynthetic':True,'nativeWalletSegment':'actual_app_screenshot_after_real_provider_PRF_recovery_not_a_recording_of_private_authentication','nativePrfDiscoverableRestoreVerified':True,'RPCReadsLive':True,'RPCReceiptsVerified':3,'nativeTradingVerified':False,'newOrdersForVideo':0}
(ROOT/'artifacts/completion/demo.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
