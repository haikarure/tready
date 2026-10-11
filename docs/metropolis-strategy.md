# Strategi Tready buat Monad Metropolis

Riset diperbarui 11 Oktober 2026. Kondisi lu: solo, mulai dari nol. Deadline resmi: 13 Oktober 2026 pukul 23:59 ET, setara 14 Oktober pukul 10:59 WIB. Target kerja yang gue pakai: produk dan submission sudah selesai 13 Oktober malam; pagi 14 Oktober jadi buffer.

**Rekomendasi produk di bawah telah direvisi setelah audit adversarial.** Lu juga sudah mengonfirmasi belum punya calon pengguna dan memakai Android. Planning/sizing/receipt dan guard dasar punya pembanding langsung; versi awal belum menjadi dasar klaim kandidat juara. Pakai [PRD Android terkini](PRD.md) untuk implementasi dan [audit](metropolis-adversarial-review.md) untuk alasan revisi. Bagian aturan, nominal hadiah, dan sumber di dokumen ini tetap referensi dengan keterbatasan yang ditulis.

**Pilihan gue: bikin aplikasi mobile yang mengubah rencana risiko menjadi trade Perpl, lalu menunjukkan apakah eksekusinya sesuai rencana.** Target sponsor utama Agora dan Mera UX. Perpl API jadi target berikutnya kalau otomatisasi eksekusi selesai. Peluang juara perlu dibangun lewat kualitas, bukti pemakaian, dan kecocokan brief; belum ada dasar buat menghitung probabilitas menang.

Ini rekomendasi riset, belum implementasi. Sumber resmi dan catatan peserta dibedakan di bawah. Daftar pembanding berasal dari proyek publik yang ditemukan, bukan seluruh submission.

