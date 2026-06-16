# Aplikasi Mitra Wahyu Beef v1.4.0

Tanggal simpan: 2026-06-16 12:05 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.4.0**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot / rollback: `https://b61d2f3a.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-fKqu215p.js`
  - CSS: `assets/index-CUt8NXQ8.css`

## Isi utama v1.4.0

1. **Order Management 5 tahap**
   - Status order admin disederhanakan menjadi: `Menunggu Konfirmasi`, `Dikonfirmasi`, `Proses Produksi`, `Proses QC`, dan `Dikirim`.
   - Kolom aksi order hanya menampilkan tombol **Detail**.
   - Popup detail order berisi pilihan update status.

2. **QC order dan % kesesuaian**
   - Pada status **Proses QC**, admin dapat menginput qty hasil QC per item.
   - Tabel order menampilkan kolom **% Kesesuaian** berdasarkan qty permintaan vs qty hasil QC.
   - Hasil QC tersimpan di item order sebagai `qcDeliveredQty`.
   - Subtotal dan grand total mengikuti qty hasil QC.

3. **QC packaging / sterofoam**
   - Baris packaging/sterofoam ikut muncul di panel QC.
   - Admin dapat menginput qty packaging sebenarnya setelah QC.
   - Jika packaging dikurangi atau dihapus, `packingFee`, `packingQuantity`, `packingType`, dan `grandTotal` ikut berubah.
   - Dokumen cetak order menampilkan qty QC untuk baris produk dan packaging.

4. **Cetak order mengikuti data terbaru**
   - Popup order sekarang mengambil data order terbaru setelah refresh, sehingga cetak order tidak lagi memakai snapshot lama.
   - Kolom QC pada dokumen cetak terisi dari `qcDeliveredQty`.
   - Packing/sterofoam dan total bawah di dokumen cetak mengikuti hasil QC atau edit packing terbaru.

5. **Admin assisted order dari menu Produk**
   - Admin dapat membuat order untuk mitra dari menu Produk.
   - Admin memilih mitra yang dibantu order sebelum checkout.
   - Harga mengikuti tier mitra yang dipilih.
   - Order tetap memakai endpoint `createOrder`, sehingga notifikasi WAHA WhatsApp dan email order-created tetap berjalan.

6. **Update harga katalog PDF 2026**
   - Harga katalog diperbarui dari PDF `KATALOG HARGA WAHYU BEEF KEMITRAAN 2026`.
   - 84 produk aktif `WB-001` sampai `WB-084` diperbarui untuk tier Distributor, Agen, Reseller, dan Retail.
   - Ditambahkan sinkronisasi harga untuk persisted/D1 state agar harga live ikut mengikuti seed terbaru tanpa menghapus order/mitra existing.

7. **Label versi aplikasi**
   - Sidebar sekarang menampilkan `Versi Aplikasi v1.4.0`.
   - `package.json` dan `package-lock.json` dibump ke `1.4.0`.

## Verifikasi sebelum disimpan

- `npm run typecheck -- --pretty false` ✅
- `npm test` ✅ 13 passing
- `npm run build:all` ✅
- Deploy Cloudflare Pages ke project `aplikasi-mitra-wahyu-beef` ✅
- Deployment snapshot: `https://b61d2f3a.aplikasi-mitra-wahyu-beef.pages.dev` ✅
- Live route checks:
  - `https://b61d2f3a.aplikasi-mitra-wahyu-beef.pages.dev/` → HTTP 200
  - `https://aplikasi-mitra-wahyu-beef.pages.dev/` → HTTP 200
  - `https://aplikasi-mitra-wahyu-beef.pages.dev/orders` → HTTP 200

## Test baru/terkini

- Test QC memastikan admin dapat mengubah qty produk dan packaging/sterofoam, lalu sistem memperbarui:
  - `qcDeliveredQty`
  - `lineTotal`
  - `subtotal`
  - `packingFee`
  - `packingQuantity`
  - `packingType`
  - `grandTotal`
  - audit `ORDER_QC_UPDATED`

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:

`https://b61d2f3a.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan tag lokal:

`aplikasi-mitra-wahyu-beef-v1.4.0`

## Catatan GitHub

Push ke GitHub masih bergantung pada ketersediaan kredensial SSH/HTTPS yang valid untuk repo private `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`.
