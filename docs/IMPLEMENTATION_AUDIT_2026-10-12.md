# Audit implementasi Tready — 12 Oktober 2026

**Verdict: native preview sudah dapat diunduh dan dijalankan; produk trading end-to-end dan submission belum siap.** Estimasi kesiapan masih sekitar **50%** menurut milestone internal di bawah. Ini bukan persentase jumlah kode, rubric resmi Metropolis, atau peluang menang.

Audit memeriksa working tree pada HEAD `228219ee64d2554d190245825f27825266e212e2`, termasuk perubahan enrollment yang belum di-commit. APK publik memakai snapshot aplikasi `adb0e9ed578f8edcb27dfa16dadd6cb0bdd0f56e`; keduanya dinilai terpisah. Audit tidak mengubah implementasi aplikasi, membangun ulang/deploy APK, melakukan enrollment baru, funding, ataupun mengirim order. Perubahan yang sudah ada di workspace dipertahankan.

## Bukti yang diperbarui

| Area | Hasil | Batas kesimpulan |
|---|---|---|
| TypeScript | `pnpm typecheck` lulus pada working tree, termasuk skrip audit | Bukan bukti runtime Android |
| Core suite | **39/39 tests**, 0 gagal, 7 file; [hasil baru](../artifacts/audit/core-tests.json) | Offline/synthetic. Laporan lama 34 tests tetap menjadi bukti snapshot sebelumnya |
| HTTP authenticated | Production `PerplHttp` + `applyInventory` membaca wallet/orders/positions; semua berhasil, mt19/23/26 | Key dibuat melalui UI venue, bukan enrollment Android; tidak membuktikan izin trade |
| Trading socket | Production `TradingSocket` + inventory menerima tiga snapshot dan tiga heartbeat; continuous=true, head>0, satu account | Node runtime; order dan posisi kosong; tidak menguji decoder posisi nonempty, native socket, atau SecureStore |
| HTTPS/distribusi | Landing, assetlinks, metadata, APK semuanya HTTP200 tanpa redirect | Hosting tidak memberi whitelist atau eligibility sponsor |
| APK | Download **54,202,455 bytes**, SHA256 sama dengan release metadata dan APK lokal | Enrollment tetap `false`; perbaikan enrollment terbaru belum masuk APK ini |
| Repro adversarial | Tiga kelompok celah berhasil direproduksi offline | Urutan journal menggunakan fault injection, bukan race yang diamati di Android |

Bukti audit: [transport](../artifacts/audit/transport.json), [hosting](../artifacts/audit/hosting.json), [invariants](../artifacts/audit/invariants.json), [ringkasan/snapshot](../artifacts/audit/summary.json).

SHA256 APK: `b887c49bb4aec5372c682d0391b1a9c2e04a535d956232ead55e21349ef4d9c7`.

Bukti lama yang tetap relevan: [7 emulator UI checks](../artifacts/emulator-smoke.json), [8 browser virtual-PRF checks](../artifacts/passkey-browser-smoke.json), dan [3 native prompt/cancellation checks](../artifacts/native-passkey-probe.json). Audit ini tidak menjalankan ulang emulator; laporan native/UI terikat pada checksum APK yang baru diverifikasi. Browser memakai Mera dan derivation produksi, tetapi virtual authenticator bukan provider native Android atau hardware biometric.

## Temuan yang harus diselesaikan

### A1 — P1: validasi enrollment belum mengunci seluruh otorisasi

Lokasi: `packages/perpl/enrollment.ts:41–48`, pemanggil pada `:55–59`.

Domain/chain, wallet, public key, scope, dan expiry diperiksa. Namun pemeriksaan `types` hanya mengizinkan **nama** tipe; field beserta tipenya tidak dibandingkan dengan schema yang dipin. `origin`, `builderId`, `maxBuilderFeePer100K`, dan parameter otorisasi lain juga tidak dibandingkan sebelum wallet diminta menandatangani.

