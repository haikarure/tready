# Menjalankan Tready Android

Ini petunjuk implementasi yang ada di repository. Status bukti terbaru dicatat di [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md); seluruh acceptance criteria PRD belum otomatis selesai.

## Core dan aplikasi

Node24.21.0, pnpm11.28.5, JDK17 dan Android SDK36 adalah baseline build lokal. Install memakai exact lockfile. `scripts/dev.sh` memakai toolchain lokal bila tersedia dan mempertahankan konfigurasi JDK/SDK eksternal bila tidak ada toolchain lokal.

```bash
chmod +x scripts/*.sh
./scripts/bootstrap-linux.sh
./scripts/dev.sh pnpm check
./scripts/dev.sh pnpm probe
./scripts/dev.sh pnpm start
```

Bootstrap disediakan untuk Linux x86_64, memerlukan Python3/curl/tar dan JDK17. Tidak menginstal JDK secara global. Platform lain dapat menyiapkan baseline toolchain sendiri. Dependency Mera published0.2.0 memakai native passkey3.6.1; perbedaan dengan repository upstream main tidak ditutupi dengan peer override.

Development device membutuhkan native app (`pnpm android`) dengan Metro; Expo Go tidak dipakai sebagai bukti passkey native. Preview APK mempunyai bundled JS dan tidak memerlukan Metro. Mainnet writes tidak tersedia pada aplikasi ini.

## APK mandiri dan signing

```bash
./scripts/build-android.sh
```

Script membuat preview certificate unik sekali di `.tooling/keys/`, lalu memakai certificate yang sama pada rebuild. File key/password bersifat lokal, diabaikan Git dan tidak masuk `.env`, log, hosting atau source repo. Simpan backup pribadi bila APK akan diperbarui pada perangkat yang menyimpan data. Mengganti certificate dapat memerlukan uninstall serta perubahan assetlinks; uninstall menghilangkan journal lokal.

Output: `artifacts/tready-0.1.0-preview.apk`, `artifacts/release.json` (checksum/cert/network), dan `apps/access/public/.well-known/assetlinks.json`. APK mengandung ABI arm64-v8a dan x86_64, minimum install Android API24; belum ada klaim dukungan Android32bit. Minimum install berbeda dari kompatibilitas PRF/passkey provider. Ini preview lokal, bukan Play Store production release atau account recovery test.

Jika mencoba lewat ADB, pilih serial perangkat sendiri agar tidak memasang ke perangkat lain:

```bash
adb devices
adb -s YOUR_SERIAL install -r artifacts/tready-0.1.0-preview.apk
```

## Domain/passkey dan enrollment yang belum siap

Update12Oktober: founder memiliki `archzxy.com` dan mengonfirmasi hosting Netlify. Pemeriksaan publik menunjukkan root HTTPS200, nameserver `launch1.spaceship.net`/`launch2.spaceship.net`, assetlinks root404, dan kandidat `auth.archzxy.com` belum mempunyai DNS. Ownership berdasarkan konfirmasi founder; akses akun hosting/DNS belum tersedia di workspace.

Kandidat host passkey adalah `auth.archzxy.com`. Paket [tready-passkey-host.zip](../artifacts/tready-passkey-host.zip) memuat file public dari `apps/access/public`, termasuk direktori `.well-known` dan header JSON untuk Netlify. Paket tidak memuat APK atau private signing key. Untuk manual deploy, ekstrak paket dan upload folder hasil ekstraksi melalui Netlify Drop; pastikan `.well-known/assetlinks.json` ikut ter-upload.

Tambahkan `auth.archzxy.com` sebagai custom domain pada site Netlify tersebut. Di DNS Spaceship, buat CNAME host `auth` menuju hostname site yang diberikan Netlify (`NAMA-SITE.netlify.app`, bukan placeholder ini). Tunggu DNS/TLS aktif, kemudian periksa URL assetlinks langsung: HTTPS200, JSON, tidak redirect, package/certificate cocok. Instruksi mengikuti [Netlify external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/). Belum ada deployment atau DNS mutation yang dilakukan.

Setelah association berhasil, config build yang direncanakan adalah `TREADY_RP_ID=auth.archzxy.com` dan `TREADY_ORIGIN=https://auth.archzxy.com`. Origin Perpl tetap perlu whitelist vendor dan schema enrollment. APK preview yang sudah dibagikan masih tanpa rpId; belum rebuild untuk domain tersebut.

