# Production Checklist — Mitra Wahyu Beef

Status dokumen: **v1 live readiness checklist**  
Domain publik: <https://mitra.wahyubeef.id/>  
Aplikasi: `frozen-membership-app`  
Repo/deploy: `Z-tama/Aplikasi-Mitra-Wahyu-Beef` branch `main`

## 1. Status Saat Ini

Aplikasi sudah **live deployed** dan sudah layak dipakai untuk operasional internal/terbatas Wahyu Beef.

Fitur utama yang sudah tersedia:

- Login admin/mitra dengan nomor HP atau email.
- Session login tersimpan selama 30 menit.
- Katalog mitra dengan filter kategori dan pencarian produk.
- Product Catalog admin dengan filter kategori dan pencarian produk.
- Kategori katalog:
  - Daging Sapi
  - Tulang Sapi
  - Jeroan Sapi
  - Olahan Daging
  - Seafood Series
- Checkout/order mitra.
- Admin order lifecycle.
- Packing/ongkir/resi:
  - ongkir sesuai total resi
  - pilihan sterofoam kecil/sedang/besar
  - qty packing
  - nomor resi
  - upload foto resi
- Total invoice sudah memasukkan ongkir + packing.
- Invoice dan Surat Jalan A4 portrait dengan logo Wahyu Beef.
- Export PDF invoice/SJ via print page khusus.
- Area Mitra / Peta Sebaran Wilayah memakai database mitra asli.
- Marker peta dipisah per tier:
  - Distributor merah
  - Agen emas
  - Reseller hijau
- Rekap jumlah mitra per tier sudah accordion/dropdown.
- Dummy partner sudah dibersihkan dari data live.

## 2. Gate Wajib Sebelum Disebut Final Production 100%

### A. Akun & Password

- [ ] Pastikan semua akun demo/nonaktif sudah dihapus atau dinonaktifkan.
- [ ] Pastikan akun admin memakai password kuat.
- [ ] Pastikan akun role berikut sudah benar:
  - [ ] Super Admin / Owner
  - [ ] Sales Admin
  - [ ] Warehouse
  - [ ] Finance
  - [ ] Mitra
- [ ] Pastikan setiap user internal hanya punya akses sesuai tugasnya.
- [ ] Simpan daftar owner akun utama di tempat aman.

Catatan: jangan mengandalkan password demo untuk production.

### B. Data Mitra

- [ ] Validasi 66 mitra asli sudah benar.
- [ ] Cek ulang tier tiap mitra:
  - [ ] Distributor = 48
  - [ ] Agen = 11
  - [ ] Reseller = 7
- [ ] Lengkapi kota/provinsi/alamat yang masih kurang rapi.
- [ ] Pastikan nomor WhatsApp mitra benar.
- [ ] Pastikan email mitra benar jika dipakai login/emailing.
- [ ] Cek area di peta sudah masuk wilayah yang sesuai.

### C. Katalog Produk & Harga

- [ ] Validasi semua produk sudah masuk kategori benar.
- [ ] Validasi SKU produk.
- [ ] Validasi harga per tier:
  - [ ] Distributor
  - [ ] Agen
  - [ ] Reseller
- [ ] Validasi MOQ per produk.
- [ ] Validasi produk yang bisa pilih kemasan 250g/500g/1kg.
- [ ] Pastikan produk nonaktif tidak muncul di katalog mitra.
- [ ] Cek foto produk yang penting sudah tampil.

### D. Alur Order End-to-End

Uji minimal 3 skenario:

- [ ] Mitra Distributor membuat order.
- [ ] Mitra Agen membuat order.
- [ ] Mitra Reseller membuat order.

Untuk setiap skenario cek:

- [ ] Login mitra berhasil.
- [ ] Filter/search katalog berfungsi.
- [ ] Tambah produk ke keranjang.
- [ ] Checkout berhasil.
- [ ] Order muncul di admin.
- [ ] Admin update status order.
- [ ] Admin isi ongkir.
- [ ] Admin pilih packing + qty.
- [ ] Admin input nomor resi.
- [ ] Admin upload foto resi.
- [ ] Total tagihan berubah sesuai ongkir + packing.
- [ ] Mitra bisa melihat nomor resi/order tracking.

### E. Invoice, Surat Jalan, dan Pembayaran

- [ ] Generate invoice dari order berhasil.
- [ ] Generate surat jalan berhasil.
- [ ] Export PDF invoice menjadi 1 halaman A4.
- [ ] Export PDF surat jalan menjadi 1 halaman A4.
- [ ] Logo Wahyu Beef tampil di PDF.
- [ ] Total invoice sesuai order.
- [ ] Ongkir tampil benar.
- [ ] Packing tampil benar, termasuk qty.
- [ ] Catat pembayaran berhasil.
- [ ] Outstanding/sisa tagihan benar.

### F. Backup & Restore Data

Ini wajib sebelum operasional harian penuh.

