# Menjalankan Tready Android

Ini petunjuk implementasi yang ada di repository. Status bukti terbaru dicatat di [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md); seluruh acceptance criteria PRD belum otomatis selesai.

Panduan penuntasan terbaru: [CLOSEOUT_GUIDE](CLOSEOUT_GUIDE.md). APK0.1.4/build7 menyediakan alamat lengkap yang dapat disalin dan waktu prompt passkey300detik. Native PRF create/restore dan clear-data recovery emulator sudah terbukti dalam laporan; funding/API/trading APK masih menjadi gate.

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
TREADY_RP_ID=tready-archzxy.netlify.app \
TREADY_ORIGIN=https://tready-archzxy.netlify.app \
./scripts/build-android.sh
```

Script membuat preview certificate unik sekali di `.tooling/keys/`, lalu memakai certificate yang sama pada rebuild. File key/password bersifat lokal, diabaikan Git dan tidak masuk `.env`, log, hosting atau source repo. Simpan backup pribadi bila APK akan diperbarui pada perangkat yang menyimpan data. Mengganti certificate dapat memerlukan uninstall serta perubahan assetlinks; uninstall menghilangkan journal lokal.

Output: `artifacts/tready-0.1.4-preview.apk`, `artifacts/release.json` (checksum/cert/network), dan `apps/access/public/.well-known/assetlinks.json`. Metadata dibaca dari config/manifest dan certificate di APK hasil build, bukan dari environment saat membuat laporan. Gradle juga mengawasi shared source `packages/` dan dependency root agar perubahan wallet/risk engine menginvalidasi JS bundle. APK mengandung ABI arm64-v8a dan x86_64, minimum install Android API24; belum ada klaim dukungan Android32bit. Minimum install berbeda dari kompatibilitas PRF/passkey provider. Ini preview; native PRF recovery diuji di emulator. Hardware biometrics/provider cloud sync dan Play Store release belum diuji.

Jika mencoba lewat ADB, pilih serial perangkat sendiri agar tidak memasang ke perangkat lain:

```bash
adb devices
adb -s YOUR_SERIAL install -r artifacts/tready-0.1.4-preview.apk
```

## Host passkey aktif dan enrollment

Update12Oktober: akses Netlify lokal berhasil diverifikasi. Site terpisah `tready-archzxy` sudah dipublikasikan pada [tready-archzxy.netlify.app](https://tready-archzxy.netlify.app). Host ini menjadi RP ID preview. [Assetlinks](https://tready-archzxy.netlify.app/.well-known/assetlinks.json) memberikan HTTPS200, JSON dan certificate/package APK yang cocok, tanpa redirect atau login gate. Bukti deployment tersedia di [netlify-host.json](../artifacts/netlify-host.json).

Deployment website `archzxy.com` diverifikasi tetap sama. Tidak ada perubahan DNS, apex, www atau nameserver. DNS induk dikelola Spaceship dan akses DNS belum tersedia. `auth.archzxy.com` tetap pilihan untuk masa depan; bukan hostname aktif dan tidak dibutuhkan untuk preview ini. Credential terikat RP ID: mengganti host setelah membuat passkey menghasilkan identitas berbeda dan memerlukan rencana migrasi/recovery, bukan perubahan config diam-diam.

Paket [tready-passkey-host.zip](../artifacts/tready-passkey-host.zip) adalah arsip host association sebelum penambahan download APK; tidak memuat APK atau private key. Netlify ZIP API mengabaikan direktori `.well-known` pada percobaan awal. File `assetlinks.json` di root dan `_redirects` kini melayani path `.well-known` melalui internal rewrite200, tanpa HTTP redirect. Release script menghasilkan kedua salinan JSON dari certificate APK yang diverifikasi agar tidak berbeda. Deploy preview lengkap perlu menyertakan APK dan metadata pada `/downloads/` seperti site aktif; arsip association saja tidak menyediakan download.

Build preview dengan konfigurasi host aktif:

```bash
TREADY_RP_ID=tready-archzxy.netlify.app \
TREADY_ORIGIN=https://tready-archzxy.netlify.app \
./scripts/build-android.sh
```

Host HTTPS dan native enrollment Perpl adalah gate berbeda. Whitelist Origin vendor **ternyata diperlukan dan sudah terukur**, bukan lagi dugaan: origin aplikasi `https://tready-archzxy.netlify.app` ditolak HTTP 400 pada tiga request Origin app `/v1/api-key/payload` dalam enam request total yang diselang-seling dengan dua Origin pembanding yang diterima 200. Schema enrollment kini terbaca dari payload vendor. `TREADY_ENROLLMENT_POLICY_JSON` tetap kosong karena origin belum di-whitelist, sehingga otorisasi API trading masih disabled.

