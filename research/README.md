# Eksperimen risiko Tready

Eksperimen offline buat menguji asumsi konsep, dibuat 11 Oktober 2026. Ini belum aplikasi trading, adapter Perpl, backtest strategi, atau bukti permintaan pengguna.

Jalankan dengan Python 3, tanpa dependency tambahan:

```bash
python research/risk_budget_audit.py
```

Hasil ditulis ke `research/results.json`. Script memakai `Decimal`, membaca fixture publik tersimpan, dan tidak melakukan network request, mengambil kredensial, menandatangani, atau mengirim order.

Fixture berasal dari [context Perpl](https://app.perpl.xyz/api/v1/pub/context) dan [50 level book BTC](https://app.perpl.xyz/api/v1/market-data/1/book?levels=50). Book punya anchor block 112459278, timestamp 11 Oktober 2026 11:41:23 UTC. Context dan book dibaca terpisah; keduanya tidak diklaim satu snapshot atomik. Fixture disimpan supaya hasil bisa direproduksi, bukan untuk menjadi quote trading saat ini.

Skenario BTC memakai entry teratas 82.992,9 AUSD/BTC, stop hipotetis 82.909,9, fee dasar 3,45 bps per leg, lot 0,00001 BTC. Fee berasal dari konfigurasi base tier; integrasi nyata harus membaca tier akun dan fee yang berlaku. Exit pada stop, gap exit sekitar 10 bps, serta pergeseran entry sekitar 10 bps adalah **asumsi simulasi**, bukan fill historis. Book hari ini tidak membuktikan likuiditas saat stop nanti.

| Metode sizing | Quantity BTC | Kondisi yang dihitung | Kerugian model, AUSD |
|---|---:|---|---:|
| Jarak stop saja | 0,06024 | Exit tepat di stop, termasuk dua fee | 8,447845 |
| Fee + entry saat quote | 0,03565 | Exit tepat di stop | 4,999431 |
| Quantity yang sama | 0,03565 | Exit bergeser sekitar 10 bps melewati stop | 7,957360 |
| Fee + batas entry dan exit yang diasumsikan | 0,01632 | Entry 83.075,9; exit 82.826,9 | 4,997780 |
| Quantity yang sama | 0,01632 | Exit 82.744,0, di luar batas asumsi | 6,350241 |

Model memperlihatkan dua hal: fee harus masuk sizing, dan sizing berdasarkan suatu batas harga hanya berlaku selama asumsi harga/biaya itu dipenuhi. Baris terakhir sengaja memperlihatkan kegagalan asumsi; tidak ada hard maximum loss yang dibuktikan.

Verifikasi mencakup 360 kombinasi arah, harga, budget, jarak stop, fee, dan reserve. Setiap kombinasi memeriksa quantity memenuhi model dan penambahan satu lot melampaui budget. Ada 27 kombinasi sampel entry/exit/partial quantity di dalam batas skenario BTC. Ini pemeriksaan numerik, bukan 387 pengujian integrasi exchange. Kasus depth yang tak seluruhnya terlihat menghasilkan `unknown`, bukan VWAP untuk seluruh order.

Perhitungan utama memasukkan kerugian harga dan dua fee taker. Reserve funding pada contoh BTC adalah nol. Pembulatan fee ke atas ke AUSD micros adalah asumsi konservatif model, belum verifikasi rounding settlement. Gas MON, builder fee, funding di luar reserve, likuidasi/ADL, outage, serta harga di luar batas skenario tidak dicakup. Margin affordability juga belum dimodelkan; quantity nyata perlu lolos pemeriksaan collateral, leverage, liquidation headroom, dan status akun.

Sumber mekanisme: [fee Perpl](https://docs.perpl.xyz/exchange/fees), [types dan unit API](https://github.com/PerplFoundation/api-docs/blob/main/types.md), [semantik book REST](https://github.com/PerplFoundation/api-docs/blob/main/rest-endpoints.md), [order types dan trigger](https://docs.perpl.xyz/exchange/order-types).

Riset pendukung PRD Android ada di `research/prd/`: [konfigurasi testnet](prd/testnet-configuration.json), [mainnet](prd/mainnet-configuration.json), [probe read-only](prd/integration-probes.json), [metadata dependency](prd/dependency-observations.json), dan [pemeriksaan dokumen](prd/document-validation.json). Snapshot testnet menunjukkan recycle fee 0,1 AUSD; contoh numerik di atas menggunakan konfigurasi mainnet dengan recycle nol. Model ini belum memverifikasi charging/refund testnet. Seluruh artifact tersebut memisahkan observasi dari rencana implementasi; tidak ada APK atau trade authenticated yang dinyatakan sudah lulus.
