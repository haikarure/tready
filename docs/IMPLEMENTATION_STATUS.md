# Status implementasi Tready

Update12Oktober2026; bukti build/core/browser/emulator dan deployment diperbarui12Oktober. Dokumen ini membedakan kode yang tersedia, pengujian yang dilakukan, dan gate yang masih membutuhkan akses/device. PRD tetap merupakan target P0; keberadaan kode tidak menandai seluruh acceptance criteria selesai.

## Yang telah dibangun

- Android Expo57/RN0.86 dengan empat layar: Account, Plan, Trade, Receipt; Indonesian copy, testnet/latihan labels, conditional controls dan input review.
- BigInt risk engine: kedua arah, bounded entry/stress scenario, dua fee, reserve, collateral constraint, isolated liquidation estimate, decimal parsing dan plan approval digest.
- Adapter public Perpl context/book dan read-only Monad RPC. BTC market16/instance12/AUSD6 resolved serta diverifikasi dari endpoint asli; probe tersedia di [artifact](../artifacts/integration-probe.json).
- Mera account derivation/session adapter dan native passkey integration menggunakan published0.2.0 + passkey3.6.1. Native modules berhasil compile dan prompt/cancellation nyata diuji pada emulator; native PRF happy path belum diuji.
- Owner account/funding/allowance/deposit/forward/withdraw adapters, simulation dan hash-before-broadcast journal. Tidak ada owner transaction yang ditandatangani atau dikirim.
- Ed25519 auth, lossless uint64 wire codec, whitelisted-origin enrollment adapter dengan pinned schema gate, trading socket, snapshots/inventory, durable SQLite request journal dan SecureStore API secret adapter.
- Coordinator entry/stop/close/cancel; request outcome terpisah dari live trigger/position state. Unknown menahan replacement. History pagination tidak menganggap unseen request sebagai no-fill.
- Receipt schemas memisahkan standing fee share, settlement fee/close component, funding availability dan lifetime account net stats. Full trade-net reconciliation belum dibuktikan melalui authenticated payload.
- Latihan: simulated entry, stop, close dan local receipts. Latihan tidak memanggil signer/trading transport dan bukan actual Perpl fill.
- Native prebuild/build scripts, private preview signing plugin, release metadata/checksum dan static hosting artifact untuk assetlinks/distribution.

## Bukti yang tersedia

| Pemeriksaan | Bukti/status |
|---|---|
| TypeScript strict | Lulus pada source TypeScript final; snapshot aplikasi APK adb0e9e |
| Core tests | 34unique tests lulus di [core-tests.json](../artifacts/core-tests.json); synthetic/offline, bukan authenticated integration tests |
| Android JS/Hermes export | Berhasil; bundle tidak menggantikan APK/device test |
| Native build | Final standalone preview berhasil compile JDK17/SDK36, exact lockfile, private preview certificate; checksum/ABI/cert association cocok dengan [release.json](../artifacts/release.json) |
| Emulator | Tujuh checks lulus di [emulator-smoke.json](../artifacts/emulator-smoke.json): start dengan passkey control enabled, entry→protection-pending, stop registered, close→flat, label synthetic, receipt tersimpan sesudah force-stop/restart, navigasi font1.4 |
| Browser passkey | Delapan checks [WebAuthn virtual PRF](../artifacts/passkey-browser-smoke.json) memakai Mera dan production wallet derivation: create, sign/address verification, lock, same-credential restore, discoverable restore, new identity, wrong RP, missing PRF |
| Native passkey | Tiga checks [provider prompt/cancellation](../artifacts/native-passkey-probe.json): native bridge membuka prompt, cancel dikenali tanpa membuat wallet, enrollment tetap disabled. Native PRF happy path belum terbukti |
| Hosting/download | [Netlify host](../artifacts/netlify-host.json) aktif; assetlinks HTTPS200/JSON/tanpa redirect; APK download diverifikasi byte count dan SHA256. Deployment website utama tetap sama |
| Public integration | Context/book/RPC read-only berhasil, setelah satu timeout RPC pada percobaan awal |
| Users/sponsor/submission | Nol sesi pengguna; kartu bounty belum dikonfirmasi; belum submission/outreach |

