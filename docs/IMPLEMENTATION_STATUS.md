# Status implementasi Tready

**Remediation12Oktober:** tiga temuan kode audit sudah diperbaiki. Enrollment memeriksa seluruh otorisasi sebelum signature; SQLite memakai transisi atomik yang mempertahankan outcome; stop parsial mempunyai status/cakupan dan flow pembatalan untuk perbaikan. Key impor venue diperiksa terhadap wallet Mera yang sama sebelum SecureStore. [Core tests terbaru](../artifacts/remediation/core-tests.json):65/65 lulus. [Regresi audit](../artifacts/remediation/invariants.json) lulus.

**Actual testnet venue proof:** [entry→stop→close](../artifacts/remediation/trade-smoke.json) berhasil untuk1lot BTC pada account1112. Tiga request settled; stop penuh terdaftar; final account flat tanpa order/position tersisa. Ini Node+key UI venue, bukan native Mera onboarding. Own Origin masihHTTP400 pada [cek terbaru](../artifacts/remediation/origin.json). APK0.1.1/build4 dibangun dan lolos smoke tests; release.json menjadi sumber versi/checksum yang benar. Detail hasil di [remediation](REMEDIATION_2026-10-12.md).

Update12Oktober2026; bukti build/core/browser/emulator dan deployment diperbarui12Oktober. Dokumen ini membedakan kode yang tersedia, pengujian yang dilakukan, dan gate yang masih membutuhkan akses/device. PRD tetap merupakan target P0; keberadaan kode tidak menandai seluruh acceptance criteria selesai.

## Yang telah dibangun

- Android Expo57/RN0.86 dengan empat layar: Account, Plan, Trade, Receipt; Indonesian copy, testnet/latihan labels, conditional controls dan input review.
- BigInt risk engine: kedua arah, bounded entry/stress scenario, dua fee, reserve, collateral constraint, isolated liquidation estimate, decimal parsing dan plan approval digest.
- Adapter public Perpl context/book dan read-only Monad RPC. BTC market16/instance12/AUSD6 resolved serta diverifikasi dari endpoint asli; probe tersedia di [artifact](../artifacts/integration-probe.json).
- Mera account derivation/session adapter dan native passkey integration menggunakan published0.2.0 + passkey3.6.1. Native modules berhasil compile dan prompt/cancellation nyata diuji pada emulator; native PRF happy path belum diuji.
- Owner account/funding/allowance/deposit/forward/withdraw adapters, simulation dan hash-before-broadcast journal. Tidak ada owner transaction yang ditandatangani atau dikirim; actual API trade kecil dibuktikan terpisah melalui Node.
- Ed25519 auth, lossless uint64 wire codec, whitelisted-origin enrollment adapter dengan pinned schema gate, trading socket, snapshots/inventory, durable SQLite request journal dan SecureStore API secret adapter.
- Coordinator entry/stop/close/cancel; request outcome terpisah dari live trigger/position state. Unknown menahan replacement. History pagination tidak menganggap unseen request sebagai no-fill.
- Receipt schemas memisahkan standing fee share, settlement fee/close component, funding availability dan lifetime account net stats. Full trade-net reconciliation belum dibuktikan melalui authenticated payload.
- Latihan: simulated entry, stop, close dan local receipts. Latihan tidak memanggil signer/trading transport dan bukan actual Perpl fill.
- Native prebuild/build scripts, private preview signing plugin, release metadata/checksum dan static hosting artifact untuk assetlinks/distribution.

## Bukti yang tersedia

| Pemeriksaan | Bukti/status |
|---|---|
| TypeScript strict | Lulus pada source TypeScript final; snapshot aplikasi APK adb0e9e |
| Core tests | 65tests lulus di [remediation/core-tests.json](../artifacts/remediation/core-tests.json); offline/synthetic. Laporan34tests lama milik snapshot APK build3 |
| Android JS/Hermes export | Berhasil; bundle tidak menggantikan APK/device test |
| Native build | Final standalone preview berhasil compile JDK17/SDK36, exact lockfile, private preview certificate; checksum/ABI/cert association cocok dengan [release.json](../artifacts/release.json) |
| Emulator | Tujuh checks lulus di [emulator-smoke.json](../artifacts/emulator-smoke.json): start dengan passkey control enabled, entry→protection-pending, stop registered, close→flat, label synthetic, receipt tersimpan sesudah force-stop/restart, navigasi font1.4 |
| Browser passkey | Delapan checks [WebAuthn virtual PRF](../artifacts/passkey-browser-smoke.json) memakai Mera dan production wallet derivation: create, sign/address verification, lock, same-credential restore, discoverable restore, new identity, wrong RP, missing PRF |
| Native passkey | Tiga checks [provider prompt/cancellation](../artifacts/native-passkey-probe.json): native bridge membuka prompt, cancel dikenali tanpa membuat wallet, enrollment tetap disabled. Native PRF happy path belum terbukti |
| Hosting/download | [Netlify release terbaru](../artifacts/remediation/netlify-release.json) aktif; assetlinks HTTPS200/JSON/tanpa redirect; APK download diverifikasi byte count dan SHA256. Deployment website utama tetap sama |
| Public integration | Context/book/RPC read-only berhasil, setelah satu timeout RPC pada percobaan awal |
| Authenticated transport | [key-spike](../artifacts/key-spike.json): `/v1/trading/wallet`, `/orders`, `/positions` semuanya 200 tanpa header Origin; [ws-spike](../artifacts/ws-spike.json): sign-in mt:29 diterima lalu server mengirim mt:19/23/26 dan heartbeat. Memakai API key testnet yang dibuat pengguna melalui UI venue; read-only, tanpa pengiriman order |
| Enrollment/origin probe | [enroll-spike](../artifacts/enroll-spike.json): origin aplikasi 400 tiga kali dalam enam request total, dua Origin pembanding 200; [enroll-e2e](../artifacts/enroll-e2e.json): schema vendor terekam, enroll 404 *target profile not found* pada wallet tanpa akun Perpl. Nol API key dibuat |
| Users/sponsor/submission | Nol sesi pengguna; kartu bounty belum dikonfirmasi; belum submission/outreach |

