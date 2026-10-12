# Tready — rencana pengujian dan bukti rilis

Versi 0.1 · 11 Oktober 2026. Mengacu ke [PRD](PRD.md) dan [spesifikasi teknis](TECHNICAL_SPEC.md). Daftar ini adalah pengujian yang harus dilakukan saat implementasi, bukan laporan bahwa seluruhnya sudah lulus.

Baseline status di bawah dibuat saat PRD. Hasil execution terbaru dipisahkan dalam [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [core test report](../artifacts/core-tests.json), dan bukti emulator. Unit/synthetic tests tidak menjadi bukti semua 42 skenario testnet/device telah lulus.

## 1. Baseline saat PRD dibuat

| Aktivitas | Hasil yang tersedia | Yang belum dibuktikan |
|---|---|---|
| Offline risk model | 360 kombinasi sizing, 27 sampel dalam batas skenario, negative controls berhasil | Risk engine TS/app belum dibuat; real settlement rounding/fees belum diuji |
| Public context | Mainnet/testnet HTTP 200, config tersimpan | Authenticated account/trading belum diuji |
| Read-only RPC | Chain, code Exchange/AUSD/faucet, token decimals 6 | Faucet claim/account creation/fill belum dilakukan |
| CORS/preflight | Respons lokal tercatat dengan keterbatasan | Enrollment whitelist/permission belum diuji |
| Native/device | User punya Android; docs/build baseline diteliti | APK compile, PRF provider, clear-data recovery belum diuji |
| Customer research | Protokol dan draft rekrut tersedia | Nol sesi/pengguna terverifikasi |

[Hasil numerik](../research/results.json), [probe](../research/prd/integration-probes.json). Tidak mengubah replay menjadi label live atau jumlah test numerik menjadi jumlah integration tests.

## 2. Lingkungan dan batas test

Unit/core tests tidak menggunakan key, account, RPC write atau network. Mock traces menyimulasikan transport lokal dengan label synthetic. Integration tests memakai dedicated Mera account pada chain 10143, token uji, dan command yang diotorisasi saat pelaksanaan. Test suite default tidak pernah mengeksekusi mainnet transaction.

Simpan fixture sanitized yang mencakup chain, instance, schema/config version, source, fetched/received time, dan real/synthetic classification. Jangan menyimpan API secret/token, enrollment signatures, PRF, seed, atau private key di fixture. Test nonce/auth menggunakan synthetic keys yang tidak pernah diberi dana atau capability live.

Native passkey dapat diuji pada Android device atau emulator yang mempunyai PRF-capable provider. Catat OS/provider, credential sync status, build certificate/profile, network, dan build commit. Browser virtual PRF membuktikan browser/Mera/derivation; native emulator membuktikan hanya kombinasi provider/build yang dijalankan. Keduanya tidak membuktikan hardware biometrics atau provider sync pada HP founder. Tidak perlu membeli device untuk menyatakan dukungan yang belum diuji.

## 3. Test case matrix

Status seluruh kasus di bawah **planned**, kecuali baseline Python pada TC-09 yang sudah mempunyai output tersendiri. P0 adalah release gate; P1/P2 adalah test saat fitur terkait dibangun.

| Case | Requirement | Level | Skenario | Hasil yang wajib terlihat |
|---|---|---|---|---|
| TC-01 | TR-01, TR-02 | Core/integration | RPC chain berbeda; token/market/instance salah | Writes mati, alasan mismatch; tidak pindah endpoint diam-diam |
| TC-02 | TR-01, TR-02 | Integration | Resolve “BTC Perp”, market16/instance12 vs mainnet1 | Binding benar; tidak bergantung exact display name |
| TC-03 | TR-03 | UI/core | Masuk replay atau data offline | Label mode terlihat; signer/send tidak dapat dipanggil |
| TC-04 | TR-04, TR-06 | Android | Create, lock, existing-passkey login | Wallet/derivation sama; certificate/domain cocok |
| TC-05 | TR-05 | Android | PRF unsupported, user cancel, missing output | State capability/cancel jelas; tidak membuat wallet random |
| TC-06 | TR-07, TR-27 | Android | Lock/background/expiry saat signer tersedia | Key/session tidak lagi menandatangani; writes menunggu unlock+sync |
| TC-07 | TR-08 | Android/integration | Clear data ketika flat; recover credential existing | Wallet/account sama; local plan ditandai unavailable |
| TC-08 | TR-08, TR-24 | Android/integration | Clear data/reinstall dengan posisi aktif | Actual position/trigger pulih; tidak ada replacement entry otomatis |
| TC-09 | TR-13, TR-14 | Core | Grid long/short, tight/wide stop, budgets/reserves, rounding | Quantity maksimum dari risk memenuhi budget dan satu lot tambahan gagal; quantity final yang lebih kecil menjelaskan binding constraint collateral/market; compare Python baseline dengan unit conversion baru |
| TC-10 | TR-13, TR-14 | Core/UI | Zero/negative/ambiguous input, stop salah arah, reserve≥budget | Alasan spesifik; confirm disabled; quantity tidak dipaksakan min lot |
| TC-11 | TR-14, TR-28 | Core | Integers di sekitar/di atas 2^53; signed funding; fraction entry | Tidak ada silent precision loss atau overflow; unsupported wire number menahan writes |
| TC-12 | TR-15, TR-16 | Core/integration | Fee tier berubah, recycle nonzero/refund, funding reserve habis | Quote invalid/review baru; actual charge dan reserve dipisahkan |
| TC-13 | TR-16 | Core/UI | Exit di luar stress assumption; liq boundary sebelum stop | Model menjelaskan breach; tidak ada hard-cap copy; invalid headroom ditolak |
| TC-14 | TR-17 | Core | Order melebihi depth teramati; book level removal/gap | Full VWAP unknown; resubscribe/snapshot; tidak menganggap tail kosong |
| TC-15 | TR-17, TR-19 | UI/core | Quote lewat TTL atau parameter material berubah saat review | Confirmation lama tidak bisa mengirim command baru |
| TC-16 | TR-09, TR-10 | Testnet | Gas nol, faucet fail/timeout, token salah, allowance kurang | Balance/receipt actual; tidak lanjut setup sebelum syarat terpenuhi |
| TC-17 | TR-10 | Testnet | Create account/forwarding pending dan app restart | Resume langkah dari state chain; tidak double-create atau success palsu |
| TC-18 | TR-11 | Auth/integration | Whitelist absent, expiry/clock skew, wrong scope | Error tepat; tidak brute-force origin/key; read-only key tidak dipakai trade |
| TC-19 | TR-11 | Auth/mock | Enrollment 409/423, expired stored secret | Reuse/recovery yang sah; tidak loop create; key limit terlihat |
| TC-20 | TR-12 | Testnet | Withdraw saat pending/active; withdraw flat; revert/rate-limit | Active/pending diblokir; flat success memiliki receipt dan delta wallet |
| TC-21 | TR-18 | Core/integration | Existing order/position di market lain, frozen, forwarding off, unknown snapshot | Entry berhenti; actual account state tidak disembunyikan |
| TC-22 | TR-19, TR-20 | Coordinator | Double tap, storage insert failure, dua command bersamaan | Satu intent/send; journal failure tidak mengirim order |
| TC-23 | TR-20, TR-24 | Trace/Android | Crash setelah journal commit sebelum send | Command dipulihkan sebagai unresolved/prepared; tidak send tanpa recheck/consent |
| TC-24 | TR-20, TR-24 | Trace/Android | Crash setelah send sebelum ack | Reconcile original; tidak new-rq duplicate entry |
| TC-25 | TR-21 | Trace/testnet | Ack success, delayed fill, definitive reject | Pending sampai outcome venue; rejected tidak menjadi posisi |
| TC-26 | TR-21, TR-23 | Trace/testnet | IOC zero fill / partial / full | Actual filled qty; remainder tidak dikirim ulang otomatis |
| TC-27 | TR-22, TR-26 | Trace/testnet | Entry filled, stop registration rejects/missing | Exposure dan protection pending/missing terlihat; tindakan recovery tersedia |
| TC-28 | TR-22, TR-24 | Trace/testnet | Trigger waiting→triggered→executed, duplicate registration outcome | Request dedup tidak menghentikan live inventory updates |
| TC-29 | TR-22, TR-25 | Testnet/exploratory | API key expires/revokes setelah stop diterima | Catat survival/cancellation actual; tidak mengklaim behavior sebelum diuji |
| TC-30 | TR-24 | Trace | No outcome sebelum expiry, stream continuous vs reconnect | Retry policy berbeda; original rq untuk kondisi yang sah; unknown setelah gap tetap blocked |
| TC-31 | TR-24 | Trace | Failure/timeout lalu late success; sr32 dengan unresolved original | Exposure tetap diproses; tidak replacement entry dari error semata |
| TC-32 | TR-24 | Trace/integration | History pagination belum mencapai request; open order kosong | Absence belum dianggap no-fill; unknown/incomplete tetap terlihat |
| TC-33 | TR-25 | Trace/testnet | Close full, partial, failed, unknown; repeated tap | Remaining actual; no accidental inversion; no blind new close |
| TC-34 | TR-26 | Trace/testnet | Stop/cancel race, position closed/inverted dari klien lain | Refresh binding/quantity; stale protection tidak dianggap aktif untuk posisi baru |
| TC-35 | TR-27 | Android | Force-stop/airplane mode/resume ketika active | Tidak background-send; fresh snapshots sebelum tindakan; exposure tetap terlihat |
| TC-36 | TR-28 | Core/integration | Entry/exit fee, funding, partial close, net stats, same-log multiple events | Tidak double-count; missing data bukan nol; provenance dan completeness benar |
| TC-37 | TR-29, TR-30 | Android/UI | Long number, 360dp, font besar, keyboard, colors, error text | Tindakan tetap terlihat; label status tidak hanya warna; no layout obstruction |
| TC-38 | TR-31 | Android | Install preview/release APK baru tanpa Metro/cache lama | App start dan native PRF bekerja; certificate association benar |
| TC-39 | TR-07, TR-32 | Core/build review | Inspect SQLite/log/fixture/build metadata | Tidak ada live secret/PRF/signature/token; logs allowlist |
| TC-40 | TR-33 | Documentation/judge rehearsal | Orang lain mengikuti README dan memeriksa demo | Reproducible instructions; actual chain evidence; video≤3menit |
| TC-41 | TR-34, TR-35 | P1 | Plan export/import dan account export | No secret in receipt; import tidak memberi consent; export key ceremony terpisah |
| TC-42 | TR-36 | P2 | Monitoring service outage, expiry, recovery | Always-on claim berdasarkan availability dan authority yang benar |

Partial fill/expiry/error yang tidak berhasil direproduksi secara wajar pada live testnet tetap memakai synthetic trace dengan label. Jangan membuat volume palsu untuk mengisi metrics. Happy path actual testnet wajib berdiri sendiri; replay tidak menggantikannya.

## 4. Urutan eksekusi test saat build

1. Risk units/rounding dan parsers → coordinator trace invariants → persistence crash recovery.
2. Android native build + PRF/domain association sebelum seluruh screen dibangun.
3. Owner funding/account/forwarding → API enrollment/auth reads → small testnet entry/stop/close.
4. Native lock/resume/force-stop/reinstall; uji remaining exposure dan unknown state.
5. UI accessibility dan qualified user tasks; perbaiki temuan material.
6. APK baru tanpa Metro, README fresh-run, video/evidence, lalu freeze release.

Jangan mengulang semua test hanya karena ingin menambah jumlah check. Ulangi area terdampak ketika code/config/dependency berubah, error muncul, atau ada concern yang belum selesai. Baseline Python bukan alasan melewatkan finance conversion pada TypeScript/Android.

## 5. Lima sesi pengguna

Sebelum demo, minta pengalaman terakhir yang relevan. Peserta qualified harus memahami perp/stop dan menunjukkan kebutuhan yang dapat dibahas. User diminta menyelesaikan sizing, mengartikan stress, menemukan status pending, dan menjelaskan remaining quantity. Hindari pertanyaan yang hanya mengundang pujian.

Simpan hasil actual per tugas: selesai/tidak, bantuan, waktu, salah interpretasi, pemahaman budget, niat kembali beserta tindakan. Gate internal PRD: 3/5 pain relevan, 4/5 memahami budget dan menyelesaikan alur tanpa bantuan besar, 2/5 mencoba ulang. N kecil, bukan product-market fit. Nol sesi harus tetap dilaporkan nol.

## 6. Format evidence dan release gate

Untuk setiap case simpan: case ID, requirement ID, build commit/config digest, real/synthetic, timestamp/network/device, steps, expected, observed, pass/fail/blocked, defect link dan artifact. Testnet chain evidence memuat address/account/request/position dan tx hash bila tersedia; screenshot tidak menggantikan provenance.

P0 release berhenti jika: ada salah network/token, secret leak, budget model tidak sesuai input, false-success status, duplicate-entry path, remaining exposure tersembunyi, signer bisa dipanggil dari replay, atau native happy path tidak beroperasi. Bug polish dapat menjadi known limitation dengan dampak jelas; bug terkait uang/state tidak ditutup dengan video yang menghindarinya.

P0 feature yang tidak selesai harus dihapus dari claim/demo dan dibahas sebagai scope reduction, bukan tetap dicentang. Sponsor gate terpisah dari test pass. Dokumen evidence baru dibuat saat actual execution; PRD ini tidak memuat fabricated transaction hash atau customer result.
