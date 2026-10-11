# Audit ide Tready: cari alasan kalah, lalu perbaiki

Riset 11 Oktober 2026. Lu solo, mulai dari nol, dan belum punya calon pengguna. Deadline resmi 14 Oktober 2026 10:59 WIB. Dokumen ini menggantikan rekomendasi produk dalam `metropolis-strategy.md`; aturan, nominal hadiah, dan sumber di dokumen lama tetap menjadi referensi dengan keterbatasannya.

**Spesifikasi implementasi terkini ada di [PRD Android](PRD.md)** beserta technical spec, backlog dan test plan. Pilihan native mengikuti konfirmasi lu punya Android. Audit ini menyimpan bukti tandingan dan alasan desain; detail scope/build terbaru mengikuti PRD.

**Gue menolak versi awal sebagai dasar klaim “layak juara 1”.** Planning, sizing dari budget, stop-loss, dan receipt belum menjadi pembeda yang kuat. Revisi yang paling masuk akal buat kondisi lu adalah aplikasi mobile yang menguji budget pada batas harga yang disetujui, memeriksa hasil eksekusi, dan membantu memulihkan state yang bermasalah. Itu masih kandidat yang harus dibuktikan, bukan ide yang risetnya sudah menghapus seluruh alasan kalah.

“Ada satu kelemahan” tidak otomatis berarti mustahil menang. Sebaliknya, menutup kelemahan yang kita temukan tidak menjamin juara: kompetitor lain, penilaian juri, dan bukti pengguna belum seluruhnya diketahui. Audit ini memisahkan perbaikan desain, bukti numerik, dan pekerjaan yang masih harus dibuktikan secara langsung.

## Bukti yang membatalkan klaim awal