[APK preview](https://tready-archzxy.netlify.app/downloads/tready-0.1.1-preview.apk) build4 berukuran54,218,559bytes. Source aplikasi `1f16b9b093d776d82ea7aeb43f5c66bb90d1169a`, SHA256 `dcc62264fccb7c74192b6e67f8d5eeafc14d68518060ca64508cdf4d72873da0`. Emulator/native cancellation dan bootstrap migration memakai checksum ini. [Build3 diarsipkan](../artifacts/archive/build3/release.json).

[Account](../artifacts/screenshots/account-360dp.png), [Plan](../artifacts/screenshots/plan-360dp.png), [stop latihan terdaftar](../artifacts/screenshots/trade-protected-360dp.png), dan [Receipt](../artifacts/screenshots/receipt-360dp.png) merupakan real emulator UI. Account/Receipt font1.4 diperiksa secara visual: teks membungkus, navigasi dapat dipakai, dan konten panjang dapat digulir pada viewport360dp. Pemeriksaan ini tidak mengukur keunggulan UX terhadap pesaing atau pemakaian oleh pengguna nyata. CI remote dipicu namun job tidak dimulai karena account billing lock; [bukti](../artifacts/remediation/cloud-ci.json).

## Gate yang belum selesai

Founder memiliki `archzxy.com`, dan akses Netlify lokal berhasil digunakan untuk membuat site terpisah. RP ID preview yang aktif adalah `tready-archzxy.netlify.app`; association serta APK download sudah dipublikasikan dan diverifikasi. Website utama tidak diubah; tidak ada DNS mutation. `auth.archzxy.com` belum aktif karena DNS Spaceship belum dapat diakses, dan tidak diperlukan oleh preview ini. Mengganti RP ID setelah membuat credential memerlukan migrasi identitas, bukan config-only update.

Origin whitelist Perpl kini **diukur, bukan diasumsikan**. `POST /v1/api-key/payload` dengan Origin `https://tready-archzxy.netlify.app` menghasilkan HTTP 400 pada tiga percobaan Origin app dalam enam request total yang diselang-seling dengan dua Origin pembanding (tanpa Origin 200, Origin `https://testnet.perpl.xyz` 200), Pola ini konsisten dengan gate Origin, tetapi respons400 generik tidak memastikan satu penyebab server. Schema EIP-712 vendor terbaca langsung dari payload live: domain `perpl.xyz` v1, chainId `0x279f`, `verifyingContract` nol, primaryType `PerplRegisterApiKey`, tipe hanya `EIP712Domain` dan `PerplRegisterApiKey`. Pinned policy karenanya dapat diisi dari payload vendor asli, bukan tebakan. Dua bug encoding diperbaiki pada source; probe enrollment berakhir404 dan bukan sukses onboarding: vendor mengirim chainId sebagai string `0x`-hex yang membuat `safeNumber` melempar `INTEGER_INVALID`, dan public key sebagai base64url sementara kode membandingkannya dengan `0x`-hex. Keduanya kini dinormalisasi sebelum dibandingkan; nilai yang dibandingkan tetap ketat.

Otorisasi API trading tetap disabled sampai origin di-whitelist; empty/incomplete policy ditolak sebelum network/signing. `POST /v1/api-key/enroll` pada probe end-to-end menghasilkan 404, yang menurut tabel status dokumentasi Perpl berarti *target profile not found* — wallet probe tidak memiliki akun Perpl, bukan path endpoint yang salah. Probe memakai wallet acak tanpa dana dan **tidak menghasilkan satu API key pun**. Verifikasi APK menemukan Expo mengubah null policy menjadi object kosong dan Gradle sempat memakai cached JS yang belum mengawasi shared source. Gate policy, SDK error handling, artifact metadata dan shared-source build inputs telah diperbaiki sebelum APK final dipublikasikan.

HP fisik bukan syarat mutlak untuk mencoba Mera: emulator dengan PRF-capable provider dapat digunakan. Emulator yang diuji memakai Google credential provider tanpa akun; prompt menawarkan credential melalui perangkat lain dan dibatalkan. Ini membuktikan bridge/prompt/cancel, bukan native PRF, provider sync atau hardware biometrics.

Pengujian physical Android PRF, clear-data identity restore, biometric SecureStore, funding/account/forwarding, authenticated request-target, entry/stop/close melalui APK, API-expiry trigger survival, recycle charge/refund, partial fills dan live recovery belum dilakukan. Error/partial traces yang diuji secara synthetic tidak diubah menjadi klaim actual trading. Penyelesaian unknown setelah venue failure masih konservatif; tidak ada automatic replacement/retry dari missing history.

Full P0 dan kesiapan submission belum selesai. Public market + planning + latihan/native preview merupakan hasil yang dapat direview sekarang. Vendor/native-provider gates tetap membutuhkan bukti sebelum live features atau sponsor fit diklaim.

Instruksi konkret: [RUNBOOK](RUNBOOK.md). Alasan scope/reliability: [PRD](PRD.md), [test plan](TEST_PLAN.md), [audit](metropolis-adversarial-review.md). Tidak ada mainnet write, user outreach, pembelian cloud/domain, atau claim hadiah/traction.
