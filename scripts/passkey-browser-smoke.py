"""Exercise real Mera/browser WebAuthn with a software PRF authenticator.

This does not test Android Credential Manager, hardware biometrics, a cloud
passkey provider, funding, or Perpl authentication. No keys/PRF bytes are logged.
"""
import functools, hashlib, http.server, json, subprocess, threading
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / '.tooling/passkey-browser'
WORK.mkdir(parents=True, exist_ok=True)
subprocess.run([str(ROOT/'scripts/dev.sh'), str(ROOT/'node_modules/.bin/esbuild'),
                'scripts/passkey-browser-harness.ts', '--bundle', '--platform=browser',
                '--format=iife', f'--outfile={WORK}/harness.js'], cwd=ROOT, check=True)
(WORK/'index.html').write_text('<!doctype html><title>Tready local passkey test</title><script src="harness.js"></script>')

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=WORK))
threading.Thread(target=server.serve_forever, daemon=True).start()
cases = []
report = {'classification':'real_browser_WebAuthn_with_virtual_PRF_authenticator',
          'meraVersion':'0.2.0', 'physicalDevice':False,
          'notVerified':['Android native passkey bridge/provider','hardware biometrics',
                         'provider sync or cross-device restoration','owner transactions',
                         'Perpl enrollment/authenticated trading'], 'passed':cases}
chrome = Path.home()/'.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
if not chrome.exists(): raise RuntimeError('Set up the documented Chrome test binary first.')
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=str(chrome), headless=True)
        report['browserVersion'] = browser.version
        page = browser.new_page()
        cdp = page.context.new_cdp_session(page)
        cdp.send('WebAuthn.enable')
        options = {'protocol':'ctap2','ctap2Version':'ctap2_1','transport':'internal',
                   'hasResidentKey':True,'hasUserVerification':True,'isUserVerified':True,
                   'automaticPresenceSimulation':True,'hasPrf':True}
        authenticator = cdp.send('WebAuthn.addVirtualAuthenticator', {'options':options})['authenticatorId']
        page.goto(f'http://localhost:{server.server_port}/')
        first = page.evaluate('() => treadyPasskeyTest.create()')
        assert first['prfBytes'] == 32
        cases.append('Mera creates a discoverable user-verified credential and receives a 32-byte virtual PRF')
        assert page.evaluate('() => treadyPasskeyTest.signAndVerify()') is True
        cases.append('production wallet derivation signs a message verified against its EVM address')
        assert page.evaluate('() => treadyPasskeyTest.lockAndTrySigning()')['rejected']
        cases.append('ending the Mera session rejects later signing')
        page.reload()
        restored = page.evaluate('(id) => treadyPasskeyTest.restore(id)', first['credentialId'])
        assert restored['address'] == first['address']
        cases.append('fresh page session plus existing credential recovers the same wallet address')
        page.reload()
        discovered = page.evaluate('() => treadyPasskeyTest.restore()')
        assert discovered['address'] == first['address']
        cases.append('discoverable credential restores identity without saved app metadata')
        second = page.evaluate('() => treadyPasskeyTest.create()')
        assert second['address'] != first['address'] and second['credentialId'] != first['credentialId']
        cases.append('a newly created credential produces a separate wallet identity')
        assert page.evaluate('() => treadyPasskeyTest.wrongRp()')['rejected']
        cases.append('the browser rejects a passkey request for an unrelated relying party')
        cdp.send('WebAuthn.removeVirtualAuthenticator', {'authenticatorId':authenticator})
        options['hasPrf'] = False
        cdp.send('WebAuthn.addVirtualAuthenticator', {'options':options})
        result = page.evaluate('''async () => {
          try { await treadyPasskeyTest.create(); return { rejected: false }; }
          catch (e) { return { rejected: true, code: e.code }; }
        }''')
        assert result == {'rejected':True,'code':'PRF_UNAVAILABLE'}, result
        cases.append('Mera fails closed with PRF_UNAVAILABLE on an authenticator without PRF')
        report['success'] = True
        report['walletDerivationSha256'] = hashlib.sha256((ROOT/'packages/wallet/derive.ts').read_bytes()).hexdigest()
        browser.close()
except Exception:
    report['success'] = False
    raise
finally:
    server.shutdown()
    report['testedAt'] = datetime.now(timezone.utc).isoformat()
    (ROOT/'artifacts/passkey-browser-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
