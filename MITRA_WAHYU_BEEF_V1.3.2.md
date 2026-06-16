# Aplikasi Mitra Wahyu Beef v1.3.2

Tanggal simpan: 2026-06-12 10:38 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.3.2**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot / rollback: `https://53f7b12f.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-jLAgcw3-.js`
  - CSS: `assets/index-pTVZnDc7.css`

## Isi utama v1.3.2

1. **Pilihan Ekspedisi di checkout**
   - Checkout page sekarang punya dropdown **Ekspedisi**.
   - Opsi ekspedisi:
     - Truk Thermal Wahyu Beef
     - KIB
     - KAI Logistik
     - Paxel
     - Ekspendingin
   - Pilihan ekspedisi ikut dikirim ke backend dan disimpan di data order.

2. **Truk Thermal Wahyu Beef tanpa biaya sterofoam**
   - Jika ekspedisi yang dipilih adalah **Truk Thermal Wahyu Beef**, sistem otomatis membuat biaya sterofoam/packaging menjadi `Rp0`.
   - Item packaging `packaging-styrofoam-*` tidak ikut dimasukkan ke order untuk pengiriman truk thermal.
   - Ringkasan checkout menampilkan info **Tanpa Sterofoam — Truk Thermal Wahyu Beef**.
   - Backend juga menerapkan aturan ini, jadi bukan hanya perubahan tampilan frontend.

3. **Ringkasan checkout menampilkan ekspedisi**
   - Panel total checkout sekarang menampilkan baris **Ekspedisi**.
   - Baris **Biaya Sterofoam** berubah mengikuti ekspedisi yang dipilih.
   - Total tagihan otomatis dihitung ulang berdasarkan biaya sterofoam yang berlaku.

4. **Ekspedisi tampil di notifikasi dan dokumen**
   - Ekspedisi muncul di WhatsApp order notification.
   - Ekspedisi muncul di email order notification.
   - Ekspedisi muncul di dokumen print order.

5. **Label versi aplikasi**
   - Sidebar sekarang menampilkan `Versi Aplikasi v1.3.2`.

## Verifikasi sebelum disimpan

- `npm run typecheck` ✅
- `npm test` ✅ 10 passing
- `GOMAXPROCS=2 npm run build:all` ✅
- Deploy Cloudflare Pages ke project `aplikasi-mitra-wahyu-beef` ✅
- Live `https://mitra.wahyubeef.id` memuat asset:
  - `index-jLAgcw3-.js`
  - `index-pTVZnDc7.css`
- Live JS mengandung marker fitur v1.3.2:
  - `Versi Aplikasi v1.3.2`
  - `Ekspedisi`
  - `Truk Thermal Wahyu Beef`
  - `KAI Logistik`
  - `Ekspendingin`
  - `Tanpa Sterofoam`
  - `truk_thermal_wahyu_beef`

## Test baru

- Ditambahkan test `thermal truck expedition skips styrofoam packaging fee and packaging item`.
- Test memastikan:
  - `order.expedition = truk_thermal_wahyu_beef`
  - `packingFee = 0`
  - `packingType = none`
  - `packingQuantity = 0`
  - `grandTotal = subtotal`
  - tidak ada item `packaging-styrofoam-*`.

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:

`https://53f7b12f.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan tag lokal:

`aplikasi-mitra-wahyu-beef-v1.3.2`

## Catatan GitHub

Push ke GitHub masih bergantung pada ketersediaan kredensial SSH/HTTPS yang valid untuk repo private `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`.
