# Aplikasi Mitra Wahyu Beef v1.3.0

Tanggal simpan: 2026-06-05 22:10 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.3.0**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot / rollback: `https://d53b3c56.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-BCD_v1jE.js`
  - CSS: `assets/index-DzJYcHYO.css`

## Isi utama v1.3.0

1. **Order Saya: tombol Batalkan untuk mitra**
   - Akun mitra bisa membatalkan order miliknya sendiri dari menu `Order Saya`.
   - Tombol `Batalkan` hanya muncul untuk order status `pending` dan `confirmed`.
   - Order yang sudah masuk proses / dispatching tidak bisa dibatalkan oleh mitra.
   - Backend endpoint `PATCH /api/v1/orders/:id/cancel` punya guard partner-only, own-order-only, dan status-only.

2. **Pembersihan data dummy order dan reset ranking**
   - Order dummy/test live dibersihkan dari menu admin dan menu `Order Saya` mitra.
   - `orders`, `statusHistories`, `invoices`, `deliveryNotes`, `payments`, dan event accounting terkait transaksi dummy dikosongkan.
   - `leaderboardRows` direset agar ranking mulai dihitung dari order asli baru.
   - Data utama tetap dipertahankan: mitra, user, produk, harga, profil, dan katalog.
   - Backup sebelum mutasi live: `backups/mitra-app-state-before-dummy-order-leaderboard-reset-20260605-213655.json`.

3. **Checkout page: rincian pesanan proper**
   - Checkout menampilkan:
     - `Total Pesanan`
     - `Total Berat`
     - `Biaya Sterofoam`
     - `Diskon`
     - `Total Tagihan`
   - Baris item sterofoam otomatis tampil di daftar item paling bawah, setelah semua produk dan sebelum rincian pesanan.

4. **Sterofoam otomatis berdasarkan berat**
   - Sterofoam kecil: Rp20.000 untuk 1-15kg.
   - Sterofoam sedang: Rp30.000 untuk 15-30kg.
   - Sterofoam besar: Rp50.000 untuk 30-50kg.
   - Kalkulator memakai box besar dulu, lalu sisa berat memakai box yang sesuai.
   - Contoh 120kg otomatis menjadi 2 pcs sterofoam besar + 1 pcs sterofoam sedang.
   - Backend menyimpan biaya kemasan ke `packingFee`, tipe/qty packing, dan menambahkan item order `packaging-styrofoam-*`.
   - `grandTotal` order sudah termasuk biaya sterofoam.
   - Leaderboard mengecualikan item `packaging-*` supaya pcs sterofoam tidak menambah qty produk.

5. **Default berat processed meat**
   - Produk kategori `cat-processed-meat` yang punya unit jelas seperti `100 GR`, `200 GR`, `500 GR` tetap memakai gram asli.
   - Produk olahan tanpa info gram/kg seperti `POTONG`, `PACK`, `JAR`, `EKOR`, atau `PCS` default menjadi **250gr per pcs** untuk perhitungan berat dan sterofoam.

6. **Label versi aplikasi**
   - Sidebar sekarang menampilkan `Versi Aplikasi v1.3.0`.

## Verifikasi sebelum disimpan

- `npm run typecheck` ✅
- `npm test` ✅ 9 passing
- `GOMAXPROCS=2 npm run build:all` ✅
- Deploy Cloudflare Pages ke project `aplikasi-mitra-wahyu-beef` ✅
- Live `https://mitra.wahyubeef.id` memuat asset:
  - `index-BCD_v1jE.js`
  - `index-DzJYcHYO.css`
- Live JS mengandung marker fitur v1.3.0:
  - `Versi Aplikasi v1.3.0`
  - `Batalkan`
  - `Total Tagihan`
  - `Biaya Sterofoam`
  - `cat-processed-meat`

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:

`https://d53b3c56.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan tag lokal:

`aplikasi-mitra-wahyu-beef-v1.3.0`

## Catatan GitHub

Push ke GitHub masih bergantung pada ketersediaan kredensial SSH/HTTPS yang valid untuk repo private `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`.
