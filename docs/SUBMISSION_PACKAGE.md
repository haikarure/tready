# Tready — submission package

**Status:** engineering preview. Submission belum dikirim. Semua claim di bawah harus sesuai bukti masing-masing; native Mera onboarding belum selesai.

## Review links

- Source: https://github.com/haikarure/tready
- APK/distribution: https://tready-archzxy.netlify.app
- Product requirements: [PRD](PRD.md)
- Technical specification: [TECHNICAL_SPEC](TECHNICAL_SPEC.md)
- Install/recovery: [RUNBOOK](RUNBOOK.md)
- Audit/remediation: [hasil perbaikan](REMEDIATION_2026-10-12.md)
- License/AI attribution: [MIT](../LICENSE), [notice](../third-party/NOTICE.md)

## Product description

Tready membantu trader BTC di Perpl merencanakan quantity berdasarkan budget AUSD, membedakan model risiko dari margin dan hasil aktual, lalu memeriksa fill, cakupan stop dan sisa posisi. Android preview menyediakan Account, Plan, Trade dan Receipt. Semua operasi latihan berlabel synthetic. Tidak ada AI signal, auto-entry, atau jaminan batas kerugian.

Diferensiasi yang bisa didemonstrasikan: conservative integer sizing, review yang terikat parameter/akun, journal tanpa automatic replacement untuk outcome unknown, cakupan stop parsial, dan provenance receipt. Keunggulan terhadap terminal pesaing dan kebutuhan pengguna belum diukur.

## Evidence boundaries

| Bukti | Yang boleh diklaim | Yang belum dibuktikan |
|---|---|---|
| Core tests | Risk/approval/enrollment validation/journal/coverage regression | Seluruh native/device acceptance |
| Browser Mera virtual PRF | Credential/derivation/sign/restore dengan software authenticator | Native provider, hardware biometrics, cloud sync |
| Native Android preview | Build, UI latihan, prompt/cancel, SQLite persistence | Native PRF happy path dan owner funding |
| Actual venue trade | Node adapter entry1lot→native Perpl stop→close, chain receipts dan final flat | Trading dari APK melalui Mera enrollment |
| Repo/APK/video | Artifact yang dapat direview | Traction atau sponsor eligibility |

Chain proof: [entry/stop/close receipts](../artifacts/remediation/trade-evidence.json). Wallet berasal dari key UI venue untuk engineering, bukan identitas Mera yang diklaim telah onboard.

## Demo outline — maksimum3menit sebagai target internal

1. Jelaskan masalah budget loss, margin dan perlindungan posisi.
2. Tampilkan Android preview, public market testnet dan plan/review.
3. Tampilkan alur latihan entry→stop→close→receipt dengan label synthetic tetap terlihat.
4. Tampilkan actual venue proof terpisah beserta chain links; sebutkan Node adapter dan key UI.
5. Jelaskan journal unknown/partial coverage dan gate native onboarding yang masih belum selesai.

[Video UI preview92detik](https://tready-archzxy.netlify.app/downloads/tready-preview-demo.mp4) sudah direkam dengan batas bukti eksplisit. Batas/formats final mengikuti aturan portal yang terkonfirmasi, bukan outline ini.

## Submission gates

- [ ] Native PRF create/recovery pada provider yang mendukung.
- [ ] Wallet yang sama: funding/account/forwarding, API onboarding dan actual APK trade/recovery.
- [ ] Rubric, sponsor cards, eligibility dan bentuk hadiah dari portal resmi.
- [ ] Hasil sesi pengguna eksternal, jika tersedia; target internal5peserta bukan bukti existing traction.
- [ ] Video final dan submission form memenuhi aturan resmi.
- [ ] Submission tersimpan dan bukti penerimaan tersedia.

## Task test untuk calon pengguna

Gunakan token uji/latihan. Minta peserta: (1) jelaskan budget risiko versus margin; (2) buat plan long/short dengan stop; (3) jelaskan apa yang belum terlindungi setelah entry; (4) kenali cakupan stop parsial; (5) tentukan tindakan ketika request unknown; (6) bedakan synthetic receipt dan chain result.

Catat waktu, bantuan yang diperlukan, salah pengertian, apakah tugas selesai, dan kutipan dengan izin. Jangan menghitung dogfooding sebagai pengguna eksternal. Belum ada hasil peserta yang dicatat.