- [ ] Tentukan lokasi backup data production.
- [ ] Backup file/state/database minimal harian.
- [ ] Simpan minimal 7–30 hari histori backup.
- [ ] Uji restore dari backup minimal sekali.
- [ ] Dokumentasikan cara restore.

Rekomendasi:

- Backup otomatis harian.
- Backup manual sebelum perubahan besar/import data.
- Backup terpisah dari server aplikasi.

### G. Upload File / Storage

Saat ini upload tertentu masih perlu dipastikan aman untuk jangka panjang.

- [ ] Pastikan foto resi disimpan di storage production, bukan membebani state utama.
- [ ] Pastikan foto profil disimpan di storage production.
- [ ] Batasi ukuran file upload.
- [ ] Batasi tipe file upload.
- [ ] Pastikan file lama bisa dibuka setelah restart/deploy.

Rekomendasi production:

- Cloudflare R2 / S3-compatible storage.
- Simpan URL/path file di database/state.
- Jangan simpan file besar langsung sebagai data URL dalam state untuk jangka panjang.

### H. Security & Access Control

- [ ] Pastikan domain pakai HTTPS.
- [ ] Pastikan token/session expiry berjalan.
- [ ] Pastikan route admin tidak bisa diakses mitra.
- [ ] Pastikan mitra hanya bisa melihat data miliknya sendiri.
- [ ] Pastikan error login tidak membocorkan data sensitif.
- [ ] Pastikan secret production tidak hardcoded di repo.
- [ ] Pastikan repo tetap private jika berisi logic/data sensitif.

### I. Monitoring & Error Handling

- [ ] Ada cara cek log error server.
- [ ] Ada cara cek status deployment terakhir.
- [ ] Ada kontak/penanggung jawab jika app error.
- [ ] Dokumentasikan langkah restart app.
- [ ] Dokumentasikan langkah rollback deploy.

Minimal command operasional:

```bash
PM2_HOME="$PWD/.pm2" pm2 list
PM2_HOME="$PWD/.pm2" pm2 logs wahyu-beef-demo --lines 100
PM2_HOME="$PWD/.pm2" pm2 restart wahyu-beef-demo --update-env
```

### J. UAT Final

Lakukan UAT 1–3 hari dengan data nyata terbatas.

- [ ] Owner cek dashboard.
- [ ] Sales/admin cek order.
- [ ] Warehouse cek packing/resi.
- [ ] Finance cek invoice/payment.
- [ ] Minimal 2–3 mitra coba login dan order.
- [ ] Catat semua bug kecil.
- [ ] Fix bug sebelum diumumkan full production.

## 3. Status Kesiapan

| Area | Status |
|---|---|
| Domain live | ✅ Siap |
| UI/UX utama | ✅ Siap |
| Katalog produk | ✅ Siap |
| Filter/search katalog | ✅ Siap |
| Order flow | ✅ Siap |
| Packing/ongkir/resi | ✅ Siap |
| Invoice/SJ PDF | ✅ Siap |
| Area mitra/peta | ✅ Siap |
| Session login 30 menit | ✅ Siap |
| Backup otomatis | ⚠️ Perlu finalisasi |
| Storage upload production | ⚠️ Perlu finalisasi |
| Monitoring/log SOP | ⚠️ Perlu finalisasi |
| UAT final | ⚠️ Perlu dijalankan |

## 4. Kesimpulan

Aplikasi bisa disebut:

> **Mitra Wahyu Beef v1 Live — siap untuk operasional internal/terbatas.**

Belum disarankan disebut 100% final production sampai checklist berikut selesai:

1. Backup otomatis + restore test.
2. Storage upload production untuk resi/foto.
3. Finalisasi akun/password real.
4. UAT 1–3 hari dengan pengguna nyata.
5. SOP monitoring, restart, dan rollback.

Setelah lima poin itu selesai, status bisa dinaikkan menjadi:

> **Production Stable v1.0**

## 5. R2 Upload Storage Status

- [x] Backend upload endpoint tersedia untuk foto resi: `POST /api/v1/uploads/tracking-receipts`.
- [x] Backend upload endpoint tersedia untuk foto profil: `POST /api/v1/profile/photo`.
- [x] Cloudflare R2 credential sudah terpasang di PM2 runtime.
- [x] Bucket aktif: `wahyu-beef-uploads`.
- [x] Test write object ke R2 berhasil via endpoint aplikasi.
- [x] Test HEAD object via R2 S3 API berhasil.
- [ ] Custom/public domain `uploads.wahyubeef.id` masih perlu dihubungkan/diaktifkan di Cloudflare R2 agar URL file bisa dibuka publik dari browser.
- [ ] Setelah custom domain aktif, rotate/generate ulang R2 token karena credential awal pernah terlihat di chat/screenshot.

Rekomendasi Cloudflare:

1. Masuk ke R2 Object Storage.
2. Buka bucket `wahyu-beef-uploads`.
3. Buka Settings → Custom Domains.
4. Connect domain `uploads.wahyubeef.id`.
5. Tunggu DNS/SSL aktif.
6. Test file URL `https://uploads.wahyubeef.id/<object-key>`.
