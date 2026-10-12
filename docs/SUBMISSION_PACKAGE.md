# Tready — submission package

**Status:** engineering preview. Submission belum dikirim. Semua claim di bawah harus sesuai bukti masing-masing; native PRF create/restore sudah terverifikasi di emulator; funding, enrollment dan actual APK trade belum selesai.

## Review links

- Source: https://github.com/haikarure/tready
- APK/distribution: https://tready-archzxy.netlify.app
- Release: https://github.com/haikarure/tready/releases/tag/v0.1.4
- Demo129detik: https://tready-archzxy.netlify.app/downloads/tready-preview-demo.mp4
- Live RPC proof: https://tready-archzxy.netlify.app/proof.html
- Product requirements: [PRD](PRD.md)
- Technical specification: [TECHNICAL_SPEC](TECHNICAL_SPEC.md)
- Install/recovery: [RUNBOOK](RUNBOOK.md)
- Audit/remediation: [hasil perbaikan](REMEDIATION_2026-10-12.md)
- License/AI attribution: [MIT](../LICENSE), [notice](../third-party/NOTICE.md)

## Product description

Tready membantu trader BTC di Perpl merencanakan quantity berdasarkan budget AUSD, membedakan model risiko dari margin dan hasil aktual, lalu memeriksa fill, cakupan stop dan sisa posisi. Android preview menyediakan Account, Plan, Trade dan Receipt. Semua operasi latihan berlabel synthetic. Tidak ada AI signal, auto-entry, atau jaminan batas kerugian.

Diferensiasi yang bisa didemonstrasikan: conservative integer sizing, review yang terikat parameter/akun, journal tanpa automatic replacement untuk outcome unknown, cakupan stop parsial, dan provenance receipt. Keunggulan terhadap terminal pesaing dan kebutuhan pengguna belum diukur.

## Isi draft portal

Sesuaikan nama field dengan portal setelah login. Founder mengisi profil/identitas, persetujuan, kontak dan wallet penerima hadiah sendiri. Pilihan bounty menunggu kartu resmi.

| Field | Isi |
|---|---|
| Project | Tready |
| Team | Solo; nama founder sesuai akun portal |
| Track | Onchain Finance & Trading |
| Tagline | Plan a BTC perp trade, inspect stop coverage, and verify its receipts on Monad. |
| Source | https://github.com/haikarure/tready |
| Demo | https://tready-archzxy.netlify.app/downloads/tready-preview-demo.mp4 |
| Product | https://tready-archzxy.netlify.app |
| Network | Monad Testnet, chain10143 |
| License | MIT |
| Stack | TypeScript, Expo/React Native, Mera0.2.0, react-native-passkey3.6.1, viem, Perpl REST/WebSocket, Ed25519, Expo SQLite/SecureStore, Vitest |

**Description:** Tready is an Android prototype for planning BTC perpetual trades on Perpl. It sizes orders from an AUSD risk budget using integer arithmetic, binds approval to the reviewed plan, journals uncertain execution outcomes without automatically replacing entries, and distinguishes registered stop coverage from filled positions. The preview shows a labelled practice workflow and public testnet market data. The Node execution adapter completed entry/full-stop/close and disconnect recovery on Monad Testnet; three receipts can be independently checked through public RPC. Native Mera PRF create and same-wallet recovery have been verified with a real Android emulator provider. Funding and API enrollment remain integration gates, so trading from the APK is not claimed.

**Monad integration:** Reads and transaction receipts use Monad Testnet10143. The app integrates existing Perpl exchange/AUSD contracts; it does not deploy a new Tready contract. Exchange `0x1964c32f0be608e7d29302aff5e61268e72080cc`, collateral `0xa9012a055bd4e0edff8ce09f960291c09d5322dc`, AUSD faucet `0xd236c18d274e54faccc3dd9dda4b27965a73ee6c`. The README links the three confirmed entry/stop/close transactions and states that they originated from Node.

**AI disclosure:** Research, product specifications, application code and tests were developed with OpenAI Codex. Generated code, synthetic tests and browser virtual PRF evidence are distinguished from native-device and actual venue evidence.

## Evidence boundaries

| Bukti | Yang boleh diklaim | Yang belum dibuktikan |
|---|---|---|
| Core tests | Risk/approval/enrollment validation/journal/coverage regression | Seluruh native/device acceptance |
| Browser Mera virtual PRF | Credential/derivation/sign/restore dengan software authenticator | Native provider, hardware biometrics, cloud sync |
| Native Android preview | Build, UI latihan, prompt/cancel, SQLite persistence, native PRF create dan same-wallet restore setelah restart | Owner funding, hardware biometrics, provider cloud sync dan actual APK trade |
| Actual venue trade | Node adapter entry1lot→native Perpl stop→close, chain receipts dan final flat | Trading dari APK melalui Mera enrollment |
| Repo/APK/video | Artifact yang dapat direview | Traction atau sponsor eligibility |

Chain proof: [entry/stop/close receipts](../artifacts/remediation/trade-evidence.json). Trade Node memakai key UI venue untuk engineering. Wallet Mera native diuji terpisah: [native PRF proof](../artifacts/completion/native-prf.json), [funding checkpoint](../artifacts/completion/wallet-readiness.json).

## Demo outline — video3menit menurut Rules v3

1. Jelaskan masalah budget loss, margin dan perlindungan posisi.
2. Tampilkan Android preview, public market testnet dan plan/review.
3. Tampilkan alur latihan entry→stop→close→receipt dengan label synthetic tetap terlihat.
4. Tampilkan actual venue proof terpisah beserta chain links; sebutkan Node adapter dan key UI.
5. Jelaskan journal unknown/partial coverage dan gate native onboarding yang masih belum selesai.

[Video preview129detik](https://tready-archzxy.netlify.app/downloads/tready-preview-demo.mp4) sudah dipublikasikan: UI APK build7 berlabel synthetic, state wallet setelah native PRF clear-data recovery, lalu browser memeriksa tiga receipt Node melalui RPC live. Video128,83detik berada di bawah3menit; bagian wallet memakai screenshot aplikasi setelah recovery nyata; autentikasi privat tidak direkam. Funding dan actual APK trading masih belum selesai. [Verifikasi RPC live](https://tready-archzxy.netlify.app/proof.html). Ketentuan kartu sponsor tetap perlu diperiksa terpisah.

## Submission gates

- [x] Native PRF create dan same-wallet recovery setelah restart di emulator/provider yang diuji. Discoverable restore setelah clear app data juga lulus pada build7.
- [ ] Wallet yang sama: funding/account/forwarding, API onboarding dan actual APK trade/recovery.
- [ ] Rubric, sponsor cards, eligibility dan bentuk hadiah dari portal resmi.
- [ ] Hasil sesi pengguna eksternal, jika tersedia; target internal5peserta bukan bukti existing traction.
- [ ] Video final dan submission form memenuhi aturan resmi.
- [ ] Submission tersimpan dan bukti penerimaan tersedia.

## Task test untuk calon pengguna

Gunakan token uji/latihan. Minta peserta: (1) jelaskan budget risiko versus margin; (2) buat plan long/short dengan stop; (3) jelaskan apa yang belum terlindungi setelah entry; (4) kenali cakupan stop parsial; (5) tentukan tindakan ketika request unknown; (6) bedakan synthetic receipt dan chain result.

Catat waktu, bantuan yang diperlukan, salah pengertian, apakah tugas selesai, dan kutipan dengan izin. Jangan menghitung dogfooding sebagai pengguna eksternal. Belum ada hasil peserta yang dicatat.
