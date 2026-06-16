# Aplikasi Mitra Wahyu Beef v1.3.1

Tanggal simpan: 2026-06-12 10:04 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.3.1**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot / rollback: `https://110e111d.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-DyR9PbUg.js`
  - CSS: `assets/index-pTVZnDc7.css`

## Isi utama v1.3.1

1. **Notifikasi email order otomatis via Resend**
   - Order baru sekarang mengirim email otomatis melalui Resend API dari Cloudflare Pages Functions.
   - Sender produksi: `Wahyu Beef Mitra <noreply@wahyubeef.id>`.
   - Recipient produksi: `wahyubeef.id@gmail.com`.
   - Resend diprioritaskan jika `RESEND_API_KEY` tersedia.
   - Fallback lama `EMAIL_RELAY_URL` / `EMAIL_RELAY_API_KEY` tetap tersedia jika Resend tidak dipakai.
   - Email memakai template branded Wahyu Beef dan bersifat non-blocking: order tetap berhasil walau email gagal.
   - Audit mencatat hasil sebagai `EMAIL_ORDER_CREATED_SENT` atau `EMAIL_ORDER_CREATED_FAILED` dengan provider `resend` atau `relay`.

2. **WAHA dan email notification flow dipisahkan**
   - `notifyOrderCreated` tidak lagi berhenti hanya karena konfigurasi WAHA tidak lengkap.
   - Sistem mencoba WAHA bila config tersedia, lalu tetap mencoba email jika provider email tersedia.
   - WAHA order-created tetap aktif untuk admin kemitraan.

3. **Kolom QC di format cetak order**
   - Dokumen `ORDER` / print order sekarang punya kolom baru **QC** di paling kanan setelah kolom **Catatan**.
   - Isi kolom QC sengaja kosong untuk checklist/pengecekan tim QC lapangan.
   - Kolom QC hanya muncul pada line items yang memakai kolom Catatan, sehingga invoice/tabel lain tidak ikut berubah.
   - CSS print A4 dirapikan agar kolom SKU, Produk, Qty, Harga, Total, Catatan, dan QC tetap muat.

4. **Label versi aplikasi**
   - Sidebar sekarang menampilkan `Versi Aplikasi v1.3.1`.

## Verifikasi sebelum disimpan

- `npm run typecheck` ✅
- `npm test` ✅ 9 passing
- `GOMAXPROCS=2 npm run build:all` ✅
- Deploy Cloudflare Pages ke project `aplikasi-mitra-wahyu-beef` ✅
- Live `https://mitra.wahyubeef.id` memuat asset:
  - `index-DyR9PbUg.js`
  - `index-pTVZnDc7.css`
- Live JS/CSS mengandung marker fitur v1.3.1:
  - `Versi Aplikasi v1.3.1`
  - `QC`
  - `line-item-qc-cell`

## Verifikasi notifikasi order

- Resend direct API test berhasil setelah domain `wahyubeef.id` verified.
- Live order test berhasil dibuat:
  - Order: `ORD-202606-0005`
  - ID: `ord-1781228841714`
  - Partner: B Organik / `p-mwb-b-organik-3022`
- Audit production D1 terkonfirmasi:
  - `EMAIL_ORDER_CREATED_SENT`
  - provider `resend`
  - status `200`
  - ok `true`
- WAHA juga terkonfirmasi untuk order yang sama:
  - `WAHA_ORDER_CREATED_SENT`
  - status `201`
  - ok `true`

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:

`https://110e111d.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan tag lokal:

`aplikasi-mitra-wahyu-beef-v1.3.1`

## Catatan keamanan

- Resend API key, Domainesia API token, dan kredensial SMTP pernah terlihat di chat/screenshot selama setup.
- Setelah setup stabil, sebaiknya rotate/revoke secret yang pernah terekspos.
- Jangan menulis raw secret ke repo, docs, memory, atau chat lanjutan.

## Catatan operasional

- Test order `ORD-202606-0005` masih pending dan diberi catatan `TEST_EMAIL_RESEND`; bisa dibatalkan/dibersihkan setelah disetujui owner.

## Catatan GitHub

Push ke GitHub masih bergantung pada ketersediaan kredensial SSH/HTTPS yang valid untuk repo private `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`.
