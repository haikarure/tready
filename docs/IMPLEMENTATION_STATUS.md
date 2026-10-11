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
| TypeScript strict | Lulus pada source yang diperiksa; ulang pada final code sebelum release |
| Core tests | Test report di [core-tests.json](../artifacts/core-tests.json); synthetic/offline, bukan authenticated integration tests |
| Android JS/Hermes export | Berhasil; bundle tidak menggantikan APK/device test |
| Native build | Preliminary standalone APK berhasil compile dengan JDK17/SDK36; final preview certificate/build sedang diselesaikan |
| Emulator | APK preliminary berhasil install dan start tanpa Metro; physical passkey belum diuji |
| Public integration | Context/book/RPC read-only berhasil, setelah satu timeout RPC pada percobaan awal |
| Users/sponsor/submission | Nol sesi pengguna; kartu bounty belum dikonfirmasi; belum submission/outreach |

Evidence final APK/emulator akan diperbarui setelah pemeriksaan selesai. [Screenshot awal](../artifacts/screenshots/account-first.png) merupakan real emulator UI, bukan image mockup.

## Gate yang belum selesai

User mengonfirmasi belum mempunyai domain/rpId dan whitelist Perpl. Login/enrollment pada build default tetap disabled sampai stable owned HTTPS host/cert association dan vendor-confirmed enrollment schema siap. Tidak memakai domain sponsor atau header palsu sebagai substitusi.

Pengujian physical Android PRF, clear-data identity restore, biometric SecureStore, funding/account/forwarding, authenticated request-target, real entry/stop/close, API-expiry trigger survival, recycle charge/refund, partial fills dan live recovery belum dilakukan. Error/partial traces yang diuji secara synthetic tidak diubah menjadi klaim actual trading. Penyelesaian unknown setelah venue failure masih konservatif; tidak ada automatic replacement/retry dari missing history.

Full P0 dan kesiapan submission belum selesai. Public market + planning + latihan/native preview merupakan hasil yang dapat direview sekarang. Domain/vendor/device gates tetap membutuhkan bukti sebelum live features atau sponsor fit diklaim.

Instruksi konkret: [RUNBOOK](RUNBOOK.md). Alasan scope/reliability: [PRD](PRD.md), [test plan](TEST_PLAN.md), [audit](metropolis-adversarial-review.md). Tidak ada mainnet write, user outreach, pembelian cloud/domain, atau claim hadiah/traction.
