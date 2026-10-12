# Tready

Android app untuk merencanakan trade Perpl dalam budget AUSD, memeriksa hasil eksekusi, dan memulihkan status yang bermasalah. Dibangun untuk Monad Metropolis Track01 dengan Expo, Mera, viem, Perpl, BigInt, SQLite dan SecureStore.

**Status: APK native preview dan host HTTPS tersedia; full P0/live trading belum selesai.** Empat layar tersedia. Public configuration/book/RPC memakai Monad Testnet asli. Fill/stop/close latihan selalu berlabel synthetic; tidak ada real order atau pengguna eksternal yang diklaim.

## Jalankan dan uji

Baseline lokal: Node24.21.0, pnpm11.28.5, JDK17, Android SDK36. Linux x86_64 bootstrap tidak mengubah Node/JDK sistem dan menyimpan tooling lokal di `.tooling/`.

```bash
chmod +x scripts/*.sh
./scripts/bootstrap-linux.sh
./scripts/dev.sh pnpm check
./scripts/dev.sh pnpm probe
./scripts/build-android.sh
```

Preview build memuat JS bundle dan memakai private signing certificate lokal yang stabil. Output APK/checksum/certificate di `artifacts/`; secret signing tidak masuk Git. Untuk development, gunakan `./scripts/dev.sh pnpm start` dan native app dari `pnpm android`. Native passkey tidak diuji lewat Expo Go.

[Download APK Android preview](https://tready-archzxy.netlify.app/downloads/tready-0.1.0-preview.apk), sekitar52MiB, Android API24+ dan CPU arm64-v8a/x86_64. [Release metadata](artifacts/release.json) memuat SHA256, commit source aplikasi, RP ID dan status gate enrollment yang dibaca dari APK; minimum install tidak membuktikan kompatibilitas passkey provider pada HP nyata.

**Alur review:** pilih Latihan → Plan → review sizing → entry latihan → Trade → stop → close → Receipt. Harga berasal dari market testnet; collateral100AUSD dan fills latihan merupakan simulasi. Bila market unavailable, UI memperlihatkan loading/stale, tanpa mengganti dengan quote fixture.

Preview memakai RP ID `tready-archzxy.netlify.app` pada site Netlify terpisah di akun founder. [Association APK](https://tready-archzxy.netlify.app/.well-known/assetlinks.json) tersedia melalui HTTPS; deployment website `archzxy.com` tetap sama dan DNS tidak diubah. `auth.archzxy.com` belum aktif. Passkey control sudah dikonfigurasi, tetapi PRF native happy path belum terverifikasi. Programmatic enrollment tetap disabled: Origin whitelist serta schema EIP-712 Perpl memerlukan konfirmasi vendor. Tidak mengisi key di `.env` atau mengirim secret melalui chat. Konfigurasi rebuild, signing, setup account dan recovery ada di [RUNBOOK](docs/RUNBOOK.md).

## Bukti dan batas implementasi

- [Status terbaru](docs/IMPLEMENTATION_STATUS.md): apa yang dibangun, apa yang diuji, dan gate yang belum selesai.
- [Core tests](artifacts/core-tests.json): 34offline/synthetic tests; money precision, risk assumptions, authorization, duplicate-entry, failure/late-success, receipt semantics dan empty-policy/native-error regressions.
- [Browser passkey](artifacts/passkey-browser-smoke.json): delapan checks memakai Mera dan production derivation melalui WebAuthn virtual PRF; create/restore/sign/lock, wrong RP dan missing PRF.
- [Native passkey probe](artifacts/native-passkey-probe.json): provider prompt dan cancellation nyata di emulator, wallet tetap terkunci dan enrollment disabled; tidak menghasilkan passkey/PRF native.
- [Public integration probe](artifacts/integration-probe.json): real unsigned context/book/RPC reads; tidak ada wallet signing, enrollment atau trade.
- [Laporan emulator](artifacts/emulator-smoke.json): tujuh pemeriksaan UI/restart pada APK final, tanpa Metro; [Account](artifacts/screenshots/account-360dp.png), [stop latihan](artifacts/screenshots/trade-protected-360dp.png), [Receipt](artifacts/screenshots/receipt-360dp.png). Emulator tidak membuktikan physical-device PRF support.

Native Android PRF/biometric/restore, test funding/account creation, signed request-target, actual entry/stop/close, recycle charging/refund, API-expiry trigger lifecycle dan full financial reconciliation masih membutuhkan provider/vendor integration. Emulator dengan PRF-capable provider dapat dipakai; browser virtual-authenticator proof tidak menguji hardware atau provider sync. Mainnet writes tidak tersedia. Submission, outreach, customer sessions dan konfirmasi bounty belum dilakukan.

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

Source Tready berlisensi [MIT](LICENSE). [Third-party attribution dan AI disclosure](third-party/NOTICE.md). Keunggulan UX, demand, sponsor eligibility dan hasil kompetisi belum dibuktikan oleh keberadaan code atau test count.
