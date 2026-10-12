"""Seed only synthetic rows on a dedicated emulator and exercise NativeStore.open migration."""
import json,subprocess,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
ADB=ROOT/'.tooling/android-sdk/platform-tools/adb'
SERIAL='emulator-5556'
DB='/data/user/0/xyz.tready.app/files/SQLite/tready-v1.db'
def adb(*args):return subprocess.check_output([str(ADB),'-s',SERIAL,*args],timeout=25).decode()
assert adb('emu','avd','name').splitlines()[0]=='tready-api36'
release=json.loads((ROOT/'artifacts/release.json').read_text())
assert release['build']>=4
assert f"versionCode={release['build']}" in adb('shell','dumpsys','package','xyz.tready.app')
assert 'uid=0' in adb('shell','id'), 'Dedicated emulator adbd must be root.'
def sql(statement):
 r=subprocess.run([str(ADB),'-s',SERIAL,'shell','sqlite3',DB],input=statement.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,check=True)
 return r.stdout.decode()
ids=['9000000000001','9000000000002','9000000000003','9000000000004']
assert not sql("SELECT id FROM requests WHERE account='9000';").strip()
adb('shell','am','force-stop','xyz.tready.app')
try:
 for id,status,seen in zip(ids,['sent','forwarded','prepared','settled'],[1,0,0,1]):
  command=json.dumps({'mt':22,'sn':int(id),'rq':int(id),'mkt':16,'acc':9000,'t':1,'p':1,'s':1,'fl':4,'lv':300,'lb':0},separators=(',',':'))
  sql(f"INSERT INTO requests(id,account,kind,command,plan_id,status,created_at,seen,reason) VALUES('{id}','9000','entry','{command}',NULL,'{status}',1,{seen},'Synthetic migration probe');")
 adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
 rows=[]
 for _ in range(12):
  rows=json.loads(sql(".mode json\nSELECT id,status,seen FROM requests WHERE account='9000' ORDER BY id;\n"))
  if [r['status'] for r in rows]==['settled','unknown','unknown','settled']:break
  time.sleep(.5)
 assert [r['status'] for r in rows]==['settled','unknown','unknown','settled'],rows
 report={'testedAt':datetime.now(timezone.utc).isoformat(),'classification':'actual_Expo_NativeStore_open_on_Android_with_synthetic_journal_rows','success':True,'apkSha256':release['sha256'],'appSourceCommit':release['sourceCommit'],'cases':rows,'realOrdersSent':0,'rowsRemovedAfterProbe':True,'limitations':['Exercises actual startup migration, not timing of a live order race.']}
 (ROOT/'artifacts/remediation/native-journal-bootstrap.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
finally:
 adb('shell','am','force-stop','xyz.tready.app')
 sql("DELETE FROM requests WHERE account='9000' AND id IN ('"+"','".join(ids)+"');")
 adb('shell','am','start','-n','xyz.tready.app/.MainActivity')