| Klaim/alternatif | Bukti tandingan | Keputusan |
|---|---|---|
| Input budget + entry + stop lalu ukuran otomatis adalah inovasi utama | Toobit sudah menawarkan Fixed Risk dengan tiga input tersebut dan pemasangan stop. [Pengumuman produk](https://www.toobit.com/en-US/announcement/get-the-right-position-size-for-every-trade-with-fixed-risk) | Gugurkan klaim orisinalitas fitur itu. |
| Membandingkan rencana dengan fill, fee, dan funding cukup jadi pembeda | Costante menjelaskan evaluasi rencana terhadap eksekusi dan biaya. [Panduan vendor](https://www.costante.app/blog/crypto-trading-journal) | Receipt menjadi bukti pendukung, bukan pusat pitch. |
| Pivot ke link rencana yang bisa dieksekusi akan membuka kategori baru | Night Desk sudah mendeskripsikan plan URL, sizing per wallet, bracket, attribution, dan perbandingan plan dengan eksekusi. [Studi vendor](https://www.definitive.fi/blog/night-desk) | Jangan menghabiskan sisa waktu pada pivot ini untuk mengejar novelty. |
| Mera + AUSD + Perpl + guard lebih andal pasti mengalahkan pesaing | Desk mendokumentasikan stack yang sama, copy/shadow, batas exposure/loss, dan native iOS. Kode OrderQuote memuat fee/affordability; OrderTracker membedakan forwarded vs filled dan menangani partial fill. [Submission](https://github.com/frankolien/desk/blob/main/docs/submission.md), [OrderQuote](https://github.com/frankolien/desk/blob/main/DeskKit/Sources/DeskMoney/OrderQuote.swift), [OrderTracker](https://github.com/frankolien/desk/blob/main/DeskKit/Sources/DeskPerpl/OrderTracker.swift) | Basic reliability adalah syarat kualitas. Belum bukti keunggulan atas Desk. |
| Tambahkan AI untuk membuatnya unggul | Tradieon sudah mendeskripsikan plan, risk sizing, approval, dan broker execution. PerplBot punya SDK/CLI, simulator, forensics, dan interface bahasa natural. [Tradieon](https://tradieon.app/ai-trading), [PerplBot](https://github.com/0x70626a/PerplBot) | AI chat tidak masuk MVP. |
| Memasang ulang stop pada posisi tidak terlindungi adalah fitur baru | cTrader mendokumentasikan proteksi mobile; Propcockpit mendokumentasikan posisi tanpa proteksi dan pemasangan stop. [cTrader](https://help.ctrader.com/ctrader-mobile/trading/protections/), [Propcockpit](https://propcockpit.com/docs/terminal/positions) | Recovery penting, tetapi jangan dijual sebagai penemuan kategori baru. |
| Jurnal sederhana bisa sekaligus menang analytics Perpl | Plumb memetakan protocol analytics, wallet performance, funding, liquidation, dan stress. [Pemetaan submission](https://github.com/s0urledd/plumb/blob/main/docs/submission.md) | Keluarkan analytics bounty dari prioritas. |

Sumber produk di atas adalah deskripsi vendor/pengembang. Gue membaca dokumentasi dan sebagian kode Desk, belum menjalankan aplikasi mereka atau mengaudit seluruh implementasi. Pencarian ini bukan daftar lengkap peserta. Keberadaan fitur serupa membatalkan klaim keunikan, bukan membuktikan kualitas seluruh produk mereka.

## Serangan teknis yang bisa direproduksi

Gue membuat [eksperimen offline](../research/README.md) memakai snapshot book BTC publik Perpl, lalu menambahkan skenario exit buatan. Model jarak stop saja menghasilkan kerugian 8,447845 AUSD ketika budget 5. Dengan dua fee taker, quantity turun dari 0,06024 ke 0,03565 BTC dan kerugian pada asumsi exit tepat di stop menjadi 4,999431. Exit sekitar 10 bps lebih buruk membuat kerugian quantity yang sama menjadi 7,957360.

Sizing dengan entry paling buruk 83.075,9 dan exit asumsi 82.826,9 menurunkan quantity menjadi 0,01632 BTC; model di batas itu memberi rugi 4,997780. Jika exit keluar dari batas asumsi menjadi 82.744,0, model tetap rugi 6,350241. Jadi perbaikannya bukan tulisan “max loss 5”; perbaikannya menghitung asumsi secara eksplisit dan menunjukkan bahwa gap di luar asumsi masih bisa menembus budget.

Ini perbandingan dengan baseline naif yang sengaja dibuat, bukan bukti bug Toobit, Desk, atau aplikasi awal Tready. Strategi awal sudah menyebut fee; eksperimen ini menegaskan bahwa fee saja belum cukup menghapus risiko gap. Gas, builder fee, liquidation/ADL, dan funding di luar reserve tidak masuk contoh BTC. Belum ada trade yang dilakukan.

Script memeriksa 360 kombinasi sizing, 27 kombinasi sampel di dalam batas skenario, serta kontrol negatif di luar batas. Semua pemeriksaan numerik berhasil. Itu tidak membuktikan lifecycle order, profitabilitas, atau keselamatan exchange. Fee tier/config aktual dan settlement rounding tetap perlu diverifikasi. [Output angka](../research/results.json), [script](../research/risk_budget_audit.py)

## Revisi produk yang gue pertahankan

**Tready: trade Perpl dari HP dengan budget dalam AUSD, skenario risiko yang terbaca, dan langkah pemulihan ketika hasil/status melenceng.**

Pengguna pertama yang diusulkan adalah trader perp yang sudah memahami stop-loss dan bersedia mencoba Perpl lewat HP. Pengguna harus mengenali masalah sizing/biaya atau state order yang membingungkan dari pengalaman sendiri. “Semua orang yang ingin trading” terlalu luas. Kita belum punya bukti bahwa segmen ini membutuhkan aplikasi terpisah.

Pusat produk berpindah dari *menulis rencana lalu membaca receipt* ke *memeriksa rencana, membatasi parameter entry, dan mengembalikan pengguna ke state yang dipahami*. Budget menentukan quantity pada batas entry dan skenario exit yang dipilih. Marketable limit IOC membatasi harga entry; kualitas fill tetap bisa berubah dan quantity dapat terisi sebagian. Batas exit masa depan adalah asumsi, bukan kontrak yang menjamin stop terisi. [Order types Perpl](https://docs.perpl.xyz/exchange/order-types)

| Tahap | Perilaku yang diusulkan | Bukti selesai |
|---|---|---|
| Periksa | Arah, invalidasi, budget AUSD; tampilkan biaya dan kerugian model pada stop serta skenario gap. Quote basi/coverage book tidak cukup menghasilkan state belum bisa dihitung. | Precision runtime, fee tier, rounding, dan penjelasan asumsi benar pada beberapa input. |
| Entry | Ukuran dihitung pada harga entry terburuk yang diizinkan, bukan hanya mark. Pengguna menyetujui harga, quantity, dan skenario. | Payload aktual cocok dengan rencana yang disetujui; transaksi dan fill testnet tersedia. |
| Konfirmasi | Forwarded tetap pending. Setelah fill, periksa posisi aktual, fee, trigger penutup, arah dan keterkaitannya. | Pengguna dapat melihat selisih plan/fill; tidak ada label “terlindungi” hanya berdasarkan acknowledgment. |
| Pulihkan | Status tidak jelas menahan entry baru di Tready. Pengguna mendapat pilihan cek ulang, pasang proteksi setelah state jelas, atau close reduce-only dengan konfirmasi. | Reconnect tidak menciptakan entry kedua; close yang gagal/partial tetap menampilkan sisa posisi. |
| Evaluasi | Receipt merekonsiliasi fill, fee, funding yang tersedia, dan tindakan pemulihan. | Sumber/block/timestamp terbaca; replay dipisahkan dari transaksi nyata. |

Hipotesis pembeda yang perlu diuji: trader lebih mudah menjaga rencananya ketika budget terhubung ke batas harga order dan aplikasi memberi tindakan spesifik saat hasil tidak sesuai. Gue belum menemukan bukti cukup bahwa kombinasi ini unik secara global atau lebih dibutuhkan daripada terminal yang sudah ada. Keunggulan harus berasal dari hasil tugas pengguna dan implementasi yang bisa diperiksa.

Scope: satu akun Mera, BTC saja, maksimal satu posisi aktif yang dikelola Tready, empat layar Account/Plan/Trade/Receipt. Tidak ada copy trading, AI signal, vault, token baru, atau market baru. Menghilangkan fitur tersebut adalah pilihan waktu, bukan klaim bahwa pesaing salah membangunnya.

Akun Mera yang diturunkan dari passkey dapat berbeda dari wallet Perpl lama pengguna. MVP membuat/fund akun tersebut; jangan menjanjikan seluruh posisi wallet lama ikut berpindah. Pemulihan identitas lewat passkey juga tidak memulihkan local plan yang sudah dihapus. Jika demo meminta clear-storage recovery beserta rencana lama, perlu backup rencana yang dapat dipulihkan, atau UI harus jelas menyebut rencana tidak tersedia dan memuat state venue. [Mera](https://github.com/category-labs/mera)

## Semua alasan kalah yang ditemukan dan cara menanganinya

| Alasan kalah | Perbaikan yang konkret | Status setelah riset |
|---|---|---|
| Fitur inti pasaran | Cabut klaim “pertama”; fokus pada budget pada batas harga, state aktual, dan recovery. Bandingkan tugas yang sama dengan terminal Perpl. | Desain direvisi; novelty dan preferensi belum terbukti. |
| Pesaing lebih lengkap | Batasi satu tugas; buktikan waktu, completion, pemahaman budget, dan kualitas recovery. Jangan memakai jumlah test pesaing sebagai skor kualitas. | Belum ada benchmark aplikasi. |
| Budget menyesatkan | Label estimasi beserta asumsi; masukkan fee, reserve, dan harga buruk yang disetujui. Tampilkan juga collateral dan kemungkinan rugi di luar skenario. | Bukti numerik tersedia; implementasi belum ada. |
| Stop terlihat ada tetapi belum terdaftar/terisi | Verifikasi snapshot order/position; gunakan native linked trigger dan CloseLong/CloseShort. Tampilkan “trigger terdaftar”, bukan janji exit atau posisi bebas risiko. | Semantik dokumentasi dibaca; live belum diuji. |
| Retry membuat order kedua | Journal request per account; gunakan `rq` yang sama sesuai semantik API. Setelah disconnect, rekonsiliasi sebelum request baru. | Spesifikasi tersedia; adapter belum dibuktikan. |
| Partial close dianggap selesai | Bandingkan remaining position dengan snapshot/fill; pertahankan state pending/remaining. Close* reduce-only tidak berarti pasti berhasil. | Acceptance case tersedia. |
| Equity/free collateral dihitung dari data yang belum koheren | Verifikasi makna fields dan anchor snapshot; jangan menebak current equity dari cumulative realized PnL. Data belum memadai harus terlihat unknown dan menahan entry. | Belum ada akun authenticated untuk pembuktian. |
| Guard hanya UI | Nyatakan cakupannya: menahan entry melalui Tready, tidak mencegah transaksi dari klien lain atau kehilangan collateral. | Klaim diperbaiki; bukan onchain hard cap. |
| Recovery berhenti ketika app ditutup | Trigger venue yang sudah diterima berbeda dari monitoring Tready. MVP rekonsiliasi saat resume; monitoring/repair selalu aktif perlu service tersendiri. | Batas produk ditetapkan. |
| Mera native/PRF tidak berjalan di device | Uji perangkat sejak spike; demo Expo resmi bukan aplikasi Perpl siap pakai. Pakai satu platform yang bisa diakses juri. | Belum diuji di perangkat. |
| PWA tidak memenuhi Agora | Verifikasi kartu/mentor; kalau native wajib, siapkan native dengan bukti device atau keluarkan Agora dari target. | Masih belum terkonfirmasi. |
| Automation tidak memenuhi Perpl API | Cocokkan requirement satu per satu. Bot/profitability brief bisa lebih luas daripada risk workflow; jangan menambah backtest asal-asalan. | Target bersyarat. |
| Tidak ada calon pengguna | Rekrut untuk tugas spesifik; catat baseline dan hasil aktual. Tester yang hanya memuji mockup belum membuktikan kebutuhan. | Gap terbesar yang belum tertutup. |
| Tidak ada distribusi/bisnis | Pilih satu saluran rekrut yang benar-benar memberi respons; uji niat mencoba ulang lewat tindakan. Pricing/integrator fee masuk setelah biaya dan willingness terbukti. | Masih hipotesis. |
| Solo dengan tenggat pendek | Batasi scope; spike integrasi sebelum polish. Kalau core tidak bekerja, hentikan perluasan sponsor dan turunkan klaim readiness. | Jadwal dan batas scope tersedia. |
| Monad hanya tempelan | Buktikan actual Perpl account/trade/settlement di Monad dan pemulihan state nyata. Ukur latency aplikasi bila dipakai dalam pitch. | Endpoint publik terbaca; transaksi belum ada. |
| Demo hanya simulasi | Pisahkan live, replay, dan stress; tampilkan hash/fill/account/chain. Video harus menunjukkan produk yang beroperasi. | Eksperimen dilabeli; demo live belum ada. |

Dasar teknis: [WebSocket Perpl](https://github.com/PerplFoundation/api-docs/blob/main/websocket.md), [types](https://github.com/PerplFoundation/api-docs/blob/main/types.md), [snapshots REST](https://github.com/PerplFoundation/api-docs/blob/main/rest-endpoints.md), [Mera mobile](https://github.com/category-labs/mera/blob/main/demos/mobile/README.md).

Request ID at-most-once berlaku pada API; jangan menggeneralisasikannya ke direct contract order. `mt:3` sukses menunjukkan forwarding, bukan fill; kondisi retry tergantung status, expiry, dan apakah aliran block sempat terputus. Tidak ada atomic entry+stop yang dibuktikan dalam riset ini. Perpl close-only dapat tetap gagal karena kondisi settlement. Ini harus menjadi kasus integrasi, bukan sekadar pesan UI.

Untuk valuation, issue publik #15 meminta artifact equity/free collateral yang atomik. Itu **permintaan dokumentasi seorang integrator**, bukan bukti endpoint tidak ada atau venue salah. REST mendokumentasikan anchor untuk wallet/orders/positions secara masing-masing; anchor tersebut belum membuktikan beberapa panggilan terpisah atomik bersama. Issue #17 melaporkan alamat collateral testnet lama; pembacaan context kita juga menemukan AUSD yang berbeda dari tabel README lama. Issue #7 menunjukkan kebingungan unit leverage; dokumentasi margin menggunakan denominator margin yang analog dengan leverage. Verifikasi units lewat sumber resmi/schema dan payload aktual, bukan formula terbalik. [Issue 15](https://github.com/PerplFoundation/api-docs/issues/15), [issue 17](https://github.com/PerplFoundation/api-docs/issues/17), [issue 7](https://github.com/PerplFoundation/api-docs/issues/7), [margin](https://docs.perpl.xyz/exchange/margin)

PnL receipt juga perlu hati-hati: AccountStats.trp didokumentasikan sudah net of fees. Menampilkan fees terpisah lalu menguranginya lagi dari angka net akan menghitung dua kali. Fee pada position snapshot dan event memiliki arti berbeda; reconciliation perlu fixtures yang benar dan akun nyata.

## Jalan pembuktian meskipun belum punya pengguna

Gate berikut adalah standar internal usulan gue, bukan rubric resmi atau bukti statistik product-market fit.

1. **Cari 8–10 orang yang memenuhi segmen**, melalui saluran hackathon/Perpl yang boleh dipakai sesuai aturan komunitas. Target memperoleh lima sesi, bukan mengaku punya lima pengguna sebelum ada yang mencoba. Belum ada outreach yang dikirim.
2. **Wawancara singkat sebelum demo.** Minta contoh terakhir mereka menyusun size, memeriksa stop, atau menghadapi status order yang tidak jelas. Catat kejadian yang benar-benar pernah dialami; jangan mengajari masalah dulu lalu meminta persetujuan.
3. **Bandingkan tugas pada testnet.** Tugas: menentukan size dari budget dengan fee, memahami skenario gap, mencari status entry setelah reconnect, dan memahami sisa posisi setelah partial close. Urutan baseline/Tready dibalik antar peserta untuk mengurangi bias belajar. Hindari skenario outage palsu yang disajikan sebagai kejadian venue nyata.
4. **Gate kelayakan internal:** minimal tiga dari lima peserta mampu menunjukkan masalah relevan dari pengalaman; minimal empat menyelesaikan alur Tready tanpa bantuan besar dan menjelaskan bahwa budget bukan hard cap; minimal dua memilih mencoba lagi melalui tindakan nyata. Jika tidak, revisi positioning/alur dan uji ulang; jangan ganti kegagalan dengan testimonial buatan.
5. **Catat denominator.** Undangan, respons, sesi qualified, completion, waktu, bantuan, pemahaman asumsi, dan penggunaan ulang. Lima sesi menemukan friksi; belum membuktikan market size, retention, revenue, atau kemampuan mengalahkan semua pesaing.

Contoh pesan rekrut yang bisa lu kirim: “Lagi bikin workflow Perpl di HP. Gue cari trader perp buat coba testnet 15 menit: dari budget sampai ngecek status order. Gue pengin lihat bagian yang membingungkan dan yang nggak berguna. Ada pengalaman size/fee/stop atau pending order yang bikin repot?” Pesan ini draft; belum dikirim atau dipublikasikan.

Kalau tidak ada peserta qualified sebelum deadline, submission masih bisa menunjukkan engineering, tetapi klaim permintaan pasar belum layak dipakai. Riset desktop tidak dapat menggantikan gap tersebut. Kita bisa membuktikan operasi sistem sendiri; kita tidak bisa mengubah dogfooding menjadi traction eksternal.

## Pilihan sponsor dan syarat lanjut

Pertahankan **Agora mobile trading** sebagai target hadiah besar yang bersyarat, dan **Mera UX** sebagai bukti akun. **Perpl API** hanya ditambahkan jika workflow memenuhi kartu automation terkini dan operasi nyata selesai. Analytics Perpl, Kuru, serta sponsor data lain keluar dari rencana awal agar tidak memecah waktu. Ini keputusan scope, bukan larangan mengikuti bounty lainnya.

Landing publik menyebut Agora mobile $10.000 dan Mera UX $2.500. Perpl API $5.000 adalah pool; catatan peserta melaporkan dua award $2.500. Detail Agora yang mewajibkan Mera+AUSD+Perpl dan penerimaan PWA masih bersumber dari catatan peserta/masih terbuka. Jangan menjumlahkannya sebagai hadiah pasti satu tim. [Landing resmi](https://monad.xyz/developers/hackathons/metropolis), [catatan kartu](https://github.com/ProofBook-App/proofbook/blob/main/docs/reference/hackathon.md)

Rules v3 memberi lima dimensi main-track masing-masing 20%; sponsor memberi brief adherence 40%, teknis 30%, Monad 20%, inovasi 10%. Artinya fitur yang benar-benar baru tidak menggantikan kelengkapan dan kesesuaian brief. Rules juga meminta functioning prototype, repo publik berlisensi OSI, atribusi/disclosure AI, dan demo operasi maksimal tiga menit; testnet boleh. Catatan peserta melaporkan rubric Track 01 berbeda dan pitch tambahan, belum konfirmasi kartu terkini. [Rules resmi](https://hackathon.monad.xyz/api/v1/policies/current)

Urutan kerja yang disarankan selama sisa tenggat:

| Tahap | Gate keputusan |
|---|---|
| Spike maksimal enam jam kerja pertama | Satu device Mera; AUSD/account Perpl; entry/close testnet; akses juri; brief Agora/platform. Jika belum beres, potong scope dan berhenti menjual rencana sebagai app siap. |
| Core sebelum polish | Entry bound/fee/size; linked trigger dan state aktual; reconnect tanpa duplicate; remaining position dan receipt. |
| Validasi berjalan bersamaan dengan build | Rekrut qualified sejak awal, bukan sesudah seluruh layar selesai. Perbaiki salah pengertian budget dan status. |
| 13 Oktober malam WIB | Bekukan fitur; rekam demo; README runnable; peta requirement ke bukti; simpan submission. |
| 14 Oktober sebelum 10:59 WIB | Buffer pengiriman, bukan waktu memulai integrasi baru. |

Demo usulan: Mera dan AUSD → rencana budget dengan dua skenario → entry nyata → fill/trigger terkonfirmasi → satu recovery yang benar-benar diuji → receipt. Replay failure dapat ditunjukkan dengan label, tetapi trade normal dan pemulihan akun harus berupa operasi nyata bila diklaim demikian. Jangan mengklaim “lebih cepat dari Desk” sebelum benchmark.

## Putusan setelah audit

Versi awal ditolak sebagai pitch juara. Revisi budget pada batas harga + pemeriksaan eksekusi + recovery merupakan kandidat yang lebih dapat dipertanggungjawabkan untuk scope solo. Perbaikan angka punya bukti offline; kebutuhan pengguna, keunggulan UX, authenticated integration, platform mobile, dan brief sponsor belum terbukti.

Produk baru layak kita ajukan sebagai **kandidat kuat** setelah gate tersebut punya bukti. Saat ini ia belum sampai di sana. Menyatakan seluruh kelemahan sudah ditutup akan membuat laporan ini lebih optimistis daripada fakta yang kita punya.
