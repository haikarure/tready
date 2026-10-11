# Status implementasi Tready

11 Oktober 2026. Dokumen ini membedakan kode yang tersedia, pengujian yang dilakukan, dan gate yang masih membutuhkan akses/device. PRD tetap merupakan target P0; keberadaan kode tidak menandai seluruh acceptance criteria selesai.

## Yang telah dibangun

- Android Expo57/RN0.86 dengan empat layar: Account, Plan, Trade, Receipt; Indonesian copy, testnet/latihan labels, conditional controls dan input review.
- BigInt risk engine: kedua arah, bounded entry/stress scenario, dua fee, reserve, collateral constraint, isolated liquidation estimate, decimal parsing dan plan approval digest.
- Adapter public Perpl context/book dan read-only Monad RPC. BTC market16/instance12/AUSD6 resolved serta diverifikasi dari endpoint asli; probe tersedia di [artifact](../artifacts/integration-probe.json).
- Mera account derivation/session adapter dan native passkey integration menggunakan published0.2.0 + passkey3.6.1. Native modules berhasil compile; PRF ceremony di HP nyata belum diuji.
- Owner account/funding/allowance/deposit/forward/withdraw adapters, simulation dan hash-before-broadcast journal. Tidak ada owner transaction yang ditandatangani atau dikirim.
- Ed25519 auth, lossless uint64 wire codec, whitelisted-origin enrollment adapter dengan pinned schema gate, trading socket, snapshots/inventory, durable SQLite request journal dan SecureStore API secret adapter.
- Coordinator entry/stop/close/cancel; request outcome terpisah dari live trigger/position state. Unknown menahan replacement. History pagination tidak menganggap unseen request sebagai no-fill.
- Receipt schemas memisahkan standing fee share, settlement fee/close component, funding availability dan lifetime account net stats. Full trade-net reconciliation belum dibuktikan melalui authenticated payload.
- Latihan: simulated entry, stop, close dan local receipts. Latihan tidak memanggil signer/trading transport dan bukan actual Perpl fill.
- Native prebuild/build scripts, private preview signing plugin, release metadata/checksum dan static hosting artifact untuk assetlinks/distribution.

## Bukti yang tersedia

| Pemeriksaan | Bukti/status |
|---|---|
| TypeScript strict | Lulus pada final source aplikasi commit63327de |
| Core tests | 31unique tests lulus di [core-tests.json](../artifacts/core-tests.json); synthetic/offline, bukan authenticated integration tests |
| Android JS/Hermes export | Berhasil; bundle tidak menggantikan APK/device test |
| Native build | Final standalone preview berhasil compile JDK17/SDK36, exact lockfile, private preview certificate; checksum/ABI/cert association cocok dengan [release.json](../artifacts/release.json) |
| Emulator | Tujuh checks lulus di [emulator-smoke.json](../artifacts/emulator-smoke.json): start dengan passkey disabled, entry→protection-pending, stop registered, close→flat, label synthetic, receipt tersimpan sesudah force-stop/restart, navigasi font1.4; physical passkey belum diuji |
| Public integration | Context/book/RPC read-only berhasil, setelah satu timeout RPC pada percobaan awal |
| Users/sponsor/submission | Nol sesi pengguna; kartu bounty belum dikonfirmasi; belum submission/outreach |

[APK preview](../artifacts/tready-0.1.0-preview.apk) berukuran54,200,887bytes dan mendukung arm64-v8a/x86_64, minimum install API24. App source commit `63327de0f6f5dfa9cdd7a4846fafd2b35d6dc272`, SHA256 `48cc1638d8f118ae1f6088177da74282944d32cb94ac5876735a7a3f6513b36b`. Laporan emulator mengikat hasil pada checksum APK tersebut. Update APK memakai certificate yang sama berhasil; ini tidak membuktikan passkey/account recovery.

[Account](../artifacts/screenshots/account-360dp.png), [Plan](../artifacts/screenshots/plan-360dp.png), [stop latihan terdaftar](../artifacts/screenshots/trade-protected-360dp.png), dan [Receipt](../artifacts/screenshots/receipt-360dp.png) merupakan real emulator UI. Account/Receipt font1.4 diperiksa secara visual: teks membungkus, navigasi dapat dipakai, dan konten panjang dapat digulir pada viewport360dp. Pemeriksaan ini tidak mengukur keunggulan UX terhadap pesaing atau pemakaian oleh pengguna nyata. CI remote/cloud build belum dijalankan.

## Gate yang belum selesai

User mengonfirmasi belum mempunyai domain/rpId dan whitelist Perpl. Login/enrollment pada build default tetap disabled sampai stable owned HTTPS host/cert association dan vendor-confirmed enrollment schema siap. Tidak memakai domain sponsor atau header palsu sebagai substitusi.

Pengujian physical Android PRF, clear-data identity restore, biometric SecureStore, funding/account/forwarding, authenticated request-target, real entry/stop/close, API-expiry trigger survival, recycle charge/refund, partial fills dan live recovery belum dilakukan. Error/partial traces yang diuji secara synthetic tidak diubah menjadi klaim actual trading. Penyelesaian unknown setelah venue failure masih konservatif; tidak ada automatic replacement/retry dari missing history.

Full P0 dan kesiapan submission belum selesai. Public market + planning + latihan/native preview merupakan hasil yang dapat direview sekarang. Domain/vendor/device gates tetap membutuhkan bukti sebelum live features atau sponsor fit diklaim.

Instruksi konkret: [RUNBOOK](RUNBOOK.md). Alasan scope/reliability: [PRD](PRD.md), [test plan](TEST_PLAN.md), [audit](metropolis-adversarial-review.md). Tidak ada mainnet write, user outreach, pembelian cloud/domain, atau claim hadiah/traction.