Repro lokal memakai bentuk payload vendor yang terekam. Baseline diterima; mengganti Origin ke domain lain, menambahkan builder fee, dan menambah field primary type tetap diterima oleh `validateEnrollment`. Tidak ada payload yang dikirim atau ditandatangani. Pengecekan Origin pada respons enroll terjadi setelah signature diberikan; builder-fee allowance tidak diperiksa di respons itu.

Dampak: payload tak sesuai pilihan pengguna dapat lolos batas validasi sebelum signature. Ini bukti kelemahan validasi, bukan bukti server Perpl mengirim payload berbahaya. APK sekarang masih menonaktifkan enrollment, sehingga temuan ini harus diperbaiki sebelum gate tersebut dibuka.

Perbaikan: pin graph field/type lengkap sesuai schema vendor; cocokkan semua parameter yang diminta, termasuk Origin milik app dan builder fee nol jika tidak dipilih; validasi nilai/waktu challenge dan field wajib. Jangan pin salt dinamis sebagai konstanta atau mengubah typed data yang dikembalikan vendor. Tambahkan rejection tests untuk setiap mutasi dan lakukan enrollment sukses dengan wallet/account yang sama. [Dokumentasi enrollment resmi](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md).

### A2 — P1: journal dapat kehilangan status terminal pada completion order tertentu

Lokasi: `packages/execution/coordinator.ts:41–43`, `apps/android/src/storage.ts:41–42`, dan `packages/storage/memory.ts`.

Coordinator mengirim lalu menulis `sent`; implementasi journal melakukan update status tanpa guard transisi. Pada fault injection ketika update `settled` selesai sebelum write `sent`, hasil akhirnya `sent` dengan `nonFailureSeen=true`. `unresolved()` kemudian tetap true, sedangkan `requestOutcome()` mengabaikan outcome berikutnya karena `nonFailureSeen` sudah true.

Dampak: status dapat macet pending dan memblokir tindakan selanjutnya meskipun outcome sudah diketahui. Ini fail-closed terhadap entry pengganti, tetapi mengganggu recovery. Kemungkinan/frekuensi interleaving SQLite native belum diukur; repro membuktikan state machine tidak tahan terhadap urutan tersebut.

Perbaikan: terapkan update atomik bersyarat dan transisi monotonic di penyimpanan; local `sent`/gateway `forwarded` tidak boleh menimpa terminal outcome. Pertahankan semantik late success setelah failure yang didokumentasikan venue. Uji fast outcome, interleaving update, crash/restart, dan duplicate messages pada SQLite native, bukan hanya memory journal.

### A3 — P1: stop berukuran kecil dianggap cukup dan repair tertahan

Lokasi: `packages/execution/workflow.ts:4–5`, `apps/android/src/controller.ts:146`, `apps/android/src/App.tsx:74–78`.

`protection()` memeriksa account/market/position link, close type, trigger condition, dan status. Quantity tidak diperiksa. Repro: posisi **100 lot** dan stop untriggered **1 lot** menghasilkan `registered=true` dan workflow `active`. Tombol pasang stop disabled karena fungsi yang sama menganggap stop sudah ada.

