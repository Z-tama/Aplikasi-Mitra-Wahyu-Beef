# Aplikasi Mitra Wahyu Beef v1.5.0

Tanggal simpan: 2026-06-22 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.5.0**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot / rollback: `https://3d810f09.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-ChGUVIBG.js`
  - CSS: `assets/index-DxJiAqUf.css`

## Isi utama v1.5.0

1. **Promo Juni 2026 dipulihkan**
   - Promo periode Juni 2026 dipulihkan di `src/promotions.ts`.
   - Katalog Mitra otomatis menampilkan harga promo selama promo aktif.
   - Foto/kartu produk kembali menampilkan label `Promo`.
   - Admin assisted-order catalog ikut memakai harga promo dari `getCatalogForPartner()`.
   - Halaman admin `/harga-tier` menampilkan harga normal coret, harga promo, dan label promo.

2. **Dashboard admin dipulihkan**
   - Revenue dashboard kembali memakai order status `Dikirim` / `shipped` pada bulan berjalan.
   - Metric utama kembali: `Pendapatan Bulan Ini`, `Piutang`, `Order Aktif`, `Mitra Aktif`.
   - Icon metric cards dipulihkan.
   - Grafik keuangan upgraded dipulihkan dengan `Belum Tagih`, ring visualization, split track, dan responsive layout.

3. **Peringkat Mitra dipulihkan**
   - Ranking Mitra kembali memakai order status `Dikirim` / `shipped` saja.
   - Label tabel kembali menjadi `Dikirim GMV`.
   - Fallback leaderboard berjalan saat `state.leaderboardRows` kosong.
   - Pending/cancelled/dummy order tidak ikut ranking.

4. **Filter status Order Management dipulihkan**
   - Menu Order Management kembali memiliki kartu `Filter Order Management`.
   - Dropdown `Sort / Filter Status` berisi `Semua Status`, `Dibatalkan`, `Menunggu Konfirmasi`, `Dikonfirmasi`, `Proses Produksi`, `Proses QC`, dan `Dikirim`.
   - Counter hasil dan tombol `Reset Filter` kembali aktif.

5. **Label versi aplikasi**
   - Sidebar menampilkan `Versi Aplikasi v1.5.0`.
   - `package.json` dan `package-lock.json` dibump ke `1.5.0`.

## Verifikasi sebelum disimpan

- `npm run typecheck` ✅
- `npm test` ✅ 13 passing
- `GOMAXPROCS=2 npm run build:all` ✅
- Deploy Cloudflare Pages ke project `aplikasi-mitra-wahyu-beef` ✅
- Deployment snapshot: `https://3d810f09.aplikasi-mitra-wahyu-beef.pages.dev` ✅
- Local deployed build asset `dist/assets/index-ChGUVIBG.js` verified contains:
  - `Versi Aplikasi v1.5.0`
  - `Promo Juni 10%`
  - `Promo Juni 30%`
  - `discount-badge`
  - `admin-price-stack`
  - `Pendapatan Bulan Ini`
  - `Dikirim GMV`
  - `Filter Order Management`
  - `Sort / Filter Status`
  - `Reset Filter`
  - `finance-ring`
  - `dashboard-metrics-primary`
  - `Belum Tagih`
  - `shipped`

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:
`https://3d810f09.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan tag lokal:
`aplikasi-mitra-wahyu-beef-v1.5.0`

## Catatan GitHub

Push ke GitHub masih bergantung pada ketersediaan kredensial SSH/HTTPS yang valid untuk repo private `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`.