**Aturan resmi mengubah beberapa asumsi dari riset awal.** Rules v3 bisa dibaca tanpa login lewat [endpoint policy resmi](https://hackathon.monad.xyz/api/v1/policies/current). Repo publik, lisensi OSI, README runnable, atribusi, commit selama build window, dan disclosure AI wajib. Demo operasi nyata maksimal tiga menit; mainnet atau testnet boleh. Tim solo boleh. Top tiga setiap track masing-masing mendapat $10.000; overall winner mendapat $25.000. Kepatuhan brief menyumbang 40% penilaian sponsor. FAQ landing menyebut open source opsional, tetapi Rules v3 mewajibkannya; persiapkan submission sesuai Rules.

| Rubric resmi semua track | Bobot | Bukti yang gue sarankan buat Tready |
|---|---:|---|
| Kualitas dan kelengkapan produk | 20% | Dari login sampai trade dan receipt tanpa jalan buntu |
| Keunggulan teknis | 20% | Ukuran order benar; reconnect dan partial fill ditangani |
| Integrasi Monad | 20% | Receipt menunjuk transaksi/fill dan akun pada chain yang benar |
| Kecocokan track dan masalah | 20% | Trader tertentu, masalah tertentu, transaksi finansial nyata |
| Inovasi dan dampak | 20% | Perbandingan terukur antara rencana pengguna dan hasil eksekusi |

Bobot di atas dari [Rules v3 §5.2](https://hackathon.monad.xyz/api/v1/policies/current). Kolom bukti adalah usulan gue. Bobot sponsor lainnya: teknis 30%, integrasi Monad 20%, inovasi 10%.

Catatan peserta yang mengaku membaca kartu Track 01 melaporkan rubric berbeda: teknis 20%, desain 20%, orisinalitas 15%, kesiapan founder/pasar 25%, serta traction/rencana lanjut 20%. Gue belum membaca kartu terkini langsung. Jangan memperlakukan angka ini sebagai pengganti Rules; siapkan bukti pengguna dan rencana distribusi untuk memenuhi kedua arah penilaian. [Catatan kartu peserta](https://github.com/ProofBook-App/proofbook/blob/main/docs/reference/hackathon.md)

**Hadiah perlu dibaca sebagai pool atau award, bukan langsung dijumlahkan sebagai penghasilan satu tim.** Nominal publik di bawah terverifikasi dari [landing resmi](https://monad.xyz/developers/hackathons/metropolis). Pembagian Perpl dan detail brief berasal dari catatan peserta; kartu sponsor terkini tetap perlu diperiksa saat login.

| Bounty | Nominal publik | Detail dan keputusan buat lu |
|---|---:|---|
| Agora, mobile trading | $10.000 | Prioritas utama. Brief dilaporkan meminta Mera, saldo AUSD, dan trade Perpl. Pembagian award serta penerimaan PWA belum gue verifikasi. |
| Mera, pengalaman akun | $2.500 | Prioritas utama. Fondasi yang sama bisa menghasilkan bukti pemulihan akun dan sesi signing. |
| Perpl, penggunaan API | $5.000 pool | Dilaporkan dua award masing-masing $2.500. Masuk kalau ada otomatisasi eksekusi yang matang. |
| Kuru, aplikasi spot | $5.000 | Tambahan hanya bila produk inti selesai dan akses integrasinya tersedia. |
| Nansen | $5.000 | Tambahan bila data mengubah keputusan pengguna; perlu akses API dan brief. |
| Envio | $1.000 | Tambahan bila indexer memang mendukung receipt/riwayat sebagai fitur utama. |
| Community team | $5.000 | Periksa bila lu benar-benar mewakili komunitas pendukung yang memenuhi syarat. |
| Perpl, analytics/risiko | $3.000 pool | Dilaporkan tiga award masing-masing $1.000. Scope luas; gue keluarkan dari prioritas MVP. |

Hadiah Kimi, Qwen, dan Alchemy yang ditulis sebagai credits dihitung terpisah dari uang. Semua nominal di tabel adalah kategori yang ditarget, bukan janji award. Jangan menjumlahkan overall, track, dan sponsor menjadi pendapatan pasti; konfirmasi ketentuan kumulatif dan distribusi tiap sponsor.

**Agora punya prasyarat yang lebih spesifik daripada sekadar memakai AUSD.** Catatan kartu peserta meminta alur passkey Mera → saldo/funding AUSD → paling sedikit satu trade Perpl. Ini membuat aplikasi analytics saja tidak cukup untuk target Agora. Catatan Mera UX menambahkan pemulihan identitas setelah storage dibersihkan atau perangkat diganti, serta sesi signing. Itu jadi acceptance test produk. [Catatan brief Agora](https://github.com/ProofBook-App/proofbook/blob/main/docs/reference/hackathon.md), [catatan brief Mera](https://github.com/ProofBook-App/proofbook/blob/main/spec.md)

Untuk Perpl API, catatan brief menggambarkan bot atau otomatisasi trading yang siap dipakai, dengan eksekusi andal, pengelolaan risiko, aktivitas onchain, dan kemampuan menghasilkan hasil trading yang masuk akal. Membaca harga dan menyediakan tombol order belum cukup jadi posisi kompetitif. Tready perlu mengotomatisasi sizing, penempatan trigger terkait posisi, serta rekonsiliasi order. Bukti hasil mencakup fee, slippage dan funding; profit satu trade tidak membuktikan strategi menguntungkan. [Catatan brief Perpl API](https://github.com/ProofBook-App/proofbook/blob/main/spec.md)

**Pembanding publik sudah kuat, jadi kemenangan harus punya alasan yang spesifik.** Fitur dan status berikut merupakan klaim pengembang dalam repo. Gue membaca dokumentasinya, tetapi belum menjalankan aplikasi atau mengaudit kode dan transaksi mereka.

| Pembanding | Fokus yang dilaporkan | Implikasi buat Tready |
|---|---|---|
| Desk | iOS native; Mera, AUSD, Perpl; copy trading dan batas risiko | Jumlah layar, widgets, dan fitur copy trading akan jadi perlombaan scope yang berat. [Submission Desk](https://github.com/frankolien/desk/blob/main/docs/submission.md) |
| Plumb | Analytics protokol dan wallet; funding, likuidasi, stress test, rekonsiliasi | Dashboard risiko sederhana belum menutup brief yang mereka petakan. [Submission Plumb](https://github.com/s0urledd/plumb/blob/main/docs/submission.md) |
| Proofbook | Vault agen, identitas ERC-8004, policy, Perpl/Kuru | Marketplace agen dan vault menambah kontrak serta beban pembuktian. [Repo Proofbook](https://github.com/ProofBook-App/proofbook) |
| Covenant | Mandat market maker di Kuru dengan pembatasan dan pembayaran berdasarkan KPI | Produk infrastruktur market making perlu primitive dan bukti integrasi yang dalam. [Repo Covenant](https://github.com/Monarchy712/Covenant) |

Brief analytics yang dipetakan Plumb mencakup statistik protokol lintas periode, chart, aliran dana, pasar/funding/likuidasi, lalu profil wallet, performa dan margin. Gue mengubah rekomendasi awal: jurnal pribadi dengan sizing belum cukup untuk mengincar bounty itu. [Pemetaan brief analytics](https://github.com/s0urledd/plumb/blob/main/docs/submission.md)

**Konsep yang gue pilih: Tready sebagai tempat menyusun, mengeksekusi, dan mengevaluasi satu rencana trade di HP.** Pengguna pertama yang diusulkan: trader futures ritel Indonesia yang sudah mengenal stop-loss di CEX dan ingin mencoba Perpl dari HP. Ini hipotesis pasar, belum bukti permintaan. Mulai dengan BTC saja.

Contoh alur: pengguna menentukan arah, level invalidasi, dan anggaran risiko 5 AUSD. Tready menghitung ukuran posisi, menunjukkan estimasi fill dari order book dan biaya, lalu pengguna menyetujui rencananya. Aplikasi menempatkan order, mengonfirmasi fill dan trigger penutup, kemudian menampilkan receipt yang membandingkan rencana dengan hasil. Angka 5 AUSD merupakan contoh, bukan rekomendasi trading.

Fitur pembeda yang gue usulkan adalah **pemeriksaan eksekusi sebelum dan sesudah trade**. Sebelum entry, pengguna melihat bagaimana spread, fee, dan skenario likuiditas memengaruhi estimasi kerugian. Sesudah entry, pengguna melihat ukuran yang benar-benar terisi, harga rata-rata, biaya, trigger yang terdaftar, dan selisih dari rencana. Ini belum terbukti unik di pasar; uji terhadap pengalaman pengguna sebelum membuat klaim orisinalitas.

| Bagian MVP | Definisi selesai |
|---|---|
| Akun | Mera menciptakan akun; sesi bisa dikunci; akun yang sama pulih lewat passkey |
| Dana | Saldo wallet AUSD dan collateral Perpl tampil jelas; funding nyata di testnet |
| Rencana | BTC; input arah, invalidasi, anggaran risiko; hitungan memakai precision market |
| Eksekusi | Order dan trigger mengikuti status nyata; partial fill, penolakan dan timeout terlihat |
| Receipt | Rencana tersimpan; fill, fee dan posisi bisa direkonsiliasi; link bukti tersedia |

Empat layar cukup: Account, Plan, Active Trade, Receipt. Desain mobile perlu tombol yang nyaman, angka terbaca, dan state pending yang jelas. Lebarnya scope bisa ditambah setelah lima bagian tersebut bekerja.

Untuk versi submission ini, fitur social/copy trading, vault, token baru, marketplace agen, multichain dan AI chat tidak masuk anggaran implementasi gue. Setiap tambahan harus memperbaiki bukti produk inti atau memenuhi brief sponsor yang sudah dikonfirmasi.

**Teknologi yang ada membantu, tetapi ada gate yang harus dibuktikan di awal.** [Mera mendukung browser dan React Native](https://github.com/category-labs/mera); [demo mobile resminya menggunakan Expo](https://github.com/category-labs/mera/blob/main/demos/mobile/README.md). Demo itu memakai pasar fiktif di jaringan demo, sehingga adaptasi ke Perpl tetap pekerjaan utama. Android membutuhkan domain HTTPS dan asset links; perangkat/passkey provider harus mendukung PRF.

Pilihan platform gue bersyarat. PWA paling cepat untuk shipping dan akses juri, tetapi kelayakannya untuk Agora belum terbukti. Jika sponsor menerima PWA, pakai itu. Jika perlu aplikasi native, pakai fondasi demo React Native Mera dan fokus Android, dengan atribusi serta disclosure komponen awal. Akses juri ke APK dan perangkat pendukung harus direncanakan sebelum menghabiskan hari pertama.

Perpl API menyediakan REST dan WebSocket. Enrollment API key, pembuatan akun exchange dan izin forwarding order merupakan langkah berbeda. [Dokumentasi integrasi Perpl](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md), [panduan API](https://github.com/PerplFoundation/api-docs)

Gue melakukan pembacaan endpoint publik, tanpa autentikasi, penandatanganan atau transaksi: [mainnet context](https://app.perpl.xyz/api/v1/pub/context) dan [testnet context](https://testnet.perpl.xyz/api/v1/pub/context) sama-sama merespons HTTP 200. Snapshot menampilkan AUSD 6 decimals, chain 143/10143, dan BTC market ID 1/16. Minimum membuka akun dilaporkan 10 AUSD di mainnet dan 100 AUSD di testnet. Ambil konfigurasi runtime; beberapa tabel dokumen masih menunjukkan alamat collateral testnet lama. Respons market data belum membuktikan enrollment atau eksekusi trading bekerja.

[Dokumentasi order Perpl](https://docs.perpl.xyz/exchange/order-types) membedakan mark sebagai pemicu stop dan harga fill dari book. IOC dapat terisi sebagian atau tidak sama sekali. Stop dan take-profit memakai lapisan trigger/keeper, bukan operasi stop native di kontrak. Maka anggaran risiko harus ditampilkan sebagai estimasi berdasarkan asumsi, bukan janji kerugian maksimal.

[Dokumentasi WebSocket](https://github.com/PerplFoundation/api-docs/blob/main/websocket.md) mendukung trigger yang dikaitkan ke request entry dan posisi, serta request ID untuk idempotensi. Pakai mekanisme itu dan uji lifecycle; entry, stop, dan close belum tentu satu operasi atomik. Bila status order belum jelas, rekonsiliasi sebelum mengirim pengganti. Bila trigger ditolak, UI harus menunjukkan posisi belum terlindungi dan menyediakan penutupan yang memperlihatkan hasil sebenarnya.

Kuru punya potensi bounty besar, tetapi [panduan Spot V2 testnet](https://kuru-testnet-docs.mintlify.site/introduction/getting-started.md) menyebut token admin-mintable tanpa faucet publik. Akses token perlu kontak integrasi. Ini berlaku untuk deployment V2 tersebut, bukan klaim bahwa semua deployment Kuru tak bisa dipakai. Dengan tenggat lu, gue menunggu bukti akses sebelum mengalokasikan waktu ke Kuru.

**Jadwal yang gue usulkan melindungi waktu buat produk dan pembuktian pengguna.** Ini estimasi urutan kerja, bukan jaminan durasi.

| Waktu | Hasil yang perlu dicapai | Jika belum tercapai |
|---|---|---|
| Enam jam pertama, 11 Oktober | Konfirmasi Agora/PWA; akun Mera pulih; AUSD dan akun Perpl siap; order testnet pertama | Selesaikan hambatan integrasi dan kurangi fitur tambahan |
| Sisa 11 Oktober | Entry → trigger → close dengan receipt; permission dan lock jelas | Bekukan penambahan sponsor; perbaiki alur inti |
| 12 Oktober | Plan dan sizing; rekonsiliasi; desain mobile; pemakaian di HP | Fokus kasus yang bisa dibuktikan, labeli keterbatasan |
| 13 Oktober siang | Lima sesi pengguna testnet; temuan usability diperbaiki | Catat jumlah sesi sebenarnya dan masalah yang belum selesai |
| 13 Oktober malam | Demo ≤3 menit; pitch singkat; README; submission tersimpan | Hentikan perubahan fitur; periksa materi dan akses juri |
| 14 Oktober sebelum 10:59 WIB | Buffer submission | Jangan jadikan ini waktu memulai integrasi baru |

**Bukti pengguna adalah pekerjaan produk yang perlu dilakukan lu; gue belum menghubungi siapa pun.** Rekrut calon pengguna yang sesuai hipotesis pertama, dengan testnet. Minta mereka menjelaskan rencana trade saat ini, menunjukkan bagian yang membingungkan, lalu mencoba Tready tanpa diarahkan setiap langkah. Lima sesi cukup untuk menemukan friksi awal, tetapi belum membuktikan product-market fit.

Catat waktu login sampai receipt, completion rate dengan denominator, bantuan yang diperlukan, pemahaman estimasi risiko, dan alasan mau/tidak mau memakai lagi. Kutipan harus berasal dari peserta sungguhan. Kontak komunitas, wawancara dan pesan mentor belum dilakukan dalam riset ini.

Distribusi awal yang gue usulkan: satu komunitas trader yang benar-benar bisa lu akses, satu sesi demo kecil, lalu pengguna kembali untuk mengevaluasi receipt trade berikutnya. Model bisnis awal bisa berupa langganan fitur workflow atau biaya integrasi yang transparan; pricing dan kesediaan membayar masih hipotesis. Jangan mengklaim partnership atau traction yang belum ada.

**Demo tiga menit harus memperlihatkan transformasi pengguna dan bukti sistem.** Susunan ini usulan gue, bukan requirement tambahan sponsor.

| Rentang | Adegan |
|---|---|
| 0:00–0:20 | Trader menyebut satu masalah: ukuran posisi dan biaya tidak sesuai rencana |
| 0:20–0:45 | Login Mera di HP; tampilkan saldo AUSD dan akun Perpl |
| 0:45–1:20 | Input rencana; sizing dan estimasi fill; perbedaan mark dan book terlihat |
| 1:20–2:00 | Setujui trade testnet; tampilkan fill dan trigger terkait posisi |
| 2:00–2:25 | Receipt membandingkan rencana dengan eksekusi dan membuka bukti |
| 2:25–2:45 | Storage dibersihkan; akun yang sama pulih dan state nyata dimuat |
| 2:45–3:00 | Temuan pemakaian sebenarnya dan satu langkah lanjutan |

Pitch founder dua menit dilaporkan sebagai deliverable tambahan kartu Track 01; gue sarankan menyiapkannya sambil menunggu konfirmasi kartu. Isinya pengguna pertama, masalah, demonstrasi singkat pembeda, bukti permintaan yang ada, dan rencana empat minggu berikutnya. [Catatan deliverable Track 01](https://github.com/ProofBook-App/proofbook/blob/main/docs/reference/hackathon.md)

**Submission perlu punya peta requirement ke bukti.** Buat satu tabel per sponsor: requirement, layar/demo timestamp, file implementasi, dan transaksi/fill. Foto atau mockup bisa mendukung presentasi; klaim fitur tetap perlu operasi nyata. Bedakan data live, replay dan simulasi di UI serta video.

Verification yang gue sarankan saat implementasi adalah uji angka sizing/rounding, alur passkey dan pemulihan, partial fill/reconnect, trigger ditolak, serta state setelah aplikasi ditutup. Ukur latency aktual yang dirasakan pengguna. Kecepatan jaringan dalam brosur tidak sama dengan waktu seluruh alur aplikasi.

**Pertanyaan yang masih perlu jawaban resmi:** apakah Agora menerima PWA atau APK; berapa award dan pembagian Agora/Mera; apakah kartu Track 01 memakai rubric khusus; bagaimana award overall dan track bisa digabung; apakah automation rencana Tready memenuhi brief Perpl; dan bukti trigger yang diharapkan sponsor. Pertanyaan itu belum dikirim ke mentor/sponsor. Detail bounty katalog masih membutuhkan akun; jawaban peserta bukan konfirmasi organizer.

Keputusan riset gue tetap: targetkan Agora dan Mera lewat satu aplikasi mobile yang dapat dipakai, lalu tambah Perpl API melalui automation yang terbukti. Kuru, analytics besar, dan integrasi data lain mendapat waktu setelah produk inti dan akses juri selesai.