Dampak: pengguna melihat "Stop terdaftar" tanpa informasi bahwa sebagian besar quantity tidak tercakup dan tidak dapat memperbaikinya lewat aksi pasang stop biasa. Status terdaftar sendiri benar, tetapi klasifikasi posisi dan tindakan recovery terlalu luas. `Close*` adalah reduce-only dengan size dibatasi posisi; sifat itu tidak menjamin order kecil akan menutup seluruh posisi. [Dokumentasi order resmi](https://github.com/PerplFoundation/api-docs/blob/main/websocket.md).

Perbaikan: bedakan registered, coverage quantity, dan outcome; verifikasi remaining quantity serta status/trigger yang relevan; tampilkan proteksi parsial dan flow cancel/reconcile/replacement yang disetujui pengguna. Jangan menjumlahkan semua stop sebagai jaminan loss cap. Uji restore dengan stop dari luar app, partial fills, dan perubahan quantity posisi.

### A4 — blocker: onboarding dari app belum berhasil

Origin app masih belum terbukti di-whitelist. [Origin probe](../artifacts/enroll-spike.json) berisi **6 percobaan total**, dengan **3 permintaan Origin app semuanya HTTP400**, sementara 3 kontrol mendapat HTTP200. Dokumen status/runbook saat audit menyebut enam kegagalan app; itu tidak sesuai artifact. Respons 400 generik tidak menyimpan alasan server, jadi pola ini mendukung masalah whitelist tanpa memastikan penyebab tunggalnya.

[Probe enrollment](../artifacts/enroll-e2e.json) berakhir HTTP404 dan `returnedApiKey=false`; wallet probe acak tidak memiliki akun Perpl. Menurut tabel vendor, 404 berarti target profile tidak ditemukan. Skrip itu menandatangani payload langsung dan melewati validator produksi; nama "e2e" tidak berarti onboarding app berhasil. [Dokumentasi resmi](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md) mensyaratkan whitelist Origin sendiri, termasuk ketika request berasal dari server.

Perbaikan: peroleh whitelist yang sah untuk Origin app; buktikan native wallet → funding/account/forwarding → payload tervalidasi → enrollment → SecureStore → signed read pada wallet yang sama. Key UI yang diuji read-only sekarang tidak menutup rantai tersebut. Tidak ada import key UI ke app pada flow saat ini.

### A5 — delivery gap: APK publik tertinggal dari working tree

Source terbaru menormalisasi chainId `0x279f` dan public key base64url sebelum dibandingkan, dengan lima test tambahan. APK build3 mendahului perubahan itu dan enrollment masih disabled. Metadata publik cocok dengan APK; masalahnya versi belum membawa perbaikan terbaru, bukan checksum rusak.

Perbaikan: setelah A1–A3 diselesaikan dan konfigurasi sah tersedia, build versi baru; beri source snapshot dan checksum baru; jalankan smoke checks yang sesuai perubahan; distribusikan APK itu. Jangan menyatakan 39 tests sebagai verifikasi bundle APK build3.

### A6 — competitive/submission gap: bukti produk dan deliverable belum tersedia

Tidak ditemukan remote Git dalam checkout ini, public repository URL, video demo, transaksi trade nyata, atau sesi pengguna eksternal. Ini menunjukkan evidence belum tersedia di workspace; bukan klaim telah mencari semua akun eksternal pengguna. Sponsor cards/rubric terkunci belum diperoleh, sehingga eligibility sponsor dan payout tetap belum terkonfirmasi untuk submission ini.

Perbaikan: sediakan repo publik yang aman tanpa credential/signing key; peroleh aturan/kartu sponsor resmi; dokumentasikan demo trade dan recovery dengan chain evidence; buat video sesuai batas resmi; uji tugas inti dengan calon pengguna dan simpan hasil tanpa mengarang traction. Lisensi, attribution, PRD dan runbook sudah ada, tetapi belum menggantikan bukti tersebut.

## Readiness berdasarkan milestone internal

Lima kelompok mendapat bobot sama; masing-masing empat milestone, 5 poin per milestone. Nilai merupakan alat perencanaan internal. Banyaknya fitur/tes tidak menjamin kualitas atau penilaian juri.

| Kelompok | Milestone yang sudah dibuktikan | Milestone tersisa | Nilai |
|---|---|---|---|
| Distribusi/infra | Standalone APK; HTTPS; association cocok; download/hash terverifikasi | Versi baru tetap perlu diulang verifikasinya ketika kode berubah | 20/20 |
| Planning/public UI | Empat layar + latihan; market/config/RPC asli; core sizing/review diuji | Model biaya/affordability dibandingkan dengan settlement aktual | 15/20 |
| Identity/onboarding | Integrasi Mera dengan browser PRF dan native prompt/cancel | Native PRF/recovery; funding/account; enrollment + SecureStore pada wallet yang sama | 5/20 |
| Execution/recovery | Signed HTTP/socket/inventory read asli | Actual entry/fill; stop/close; recovery unknown/partial/crash nyata | 5/20 |
| Evidence/submission | PRD/runbook/lisensi/attribution tersedia | Repo publik; demo/video/chain proof; pengujian pengguna dan aturan sponsor terkonfirmasi | 5/20 |
| **Total** | | | **50/100** |

50/100 tidak berarti setengah waktu kerja tersisa. Bagian belum selesai memiliki dependency eksternal dan integrasi yang lebih sulit. Tidak ada dasar untuk mengubah angka ini menjadi peluang juara 1. Read-only venue integration memberi kemajuan nyata dibanding preview awal, tetapi critical path trading belum lewat.

## Pemetaan seluruh P0 pada PRD

**Lokal** = acceptance komponen punya bukti sesuai scope lokal/synthetic/hosting. **Parsial** = implementasi ada tetapi acceptance lengkap belum dibuktikan. **Celah** = repro audit menemukan ketidaksesuaian. **Terblokir** = gate onboarding belum lolos. **Belum** = deliverable belum tersedia. Status Lokal tidak menandai full P0 selesai pada Android.

| ID | Status audit | Bukti atau kekurangan utama |
|---|---|---|
| TR-01 | Parsial | Binding/config/RPC guards tersedia; writes pada wallet native belum diuji |
| TR-02 | Parsial | Config live ter-resolve; freshness/runtime fee perubahan pada trading belum dibuktikan |
| TR-03 | Lokal | Label testnet/synthetic dan jalur latihan tanpa signer diperiksa |
| TR-04 | Parsial | Browser virtual PRF restore sama; native create/recover belum berhasil |
| TR-05 | Parsial | Native cancel dan browser no-PRF lolos; provider-native PRF/error matrix belum lengkap |
| TR-06 | Lokal | HTTPS assetlinks cocok package/certificate APK; download rechecked |
| TR-07 | Parsial | Session lock/zeroing dan SecureStore adapter ada; biometric storage lifecycle belum diuji |
| TR-08 | Parsial | Restore code tersedia; clear-data native + venue state belum diuji |
| TR-09 | Parsial | Saldo/funding adapter tersedia; owner funding dan receipt belum dilakukan |
| TR-10 | Parsial | Allowance/create/forward langkah terpisah tersedia; setup nyata belum lolos |
| TR-11 | Terblokir | Enrollment app belum sukses; A1/A4 juga harus diselesaikan |
| TR-12 | Parsial | Withdraw simulation/journal guards tersedia; withdraw nyata belum diuji |
| TR-13 | Lokal | Input units/side/price/leverage/risk rejection diuji di core |
| TR-14 | Lokal | Integer sizing dan budget/rounding cases diuji di core |
| TR-15 | Parsial | Dua fee/reserves ada; recycle charge/refund dan actual costs belum dibuktikan |
| TR-16 | Lokal | Stop/stress loss, margin, gap disclaimer ada di UI dan diuji visual |
| TR-17 | Lokal | Depth unknown/VWAP helper, quote expiry dan guards tersedia/diuji lokal; actual fill bukan bukti yang diklaim |
| TR-18 | Parsial | Admission guards ada; venue affordability/fee/locking semantics belum end-to-end |
| TR-19 | Lokal | Plan digest/approval/replay/stale binding guards diuji core |
| TR-20 | Celah | Durable prepare-before-send ada; terminal status regression pada A2 |
| TR-21 | Parsial | IOC/outcome logic diuji synthetic; zero/partial/full venue fill belum diuji |
| TR-22 | Celah | Linked trigger/status logic ada; stop quantity coverage tidak diperiksa pada A3 |
| TR-23 | Parsial | Satu account decoder lolos respons asli; nonempty real position belum diuji |
| TR-24 | Parsial | Reconnect/history/no-replacement ada; network loss setelah real send belum diuji |
| TR-25 | Parsial | Close-only command/UI ada; real partial/reject/unknown close belum diuji |
| TR-26 | Parsial | Recovery controls ada; coverage repair A3 dan venue failures belum teruji |
| TR-27 | Parsial | Background lock/resume logic, synthetic restart evidence; in-flight native operation belum diuji |
| TR-28 | Parsial | Provenance/event uniqueness/net semantics diuji core; full trade-net reconciliation belum terbukti |
| TR-29 | Parsial | Native cancellation/error labels ada; live request/error recovery belum lengkap |
| TR-30 | Parsial | Visual 360dp/font1.4 lolos; seluruh touch targets/keyboard/error states belum diukur |
| TR-31 | Lokal | APK berjalan tanpa Metro; instruksi, checksum dan download tersedia |
| TR-32 | Parsial | Local journal/events tersedia; funnel/latency instrumentation dan log audit menyeluruh belum dibuktikan |
| TR-33 | Belum | Repo publik/video/chain evidence/aturan submission belum lengkap |

Jumlah: **8 Lokal, 21 Parsial, 2 Celah, 1 Terblokir, 1 Belum**. TR-34/35 adalah P1 dan TR-36 P2; ketiganya di luar gate rilis hackathon P0.

## Urutan penyelesaian

1. **Perbaiki A1–A3 sebelum membuka trading.** Bukti selesai: adversarial cases ditolak/ditangani dengan benar, core suite tetap lolos, journal diuji dengan actual SQLite.
2. **Buktikan native PRF happy path dan same-credential recovery** dengan provider yang mendukung. Emulator dapat dipakai jika provider mendukung; browser virtual test saat ini tidak menggantikan pengujian native. Biometric hardware dan sync antarperangkat tetap bukti terpisah.
3. **Tutup onboarding pada wallet yang sama:** MON/AUSD → account/allowance/forwarding → Origin sah → enrollment + SecureStore → authenticated read. Gate whitelist dan native provider dapat ditangani sambil memperbaiki kode.
4. **Selesaikan satu trade testnet nyata dan satu recovery penting:** entry → actual fill → native stop → close → receipt/provenance; kemudian disconnect/unknown atau partial fill yang bisa diverifikasi. Jangan mengubah synthetic outcomes menjadi claim real trade.
5. **Build APK baru dan kumpulkan submission evidence:** checksum-bound smoke evidence, repo publik, video, aturan sponsor, hasil pengguna, dan submission sesuai format resmi. Situs preview dan penggunaan domain utama yang sudah ada tidak menghalangi langkah ini.

Audit selesai; pekerjaan produk yang tercantum masih belum selesai. Tiga temuan kode belum diperbaiki oleh audit ini.

## Reproduksi audit

```bash
./scripts/dev.sh pnpm typecheck
./scripts/dev.sh pnpm test --reporter=json --outputFile=artifacts/audit/core-tests.json
./scripts/dev.sh pnpm exec tsx scripts/audit-invariants.ts
```

`scripts/audit-invariants.ts` sepenuhnya offline dan melaporkan celah yang ada; exit0 berarti skrip reproduksi selesai, bukan aplikasi telah lolos security/reliability gate. `scripts/audit-transport.ts` memerlukan tepat satu export key venue lokal yang di-ignore Git; hanya GET authenticated dan WS sign-in/passive snapshots, dengan guard yang melarang frame order. Key tidak dicetak atau disimpan dalam artifact. Cache dokumentasi vendor disimpan di `.tooling/audit/` yang di-ignore; URL/hash sumber tersedia dalam summary.