[APK preview](https://tready-archzxy.netlify.app/downloads/tready-0.1.0-preview.apk) build3 berukuran54,202,455bytes dan mendukung arm64-v8a/x86_64, minimum install API24. App source commit `adb0e9ed578f8edcb27dfa16dadd6cb0bdd0f56e`, SHA256 `b887c49bb4aec5372c682d0391b1a9c2e04a535d956232ead55e21349ef4d9c7`. Laporan emulator/native probe serta download publik mengikat hasil pada checksum APK yang sama. Certificate preview tetap sama; minimum install tidak menjamin kompatibilitas PRF/provider.

[Account](../artifacts/screenshots/account-360dp.png), [Plan](../artifacts/screenshots/plan-360dp.png), [stop latihan terdaftar](../artifacts/screenshots/trade-protected-360dp.png), dan [Receipt](../artifacts/screenshots/receipt-360dp.png) merupakan real emulator UI. Account/Receipt font1.4 diperiksa secara visual: teks membungkus, navigasi dapat dipakai, dan konten panjang dapat digulir pada viewport360dp. Pemeriksaan ini tidak mengukur keunggulan UX terhadap pesaing atau pemakaian oleh pengguna nyata. CI remote/cloud build belum dijalankan.

## Gate yang belum selesai

Founder memiliki `archzxy.com`, dan akses Netlify lokal berhasil digunakan untuk membuat site terpisah. RP ID preview yang aktif adalah `tready-archzxy.netlify.app`; association serta APK download sudah dipublikasikan dan diverifikasi. Website utama tidak diubah; tidak ada DNS mutation. `auth.archzxy.com` belum aktif karena DNS Spaceship belum dapat diakses, dan tidak diperlukan oleh preview ini. Mengganti RP ID setelah membuat credential memerlukan migrasi identitas, bukan config-only update.

Origin whitelist Perpl dan pinned enrollment schema belum terkonfirmasi. Otorisasi API trading tetap disabled; empty/incomplete policy ditolak sebelum network/signing. Verifikasi APK menemukan Expo mengubah null policy menjadi object kosong dan Gradle sempat memakai cached JS yang belum mengawasi shared source. Gate policy, SDK error handling, artifact metadata dan shared-source build inputs telah diperbaiki sebelum APK final dipublikasikan.

HP fisik bukan syarat mutlak untuk mencoba Mera: emulator dengan PRF-capable provider dapat digunakan. Emulator yang diuji memakai Google credential provider tanpa akun; prompt menawarkan credential melalui perangkat lain dan dibatalkan. Ini membuktikan bridge/prompt/cancel, bukan native PRF, provider sync atau hardware biometrics.

Pengujian physical Android PRF, clear-data identity restore, biometric SecureStore, funding/account/forwarding, authenticated request-target, real entry/stop/close, API-expiry trigger survival, recycle charge/refund, partial fills dan live recovery belum dilakukan. Error/partial traces yang diuji secara synthetic tidak diubah menjadi klaim actual trading. Penyelesaian unknown setelah venue failure masih konservatif; tidak ada automatic replacement/retry dari missing history.

Full P0 dan kesiapan submission belum selesai. Public market + planning + latihan/native preview merupakan hasil yang dapat direview sekarang. Vendor/native-provider gates tetap membutuhkan bukti sebelum live features atau sponsor fit diklaim.

Instruksi konkret: [RUNBOOK](RUNBOOK.md). Alasan scope/reliability: [PRD](PRD.md), [test plan](TEST_PLAN.md), [audit](metropolis-adversarial-review.md). Tidak ada mainnet write, user outreach, pembelian cloud/domain, atau claim hadiah/traction.
