# Tready

Android app untuk merencanakan trade Perpl dalam budget AUSD, memeriksa hasil eksekusi, dan memulihkan status yang bermasalah. Dibangun untuk Monad Metropolis Track01 dengan Expo, Mera, viem, Perpl, BigInt, SQLite dan SecureStore.

**Status: APK native preview dan host HTTPS tersedia; tiga celah audit diperbaiki dan dua siklus testnet selesai melalui Node, termasuk recovery tanpa entry pengganti. Native Mera onboarding/full P0 belum selesai.** Empat layar tersedia. Public configuration/book/RPC memakai Monad Testnet asli. Fill/stop/close latihan selalu berlabel synthetic; actual trade1lot melalui Node dibuktikan terpisah; belum ada pengujian pengguna eksternal.

Panduan penuntasan dan langkah founder: [CLOSEOUT_GUIDE](docs/CLOSEOUT_GUIDE.md). Build0.1.3 menampilkan alamat wallet lengkap untuk faucet dan memberi waktu300detik untuk prompt/provider passkey. [Halaman bukti](https://tready-archzxy.netlify.app/proof.html) memeriksa tiga receipt trade Node melalui RPC live; bukan bukti trading dari APK.

## Jalankan dan uji

Baseline lokal: Node24.21.0, pnpm11.28.5, JDK17, Android SDK36. Linux x86_64 bootstrap tidak mengubah Node/JDK sistem dan menyimpan tooling lokal di `.tooling/`.

```bash
chmod +x scripts/*.sh
./scripts/bootstrap-linux.sh
./scripts/dev.sh pnpm check
./scripts/dev.sh pnpm probe
TREADY_RP_ID=tready-archzxy.netlify.app TREADY_ORIGIN=https://tready-archzxy.netlify.app ./scripts/build-android.sh
```

Preview build memuat JS bundle dan memakai private signing certificate lokal yang stabil. Output APK/checksum/certificate di `artifacts/`; secret signing tidak masuk Git. Untuk development, gunakan `./scripts/dev.sh pnpm start` dan native app dari `pnpm android`. Native passkey tidak diuji lewat Expo Go.

[Download APK Android preview](https://tready-archzxy.netlify.app/downloads/tready-0.1.4-preview.zip), ZIP sekitar24MiB berisi APK sekitar52MiB; ekstrak sebelum install. Android API24+ dan CPU arm64-v8a/x86_64. [Release metadata](artifacts/release.json) memuat SHA256, commit source aplikasi, RP ID dan status gate enrollment yang dibaca dari APK; minimum install tidak membuktikan kompatibilitas passkey provider pada HP nyata.

**Alur review:** pilih Latihan → Plan → review sizing → entry latihan → Trade → stop → close → Receipt. Harga berasal dari market testnet; collateral100AUSD dan fills latihan merupakan simulasi. Bila market unavailable, UI memperlihatkan loading/stale, tanpa mengganti dengan quote fixture.

## Integrasi Monad

Tready berjalan pada **Monad Testnet, chain 10143**, lewat RPC `https://testnet-rpc.monad.xyz`. Perpl adalah venue perpetual yang berdiri di atas Monad; Tready tidak meng-deploy kontrak sendiri, melainkan membaca kontrak venue dan mengirim transaksi owner ke Monad.

| Nilai | Address |
|---|---|
| Exchange (instance 12, market BTC 16) | `0x1964c32f0be608e7d29302aff5e61268e72080cc` |
| Collateral AUSD (6 desimal) | `0xa9012a055bd4e0edff8ce09f960291c09d5322dc` |
| Faucet AUSD | `0xd236c18d274e54faccc3dd9dda4b27965a73ee6c` |

Kontrak dibaca ulang dari `/v1/pub/context` pada setiap run, lalu dicocokkan dengan konstanta di `packages/perpl/config.ts`; ketidakcocokan menghasilkan `DEPLOYMENT_REVIEW_REQUIRED` alih-alih dilanjutkan.

**Kenapa Monad dipakai:** saldo, akun, collateral dan hasil order berasal dari state on-chain, sehingga receipt dapat diverifikasi ulang lewat `eth_getTransactionReceipt` tanpa mempercayai klaim aplikasi. Tiga transaksi aktual dari siklus testnet:

| Aksi | Tx | Block |
|---|---|---|
| Entry 1 lot (request 1) | [`0x976e8d7e…d5f45`](https://testnet.monadscan.com/tx/0x976e8d7eb4b636ff03d711a43fb1974b3a99260d7085f64d9982f679891d5f45) | 70411403 |
| Stop penuh terdaftar (request 2) | [`0xf487ae37…e35f8`](https://testnet.monadscan.com/tx/0xf487ae371a61b5ff5823e786ffdf2d5672af4873a1b48009609c56bd32ee35f8) | 70411406 |
| Close 1 lot (request 3) | [`0x9a076e33…a5596`](https://testnet.monadscan.com/tx/0x9a076e339b6145aeb20591e0cbaf3e82f4734e119a47249016d0d8e47fea5596) | 70411409 |

Bukti penuh: [chain receipts](artifacts/remediation/trade-evidence.json) dan [halaman verifikasi RPC live](https://tready-archzxy.netlify.app/proof.html). Transaksi tersebut dihasilkan lewat **adapter Node**, bukan dari APK — perbedaan ini dinyatakan eksplisit. **Tidak ada deployment atau write ke mainnet.**

## Arsitektur

```text
packages/domain     pure: BigInt risk/money, plan approval, receipt facts (tanpa I/O)
packages/perpl      transport: codec uint64 lossless, Ed25519 auth, REST/WS, config, inventory reducer
packages/execution  coordinator + durable journal (SQLite) untuk entry/stop/close/cancel
packages/wallet     Mera passkey → wallet derivation (PRF)
apps/android        Expo/RN: Account, Plan, Trade, Receipt + SecureStore API secret
```

Aliran data: book/config publik → `domain` menghitung sizing → plan di-approve dengan digest → `execution` mengirim lewat WS dengan journal yang tahan process death → snapshot venue kembali ke `inventory` → `domain` menghasilkan receipt. Kegagalan berakhir sebagai status `unknown` tanpa automatic replacement. Detail dan keputusan: [technical spec](docs/TECHNICAL_SPEC.md).

Preview memakai RP ID `tready-archzxy.netlify.app` pada site Netlify terpisah di akun founder. [Association APK](https://tready-archzxy.netlify.app/.well-known/assetlinks.json) tersedia melalui HTTPS; deployment website `archzxy.com` tetap sama dan DNS tidak diubah. `auth.archzxy.com` belum aktif. Native PRF create dan same-wallet restore setelah restart sudah terverifikasi pada APK build6; clear-data restore serta pembacaan saldo wallet baru lulus pada build7 dengan KeePassDXFree4.5.2 di emulator API36; [laporan](artifacts/completion/native-prf.json) memisahkan hasil ini dari hardware biometrics dan provider cloud sync. Programmatic enrollment tetap disabled: Origin aplikasi ditolak HTTP 400 oleh Perpl pada tiga request Origin app dalam enam request total, sedangkan schema EIP-712 kini terbaca langsung dari payload vendor dan tercatat di [RUNBOOK](docs/RUNBOOK.md). Tidak mengisi key di `.env` atau mengirim secret melalui chat. Konfigurasi rebuild, signing, setup account dan recovery ada di [RUNBOOK](docs/RUNBOOK.md).

## Bukti dan batas implementasi

- [Status terbaru](docs/IMPLEMENTATION_STATUS.md): apa yang dibangun, apa yang diuji, dan gate yang belum selesai.
- [Core tests](artifacts/completion/core-tests.json): 72offline/synthetic tests; money precision, risk assumptions, authorization, duplicate-entry, failure/late-success, receipt semantics dan empty-policy/native-error regressions.
- [Browser passkey](artifacts/passkey-browser-smoke.json): delapan checks memakai Mera dan production derivation melalui WebAuthn virtual PRF; create/restore/sign/lock, wrong RP dan missing PRF.
- [Native passkey probe](artifacts/native-passkey-probe.json): provider prompt dan cancellation nyata di emulator, wallet tetap terkunci dan enrollment disabled; probe cancellation tidak menghasilkan credential. Native PRF create/restore dibuktikan terpisah dalam [laporan native PRF](artifacts/completion/native-prf.json).
- [Public integration probe](artifacts/integration-probe.json): real unsigned context/book/RPC reads; tidak ada wallet signing, enrollment atau trade.
- [Authenticated transport probe](artifacts/key-spike.json) dan [ws-spike](artifacts/ws-spike.json): REST ter-otomasi `/v1/trading/wallet|orders|positions` dan sign-in WebSocket mt:29 diterima dengan API key testnet yang dibuat pengguna melalui UI venue. Read-only, tanpa pengiriman order, token dan secret tidak masuk artifact.
- [Enrollment/origin probe](artifacts/enroll-spike.json) dan [enroll-e2e](artifacts/enroll-e2e.json): origin aplikasi ditolak 400 pada tiga request Origin app dalam enam request total, schema EIP-712 vendor terekam, enroll menghasilkan 404 *target profile not found* pada wallet tanpa akun Perpl. Nol API key dibuat.
- [Laporan emulator](artifacts/emulator-smoke.json): tujuh pemeriksaan UI/restart pada APK final, tanpa Metro; [Account](artifacts/screenshots/account-360dp.png), [stop latihan](artifacts/screenshots/trade-protected-360dp.png), [Receipt](artifacts/screenshots/receipt-360dp.png). Emulator tidak membuktikan physical-device PRF support.

Hardware biometric/provider cloud sync, test funding/account creation, entry/stop/close melalui APK, recycle charging/refund, API-expiry trigger lifecycle dan full financial reconciliation masih membutuhkan provider/vendor integration. Signed request-target kini diverifikasi: target `/v1/trading/wallet|orders|positions` diterima REST dan WebSocket oleh `https://testnet.perpl.xyz/api` dengan signature Ed25519. Emulator dengan PRF-capable provider dapat dipakai; browser virtual-authenticator proof tidak menguji hardware atau provider sync. Mainnet writes tidak tersedia. Submission, outreach, customer sessions dan konfirmasi bounty belum dilakukan.

## Spesifikasi dan riset

| Dokumen | Isi |
|---|---|
| [PRD](docs/PRD.md) | Masalah, empat layar, 36 requirement, scope P0/P1/P2 dan sponsor gates |
| [Technical spec](docs/TECHNICAL_SPEC.md) | Stack, wallet/API keys, risk math, journal, recovery dan receipt |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | 25 backlog items, dependency, build dan submission |
| [Test plan](docs/TEST_PLAN.md) | 42 planned scenarios; actual status dipisahkan dari target |
| [Adversarial review](docs/metropolis-adversarial-review.md) | Pembanding dan alasan ide awal bisa kalah |
| [Source ledger](docs/metropolis-sources.json) | Primary sources, observations dan unresolved questions |
| [Offline research](research/README.md) | Python Decimal baseline, 360 sizing combinations; bukan backtest/profit proof |

Source Tready berlisensi [MIT](LICENSE). **AI disclosure:** riset, spesifikasi, kode aplikasi dan test dikembangkan bersama OpenAI Codex; penggunaan AI coding tools dilaporkan sesuai [Rules v3 §4.1](https://hackathon.monad.xyz/api/v1/policies/current). Hasil verifikasi dan kebutuhan integrasi yang belum selesai dilaporkan terpisah, dan kode hasil generasi tidak disajikan sebagai pengujian device atau live-trading yang sudah selesai. Atribusi kode pihak ketiga ada di [NOTICE](third-party/NOTICE.md). Keunggulan UX, demand, sponsor eligibility dan hasil kompetisi belum dibuktikan oleh keberadaan code atau test count.

Audit dan perbaikan terbaru: [laporan audit](docs/IMPLEMENTATION_AUDIT_2026-10-12.md), [remediation](docs/REMEDIATION_2026-10-12.md), [72core tests](artifacts/completion/core-tests.json), [actual testnet trade](artifacts/remediation/trade-smoke.json). Key/signing material lokal tidak dipublikasikan.

[Release0.1.4](https://github.com/haikarure/tready/releases/tag/v0.1.4) · [Demo129detik](https://tready-archzxy.netlify.app/downloads/tready-preview-demo.mp4) · [Chain receipts](artifacts/remediation/trade-evidence.json) · [Actual disconnect recovery](artifacts/remediation/recovery-smoke.json). CI remote tidak memulai job karena account billing lock; checks lokal tercatat.
