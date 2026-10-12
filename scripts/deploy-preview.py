"""Publish only the existing Tready Netlify site, with verified APK and no secret files."""
import json,zipfile,hashlib,time,argparse,urllib.request,urllib.error,urllib.parse,shutil,subprocess
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
SITE='4d3736b5-024f-4255-82a7-fbf2d2849945'
ORIGIN='https://tready-archzxy.netlify.app'
parser=argparse.ArgumentParser();parser.add_argument('--deploy',action='store_true');args=parser.parse_args()
release=json.loads((ROOT/'artifacts/release.json').read_text())
assert release['build']>=4 and release['rpId']=='tready-archzxy.netlify.app'
apk=ROOT/'artifacts'/release['file'];assert hashlib.sha256(apk.read_bytes()).hexdigest()==release['sha256']
for name in ['emulator-smoke.json','native-passkey-probe.json']:
 evidence=json.loads((ROOT/'artifacts'/name).read_text());assert evidence['apkSha256']==release['sha256']
bootstrap=json.loads((ROOT/'artifacts/remediation/native-journal-bootstrap.json').read_text());assert bootstrap['success'] and bootstrap['apkSha256']==release['sha256']
stage=ROOT/'.tooling/netlify-build4';shutil.rmtree(stage,ignore_errors=True);shutil.copytree(ROOT/'apps/access/public',stage)
downloads=stage/'downloads';downloads.mkdir(exist_ok=True)
shutil.copy2(apk,downloads/release['file']);shutil.copy2(ROOT/'artifacts/release.json',downloads/'release.json')
shutil.copy2(ROOT/'artifacts/remediation/trade-evidence.json',downloads/'trade-evidence.json')
shutil.copy2(ROOT/'artifacts/remediation/recovery-smoke.json',downloads/'recovery-smoke.json')
for version,build in [('0.1.0','build3'),('0.1.1','build4'),('0.1.2','build5')]:
 old=ROOT/'artifacts'/f'tready-{version}-preview.apk'
 if old.exists():shutil.copy2(old,downloads/old.name)
 metadata=ROOT/'artifacts/archive'/build/'release.json'
 if metadata.exists():
  (downloads/'releases').mkdir(exist_ok=True);shutil.copy2(metadata,downloads/'releases'/f'{version}.json')
demo=ROOT/'.tooling/tready-preview-demo-final.mp4'
assert demo.exists(),'Demo must be finalized before deployment.'
shutil.copy2(demo,downloads/'tready-preview-demo.mp4')
archive=ROOT/'.tooling/tready-build4-deploy.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(stage.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(stage).as_posix())
print(json.dumps({'prepared':True,'zipBytes':archive.stat().st_size,'site':SITE,'apkSha256':release['sha256'],'privateSigningFilesIncluded':False}),flush=True)
if not args.deploy:raise SystemExit(0)
config=json.loads((Path.home()/'.config/netlify/config.json').read_text());token=config['users'][config['userId']]['auth']['token']
def api(path,data=None,content_type='application/json',method=None):
 req=urllib.request.Request('https://api.netlify.com/api/v1'+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':content_type,'Accept':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=120) as r:return json.loads(r.read())
 except urllib.error.HTTPError as e:raise RuntimeError(f'Netlify HTTP {e.code}') from None
site=api('/sites/'+SITE);assert site['name']=='tready-archzxy' and site.get('custom_domain') is None
files={f.relative_to(stage).as_posix():f for f in stage.rglob('*') if f.is_file()}
digests={name:hashlib.sha1(file.read_bytes()).hexdigest() for name,file in files.items()}
deploy=api('/sites/'+SITE+'/deploys',json.dumps({'files':{'/'+name:sha for name,sha in digests.items()}}).encode());id=deploy['id']
print(json.dumps({'deployId':id,'method':'file-digest','requiredFiles':len(deploy.get('required',[]))}),flush=True)
for sha in deploy.get('required',[]):
 name=next(name for name,value in digests.items() if value==sha);file=files[name]
 path='/deploys/'+id+'/files/'+urllib.parse.quote(name,safe='/')
 if file.stat().st_size>5_000_000:
  # Supply auth through stdin config, not command arguments or logs. PUT is idempotent.
  curl_config='header = "Authorization: Bearer '+token+'"\nheader = "Content-Type: application/octet-stream"\n'
  result=subprocess.run(['curl','--silent','--show-error','--connect-timeout','20','--max-time','240','--retry','2','--retry-all-errors','--config','-','--request','PUT','--data-binary','@'+str(file),'--output',str(ROOT/'.tooling/netlify-upload-response.json'),'--write-out','%{http_code}','https://api.netlify.com/api/v1'+path],input=curl_config,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
  assert result.stdout.strip() in ['200','201','202'], 'Netlify file upload HTTP '+result.stdout.strip()
 else:api(path,file.read_bytes(),'application/octet-stream','PUT')
 print(json.dumps({'uploaded':name,'bytes':file.stat().st_size}),flush=True)
for _ in range(60):
 current=api('/deploys/'+id)
 if current['state']=='ready':break
 if current['state']=='error':raise RuntimeError('NETLIFY_DEPLOY_FAILED')
 time.sleep(2)
assert current['state']=='ready'
site=api('/sites/'+SITE);assert site['published_deploy']['id']==id
checks=[]
for path in ['/','/proof.html','/.well-known/assetlinks.json','/downloads/release.json','/downloads/'+release['file'],'/downloads/tready-preview-demo.mp4']:
 if path.endswith('.apk'):
  downloaded=ROOT/'.tooling/netlify-verified.apk'
  subprocess.run(['curl','--silent','--show-error','--fail','--connect-timeout','20','--max-time','120','--retry','2','--retry-all-errors','--output',str(downloaded),ORIGIN+path],check=True)
  data=downloaded.read_bytes();digest=hashlib.sha256(data).hexdigest()
  assert len(data)==release['bytes'] and digest==release['sha256']
  checks.append({'path':path,'status':200,'bytes':len(data),'sha256':digest,'matchesRelease':True,'method':'complete_curl_download_with_transfer_validation'});continue
 with urllib.request.urlopen(ORIGIN+path,timeout=60) as r:
  digest=hashlib.sha256();size=0;parts=[]
  while chunk:=r.read(1024*1024):
   digest.update(chunk);size+=len(chunk)
   if path.endswith('.json'):parts.append(chunk)
  check={'path':path,'status':r.status,'contentType':r.headers.get('Content-Type'),'redirected':r.url!=ORIGIN+path,'bytes':size,'sha256':digest.hexdigest()}
  assert r.status==200 and not check['redirected']
  if path.endswith('release.json'):assert json.loads(b''.join(parts))==release;check['matchesRelease']=True
  if path.endswith('assetlinks.json'):
   targets=[x['target'] for x in json.loads(b''.join(parts))];assert any(t.get('package_name')==release['package'] and release['certificateSha256'] in t.get('sha256_cert_fingerprints',[]) for t in targets);check['matchesCertificate']=True
  checks.append(check)
report={'deployedAt':datetime.now(timezone.utc).isoformat(),'siteId':SITE,'site':ORIGIN,'deployId':id,'published':True,'release':release,'checks':checks,'existingApexSiteModified':False,'DNSModified':False}
(ROOT/'artifacts/remediation/netlify-release.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'published':True,'site':ORIGIN,'deployId':id,'publicApkVerified':True,'videoPublished':True}),flush=True)
