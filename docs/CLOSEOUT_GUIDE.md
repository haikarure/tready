# Menuntaskan Tready untuk Metropolis

Status per 12 Oktober 2026. Perbaikan kode, APK, repository dan video preview sudah tersedia. Registrasi founder belum dilakukan. Panduan ini membagi pekerjaan berdasarkan siapa yang mempunyai akses untuk menyelesaikannya; setiap gate perlu bukti sebelum dicentang.

## Urutan pertama

1. Founder membuka [portal resmi](https://hackathon.monad.xyz), memilih GitHub, Google atau Discord, mengisi profil dan membaca/menerima rules sendiri. Gunakan provider yang sama setiap login karena provider berbeda menghasilkan akun berbeda.
2. Isi proyek **Tready**, tim solo, track **Onchain Finance & Trading**. Gunakan [submission package](SUBMISSION_PACKAGE.md) untuk deskripsi, repo, demo, stack, kontrak dan disclosure. Simpan draft jika portal menyediakan draft; draft bukan submission diterima.
3. Dari portal, baca kartu Agora mobile trading, Category Labs/Mera dan Perpl. Salin teks requirements, deliverables, pembagian hadiah, eligibility platform/network dan aturan video. Rules umum tidak menggantikan kartu sponsor. Sampai teks tersebut diperiksa, eligibility sponsor tetap belum terkonfirmasi.
4. Kirim permintaan whitelist Perpl dari [draft yang sudah disiapkan](IMPLEMENTATION_PLAN.md#4-pertanyaan-dependency-yang-siap-diajukan), melalui mentor/kontak Perpl yang tercantum dalam portal. Request utama: Origin `https://tready-archzxy.netlify.app` untuk testnet `/api/v1/api-key/payload` dan `/api/v1/api-key/enroll`. Hasil terbaru: HTTP400. Respons itu konsisten dengan masalah Origin, tetapi tidak memastikan penyebab tunggal. Draft belum dikirim.

Rules v3 yang diambil ulang dari [policy resmi](https://hackathon.monad.xyz/api/v1/policies/current) tetap menetapkan deadline **13 Oktober 2026 23:59 America/New_York**, yaitu **14 Oktober 2026 10:59 Asia/Jakarta**. Simpan sebelum deadline; timestamp penerimaan portal menentukan submission. Salinan sumber: [policies-current.json](../artifacts/completion/policies-current.json). Mainnet atau testnet diperbolehkan.

## Yang dikerjakan Codex

| Pekerjaan | Bukti selesai |
|---|---|
| Setup provider PRF pada emulator khusus | Native create, lock/unlock, restart dan discoverable restore menghasilkan alamat yang sama; APK/checksum/provider dicatat |
| Cek endpoint dan konfigurasi Perpl | Origin sendiri diterima200, policy lengkap cocok dan account/market/token/chain terverifikasi |
| Aktifkan auto-enrollment | Setelah challenge Origin sendiri lolos validasi, build baru dengan policy terpin; tidak ada signature/key dari probe kesiapan |
| Actual APK trade | Wallet Mera yang sama, gas+AUSD testnet, create account, forwarding, key SecureStore, entry kecil→stop penuh→close; history/RPC dan final flat |
| Demo final | Operasi aplikasi dan interaksi Monad nyata terlihat; synthetic dan Node dibedakan; panjang maksimal3menit menurut Rules v3 |
| Repo/distribusi | Commit, APK, metadata, certificate, HTTP dan checksum cocok; dokumentasi/status diperbarui |

Pemeriksaan tersebut dapat dilakukan pada emulator dengan provider PRF yang kompatibel. Android fisik diperlukan untuk klaim biometrik/hardware yang memang bergantung pada perangkat fisik. Provider cloud sync dan restore di perangkat lain memerlukan pengujian terpisah. Keberhasilan software provider tidak membuktikan semua provider Android kompatibel.

## Bantuan founder yang mungkin diperlukan

- **Registrasi dan akses portal:** founder mengisi data identitas dan persetujuan sendiri. Setelah login, kirim teks kartu sponsor/form yang relevan; jangan kirim password, OTP atau cookie.
- **Respons Perpl:** founder mengirim draft melalui kanal resmi. Codex bisa mengukur penerimaan Origin dan menyiapkan build setelah ada perubahan vendor, tetapi tidak dapat mengubah whitelist milik Perpl.
- **Faucet MON:** apabila faucet meminta CAPTCHA/login, founder menyelesaikan tahap tersebut untuk alamat publik wallet Mera yang diuji. [Faucet resmi](https://faucet.monad.xyz). Gas dan AUSD harus berada pada wallet yang sama. Token uji digunakan untuk pengujian ini.
- **Pengguna eksternal:** founder mengajak trader perp untuk sesi15menit. Gunakan protokol [task test](SUBMISSION_PACKAGE.md#task-test-untuk-calon-pengguna), catat hasil nyata dan izin kutipan. Target internal lima peserta tidak menjadi syarat Rules umum yang ditemukan. Tidak ada hasil pengguna yang dicatat sampai ada sesi sungguhan.
- **GitHub CI:** akun sedang terkena billing lock; periksa [GitHub billing overview](https://github.com/settings/billing/overview). Codex tidak mengubah billing/pembayaran. Pemeriksaan lokal tersedia; CI cloud bukan mandatory deliverable Rules umum.
- **Submission akhir:** founder memeriksa klaim, data pribadi, sponsor terpilih dan terms di portal, lalu memastikan submission tersimpan. Catat project URL, status submitted dan timestamp. Submission belum dikirim.

## Jika mencoba Android sendiri

1. Install [APK0.1.2](https://tready-archzxy.netlify.app/downloads/tready-0.1.2-preview.apk). Aktifkan credential provider dan screen lock. Jika memilih Google Password Manager, login akun Google. Kehadiran akun/provider saja belum membuktikan PRF didukung.
2. Account → **Buat passkey**. Catat versi Android/provider, apakah alamat muncul dan error yang terlihat. Jangan mengirim PIN, password atau PRF.
3. **Kunci sesi** → **Buka passkey**. Pastikan wallet tetap sama. Force-stop/restart lalu ulangi. Jangan membuat credential baru untuk memulihkan wallet lama.
4. Setelah wallet dapat dipulihkan dan sudah didokumentasikan, siapkan MON dari faucet untuk gas; **Minta AUSD testnet** memerlukan gas karena memanggil kontrak.
5. **Approve jumlah ini** → **Buka akun Perpl** → **Aktifkan order forwarding**. Ikuti minimum collateral yang tampil. Periksa receipt tiap transaksi sebelum lanjut; transaksi unknown diperiksa ulang, tidak otomatis diulang.
6. Tombol **Otorisasi API trading** tetap disabled pada APK0.1.2 karena whitelist/policy belum siap. Import key hanya untuk wallet Mera yang sama; key engineering dari wallet lain akan ditolak. App belum menyediakan connector wallet Mera ke UI Perpl, sehingga import bukan langkah onboarding otomatis yang sudah selesai.
7. Pengujian entry/stop/close melalui APK baru dapat dituntaskan setelah gate wallet, funding, account dan API di atas selesai. Trading lewat Node yang telah lulus tetap merupakan bukti terpisah.

## Keputusan sebelum deadline

Jangan menunggu semua pekerjaan tambahan untuk mulai mengisi portal. Simpan materi dan periksa persyaratan sekarang. Apabila native onboarding belum selesai ketika deadline mendekat, submission harus menjelaskan batas preview yang sebenarnya. Jangan mengklaim Agora/Mera full mobile workflow, pengguna aktif, mainnet deployment atau successful native trade tanpa bukti. Pilih bounty yang brief-nya benar-benar dipenuhi setelah kartu resmi diperiksa.
