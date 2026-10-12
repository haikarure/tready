# Perbaikan audit Tready — 12 Oktober 2026

Tiga celah kode A1–A3 diperbaiki pada source kandidat0.1.1/build4. Bukti audit awal dipertahankan; hasil baru ada di `artifacts/remediation/`. APK/distribusi dilaporkan setelah build dan smoke checks selesai.

| Temuan | Perubahan | Verifikasi |
|---|---|---|
| A1 Enrollment | Graph field/type lengkap, Origin/label/statement/CIDR/builder terms, salt dan challenge time diperiksa sebelum signature; respons key diperiksa; legacy policy ditolak | Mutasi audit ditolak; mocked enrollment memverifikasi EIP712 owner signature dan Ed25519 PoP |
| A2 Journal | Guard transisi atomik di SQLite; outcome non-failure immutable; late success setelah failure diizinkan; legacy seen/status inconsistency diperbaiki saat restart | Fault injection tetap settled; SQLite tests untuk ack/disconnect/late success/restart |
| A3 Stop coverage | Quantity remaining dan lifecycle diperiksa; stop parsial ditampilkan; repair melalui cancel→confirmed→review/replacement; multiple stops tidak dijumlahkan | 1/100 lot menjadi partial-protection; triggered/unknown/multiple tidak menjadi active |
| A4 Onboarding | Import key venue tersedia dengan signed wallet/instance check, SecureStore, session guard, local TTL24jam | Import mock tests menolak wallet lain dan session expiry; own Origin masihHTTP400 |
| A5 APK | Kandidat0.1.1/build4 membawa source perbaikan; output APK mengikuti versi embedded | Build/download checks menyusul |
| A6 Submission | Dokumentasi, disclosure, actual venue proof dan source siap diterbitkan | Repo/video/users/eligibility mengikuti bukti masing-masing |

65tests core lulus; tidak berarti64 acceptance Android selesai. Actual venue smoke menyelesaikan entry1lot→native stop full→close dengan3request settled dan final flat. Pengujian ini memakai Node dan API key UI venue; tidak menggunakan Mera native atau owner private key. Testnet virtual collateral dipakai untuk satu siklus kecil. Tidak ada mainnet route.

Import key adalah jalur yang didokumentasikan Perpl, bukan pengganti bukti auto-enrollment. App tidak menyediakan koneksi wallet Mera ke UI Perpl; key harus sudah tersedia untuk wallet yang sama. Key engineering lokal yang dipakai pada Node berasal dari wallet lain dan ditolak jika dipaksakan ke identitas Mera.

Gate eksternal tetap nyata: PRF-capable Android provider belum mempunyai happy-path evidence; Origin aplikasi belum diterima vendor; belum ada pengguna eksternal, kartu sponsor/rubric terkonfirmasi, atau submission terkirim. Audit/code fixes tidak membuktikan peluang juara.

Referensi: [audit awal](IMPLEMENTATION_AUDIT_2026-10-12.md), [regresi](../artifacts/remediation/invariants.json), [core tests](../artifacts/remediation/core-tests.json), [venue trade](../artifacts/remediation/trade-smoke.json), [Origin](../artifacts/remediation/origin.json), [dokumen Perpl](https://github.com/PerplFoundation/api-docs/blob/main/integrations.md).

Bukti chain entry/stop/close berhasil direkonsiliasi melalui order history dan receipt RPC: [trade-evidence](../artifacts/remediation/trade-evidence.json). Zero txid pada lifecycle cancellation tidak ditampilkan sebagai transaksi. [Enam kasus journal SQL pada Android](../artifacts/remediation/android-journal-sql.json) lulus; ini memeriksa engine SQL, terpisah dari API Expo dan migrasi startup.