1. Pilih hostname HTTPS yang dikuasai tim. Publish assetlinks pada `https://HOST/.well-known/assetlinks.json` dengan JSON MIME, tanpa redirect/auth gate. Certificate harus cocok dengan APK yang benar-benar dipasang. RP ID adalah hostname, bukan URL dengan path. Jangan memakai domain Mera/peserta lain.
2. Isi build config `TREADY_RP_ID` dan `TREADY_ORIGIN=https://HOST`; keduanya public metadata. Tempatkan dalam environment build atau file `.env` lokal pada `apps/android/`. Rebuild APK sebelum membuat credential. Domain adalah bagian dari identitas derivation yang dibekukan.
3. Perpl harus mengizinkan Origin untuk `/api-key/payload` dan `/api-key/enroll`. Mengubah header/relay tidak memberikan whitelist. Pengukuran 12 Oktober: origin aplikasi → 400, tanpa Origin → 200, `https://testnet.perpl.xyz` → 200. Dokumentasi vendor menyatakan Origin harus di-whitelist baik dari browser maupun server, sehingga permintaan whitelist tetap langkah yang benar; melewatkan header Origin melewati pemeriksaan yang didokumentasikan tanpa menyelesaikan gate lain (wallet tanpa akun Perpl tetap menerima 404 pada enroll). Draft pertanyaan vendor tersedia di [implementation plan](IMPLEMENTATION_PLAN.md); **belum dikirim**.
4. Pin schema lengkap dari challenge vendor yang diterima untuk Origin sendiri. [Template policy](../config/perpl-enrollment-policy.example.json) memuat graph field/type, domain dan statement non-builder. Primary fields berasal dari probe vendor; urutan domain fields harus dikonfirmasi dengan challenge yang sah sebelum gate diaktifkan. Policy lama yang hanya memuat nama field ditolak. Validator memeriksa Origin, label, statement, CIDRs kosong, builder terms nol, waktu challenge dan field/type lengkap sebelum signature. Salt dinamis tidak dipin sebagai nilai konstan. Build4 tetap tanpa policy aktif selama Origin belum diterima.
5. Jalur alternatif resmi: setelah key read/trade testnet untuk **wallet Mera yang sama** dibuat melalui venue, buka **Impor API key** di Account. Masukkan token dan secret API (bukan owner private key). App melakukan signed wallet read dan menolak wallet/instance yang berbeda sebelum menyimpan dalam SecureStore. Local expiry maksimal24jam; venue tetap menentukan izin trade dan expiry sebenarnya. Fitur ini tidak menyediakan koneksi wallet Mera ke UI venue, tidak memindahkan identitas ke wallet dari export, dan tidak membuktikan auto-enrollment/eligibility Agora. Key engineering yang ada sekarang berasal dari wallet lain dan tidak dapat dipaksakan menjadi identitas Mera.
6. Uji create dan existing passkey pada Android dengan PRF-capable credential provider, termasuk clear-data restore, cancellation dan lock. [Mera mendukung device atau emulator yang providernya mendukung PRF](https://github.com/category-labs/mera/blob/main/demos/mobile/README.md). Browser virtual-authenticator test membuktikan Mera/derivation secara terpisah; hasilnya tidak membuktikan native Android bridge atau provider.
7. Lakukan test funding/account/forwarding/enrollment/read di device, tangkap sanitized payload. Verifikasi signed target `/v1/...` terhadap endpoint `/api/v1/...`, account balance, recycle charge/refund, trigger lifecycle/expiry dan financial event semantics sebelum menganggap P0 selesai.

Build tanpa rpId menonaktifkan onboarding; build tanpa pinned enrollment policy menonaktifkan otorisasi API trading. Public market/testnet reads dan latihan tersedia. Tidak ada token/API secret yang harus dikirim lewat chat atau dimasukkan ke build config; API key nantinya dibuat client dan disimpan pada device-authenticated SecureStore.

## Pengujian passkey tanpa HP

`python scripts/passkey-browser-smoke.py` memakai Python Playwright1.58.0, Chrome153.0.8010.12 di cache lokal dan CDP virtual authenticator dengan PRF. Test harness memakai Mera0.2.0 serta `packages/wallet/derive.ts` produksi; dijalankan melalui localhost secure context, tanpa mempublikasikan harness, credential private key, seed atau PRF.

Delapan checks lulus: create, signature/address verification, session lock, same-credential restore sesudah reload, discoverable restore tanpa metadata app, credential berbeda menghasilkan wallet berbeda, wrong RP ditolak, dan authenticator tanpa PRF gagal dengan `PRF_UNAVAILABLE`. Laporan [passkey-browser-smoke.json](../artifacts/passkey-browser-smoke.json) memuat versi browser dan hash source derivation. Provider sync, hardware biometrics dan native Android belum terbukti oleh pengujian ini.

`python scripts/native-passkey-probe.py` hanya menargetkan AVD `tready-api36` pada `emulator-5556` yang tidak mempunyai akun. Provider Google menampilkan pilihan membuat passkey pada perangkat lain; probe membatalkan prompt dan memeriksa pesan cancellation, wallet terkunci serta enrollment disabled. [Native report](../artifacts/native-passkey-probe.json) terikat checksum APK final. Probe ini tidak memasangkan perangkat lain atau menghasilkan credential/PRF native.

## Alur latihan yang bisa direview

Account → pilih **Latihan** → Plan (data market testnet, collateral sintetis100AUSD) → atur budget/stop → review → entry latihan → Trade → pasang stop latihan → close latihan → Receipt. Setiap fill/stop/close latihan merupakan hasil sintetis. Latihan tidak memanggil signer atau transport trading.

Data market publik yang tak tersedia menghasilkan loading/stale/error. Tidak diganti diam-diam dengan harga fixture. Harga tersimpan dalam riset bukan quote baru. Funding reserve dan recycle reserve merupakan asumsi model; tidak menjadi promise biaya/kerugian actual.

## Recovery dan bukti

Restart memindahkan request in-flight ke unknown; aplikasi tidak mengirimnya ulang. Recheck memuat venue snapshots/history dengan pagination. Request yang tidak ditemukan tetap unresolved, termasuk ketika open-orders kosong. Gateway ack0 berarti forwarded. Registration outcome dedup terpisah dari inventory trigger waiting/triggered/executed.

Sesudah outcome material, aplikasi menghentikan stream lama, memeriksa snapshot block terhadap outcome, lalu membuka epoch baru agar queued events lama tidak menimpa state baru. Close IOC yang tidak penuh menampilkan remaining position. Clear-data menghilangkan original plan/journal; passkey restore tidak mengklaim memulihkan intent lokal atau API key yang hilang.

Secrets tidak disimpan di SQLite, receipt, `.env` atau CI. Config dan snapshot hanyalah public metadata. Receipt finansial full history/settlement tetap membutuhkan authenticated fixture/live verification; jangan menghitung data yang belum diterima sebagai nol atau double-subtract biaya dari net account stats.

## Distribusi dan submission

Host static HTTPS sudah aktif pada site Netlify terpisah. [Download APK](https://tready-archzxy.netlify.app/downloads/tready-0.1.4-preview.zip) didistribusikan dalam ZIP melalui redirect ke release GitHub publik. Ekstrak ZIP sebelum install. [Metadata publik](https://tready-archzxy.netlify.app/downloads/release.json) tetap JSON pada host RP; byte count/SHA256 ZIP serta APK setelah ekstraksi cocok dengan [distribution report](../artifacts/completion/distribution.json). Assetlinks tetap HTTPS200/JSON tanpa redirect. Bundel deploy APK disimpan lokal di `.tooling/`, tidak dimasukkan Git. Menghosting HTML/assetlinks tidak memberi eligibility Agora atau whitelist Perpl. Public repo, actual Monad trade evidence, qualified users dan video≤3menit merupakan deliverable berbeda. Submission belum dikirim, outreach belum dilakukan, sponsor cards terkini belum dikonfirmasi.

Lisensi source Tready: [MIT](../LICENSE). [Attribution/disclosure](../third-party/NOTICE.md). Rules dan spesifikasi lengkap tersedia di [PRD](PRD.md).
