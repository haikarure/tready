"""Verify existing Node trade receipts through live public RPC in the browser.

No wallet, API secret, signature, enrollment or new transaction is used.
"""
import functools,http.server,json,shutil,threading
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
WORK=ROOT/'.tooling/proof-browser';(WORK/'downloads').mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'apps/access/public/proof.html',WORK/'proof.html')
shutil.copy2(ROOT/'artifacts/remediation/trade-evidence.json',WORK/'downloads/trade-evidence.json')
class QuietHandler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=WORK))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=str(Path.home()/'.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'),headless=True)
  context=browser.new_context(viewport={'width':720,'height':1600},record_video_dir=str(WORK/'video'),record_video_size={'width':720,'height':1600})
  page=context.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/proof.html')
  button=page.locator('#verify');button.wait_for(state='visible');page.wait_for_function('!document.querySelector("#verify").disabled',timeout=15000)
  page.wait_for_timeout(1500);button.click()
  page.wait_for_function('!document.querySelector("#verify").disabled',timeout=65000)
  assert page.locator('#state').inner_text()=='3/3 receipts verified · Monad Testnet 10143 · zero new orders',page.locator('#state').inner_text()
  assert page.locator('#trades .ok').count()==3
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert 'These transactions came from Node.' in page.locator('main').inner_text()
  (ROOT/'artifacts/completion/screenshots').mkdir(parents=True,exist_ok=True)
  page.screenshot(path=str(ROOT/'artifacts/completion/screenshots/chain-proof.png'),full_page=True)
  page.wait_for_timeout(10000);video=page.video;context.close();video.save_as(str(WORK/'proof-live.webm'));browser.close()
 report={'checkedAt':datetime.now(timezone.utc).isoformat(),'classification':'browser_live_RPC_readback_of_existing_Node_trade_receipts','chainId':10143,'receiptsVerified':3,'networkReadMethods':['eth_chainId','eth_getTransactionReceipt'],'newOrdersSent':0,'nativeTradeVerified':False,'horizontalOverflow':False,'screenshot':'screenshots/chain-proof.png','videoPrivatePath':'.tooling/proof-browser/proof-live.webm'}
 (ROOT/'artifacts/completion/proof-browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
finally:server.shutdown()