1. Pilih hostname HTTPS yang dikuasai tim. Publish assetlinks pada `https://HOST/.well-known/assetlinks.json` dengan JSON MIME, tanpa redirect/auth gate. Certificate harus cocok dengan APK yang benar-benar dipasang. RP ID adalah hostname, bukan URL dengan path. Jangan memakai domain Mera/peserta lain.
2. Isi build config `TREADY_RP_ID` dan `TREADY_ORIGIN=https://HOST`; keduanya public metadata. Tempatkan dalam environment build atau file `.env` lokal pada `apps/android/`. Rebuild APK sebelum membuat credential. Domain adalah bagian dari identitas derivation yang dibekukan.
3. Perpl harus mengizinkan Origin untuk `/api-key/payload` dan `/api-key/enroll`. Mengubah header/relay tidak memberikan whitelist. Draft pertanyaan vendor tersedia di [implementation plan](IMPLEMENTATION_PLAN.md); belum dikirim.
4. Pin schema payload EIP-712 yang dikonfirmasi vendor ke `TREADY_ENROLLMENT_POLICY_JSON`. Objek memuat `domainName`, `domainVersion`, `verifyingContract`, `primaryType`, serta nama field `addressField`, `publicKeyField`, `scopeField`, `expiryField`. Belum ada verified fixture vendor untuk mengisi nilai-nilai itu. Adapter yang memerlukan perubahan schema/domain harus diperbaiki dan diuji; jangan menebak nilai agar signing lolos.
5. Uji create dan existing passkey pada Android dengan PRF-capable credential provider, termasuk clear-data restore, cancellation dan lock. [Mera mendukung device atau emulator yang providernya mendukung PRF](https://github.com/category-labs/mera/blob/main/demos/mobile/README.md). Emulator UI test yang sudah dilakukan belum membuktikan PRF; kompatibilitas perangkat asli dicatat terpisah.
6. Lakukan test funding/account/forwarding/enrollment/read di device, tangkap sanitized payload. Verifikasi signed target `/v1/...` terhadap endpoint `/api/v1/...`, account balance, recycle charge/refund, trigger lifecycle/expiry dan financial event semantics sebelum menganggap P0 selesai.

Build tanpa konfigurasi tersebut sengaja menonaktifkan onboarding/trading live. Public market/testnet reads dan latihan tersedia. Tidak ada token/API secret yang harus dikirim lewat chat atau dimasukkan ke build config; API key nantinya dibuat client dan disimpan pada device-authenticated SecureStore.

## Alur latihan yang bisa direview

Account → pilih **Latihan** → Plan (data market testnet, collateral sintetis100AUSD) → atur budget/stop → review → entry latihan → Trade → pasang stop latihan → close latihan → Receipt. Setiap fill/stop/close latihan merupakan hasil sintetis. Latihan tidak memanggil signer atau transport trading.

Data market publik yang tak tersedia menghasilkan loading/stale/error. Tidak diganti diam-diam dengan harga fixture. Harga tersimpan dalam riset bukan quote baru. Funding reserve dan recycle reserve merupakan asumsi model; tidak menjadi promise biaya/kerugian actual.

## Recovery dan bukti

Restart memindahkan request in-flight ke unknown; aplikasi tidak mengirimnya ulang. Recheck memuat venue snapshots/history dengan pagination. Request yang tidak ditemukan tetap unresolved, termasuk ketika open-orders kosong. Gateway ack0 berarti forwarded. Registration outcome dedup terpisah dari inventory trigger waiting/triggered/executed.

Sesudah outcome material, aplikasi menghentikan stream lama, memeriksa snapshot block terhadap outcome, lalu membuka epoch baru agar queued events lama tidak menimpa state baru. Close IOC yang tidak penuh menampilkan remaining position. Clear-data menghilangkan original plan/journal; passkey restore tidak mengklaim memulihkan intent lokal atau API key yang hilang.

Secrets tidak disimpan di SQLite, receipt, `.env` atau CI. Config dan snapshot hanyalah public metadata. Receipt finansial full history/settlement tetap membutuhkan authenticated fixture/live verification; jangan menghitung data yang belum diterima sebagai nol atau double-subtract biaya dari net account stats.

## Distribusi dan submission

Folder `apps/access/public` siap untuk host static HTTPS; domain induk dikonfirmasi founder, tetapi host passkey belum deployed/associated. Menghosting HTML saja tidak memberi eligibility Agora atau whitelist Perpl. Public repo, APK, actual Monad trade evidence, qualified users dan video≤3menit merupakan deliverable berbeda. Submission belum dikirim, outreach belum dilakukan, sponsor cards terkini belum dikonfirmasi.

Lisensi source Tready: [MIT](../LICENSE). [Attribution/disclosure](../third-party/NOTICE.md). Rules dan spesifikasi lengkap tersedia di [PRD](PRD.md).
