# Aplikasi Mitra Wahyu Beef v1.2.0

Tanggal simpan: 2026-06-03 22:11 WIB

## Identitas versi

- Nama versi: **Aplikasi Mitra Wahyu Beef v1.2.0**
- Workspace canonical: `/home/node/.openclaw/workspace/mitra-wahyu-beef-app`
- Repo: `git@github.com:Z-tama/Aplikasi-Mitra-Wahyu-Beef.git`
- Cloudflare Pages project: `aplikasi-mitra-wahyu-beef`
- Live domain: `https://mitra.wahyubeef.id`
- Deployment snapshot: `https://4504ea79.aplikasi-mitra-wahyu-beef.pages.dev`
- Live assets saat disimpan:
  - JS: `assets/index-Dx2hAKTu.js`
  - CSS: `assets/index-Cal-uDei.css`

## Isi utama v1.2.0

1. **Login dan pendaftaran kembali ke konsep Mitra**
   - Header login/registrasi memakai hero Mitra CSS: `Sukses Berjamaah`, `Bersinergi Bersama`, `Join Now!` / `Daftar Mitra`.
   - CTA login kembali menjadi `Daftar Menjadi Mitra`.
   - Success/registration copy kembali menjadi `Pendaftaran Mitra` dan `calon mitra`.
   - Header gambar Member `/assets/header-member-wb.png` tidak dipakai di Mitra.

2. **Form pendaftaran Mitra dipulihkan**
   - Identitas Usaha
   - Nama Usaha / Toko
   - Nama Pemilik / PIC
   - Nomor WhatsApp
   - Email
   - Lokasi & Area
   - Provinsi
   - Kota / Kabupaten
   - Alamat Lengkap
   - Profil Penjualan
   - Jenis Usaha
   - Channel Penjualan
   - Estimasi Penjualan per Bulan
   - Minat Level Mitra
   - Catatan Tambahan

3. **Foto katalog produk diperbarui dari CSV URL gambar**
   - CSV berisi 97 produk.
   - 74 URL gambar Google Drive usable dikonversi ke format `https://drive.google.com/thumbnail?id=...&sz=w1000`.
   - `syncProductCatalogImages` memastikan state produksi D1 ikut tersinkron saat load.
   - Link non-gambar, seperti Tokopedia search untuk `prd-tls-011`, tidak dipaksa menjadi image URL.

4. **Pemisahan Mitra vs Member diperkuat**
   - `PROJECT_IDENTITY.md` ditambahkan untuk folder Mitra.
   - Script deploy Mitra punya guard: abort jika target bukan `aplikasi-mitra-wahyu-beef`.
   - Canonical folder Mitra adalah `mitra-wahyu-beef-app`; `frozen-membership-app` hanya symlink legacy.

## Verifikasi sebelum disimpan

- `npm run typecheck` ✅
- `npm test` ✅ 5 passing
- `GOMAXPROCS=2 npm run build:all` ✅
- Live `https://mitra.wahyubeef.id` memuat asset:
  - `index-Dx2hAKTu.js`
  - `index-Cal-uDei.css`
- Live JS mengandung string Mitra wajib:
  - `Daftar Menjadi Mitra`
  - `Pendaftaran Mitra`
  - `Identitas Usaha`
  - `Lokasi & Area`
  - `Profil Penjualan`
  - `Minat Level Mitra`
  - `Daftar Mitra`
  - `Bersinergi`
- Live JS bersih dari string Member yang sebelumnya salah:
  - `Daftar Menjadi Member`
  - `Pendaftaran Member`
  - `Header Member Wahyu Beef`
  - `header-member-wb.png`
  - `JADI MEMBER`
  - `Member Wahyu Beef`
- Live Member domain tetap tidak berubah:
  - `https://member.wahyubeef.id`
  - `index-DDYULzNS.js` / `index-vpCCpsjO.css`

## Catatan rollback

Untuk rollback Cloudflare Pages, pilih deployment snapshot:

`https://4504ea79.aplikasi-mitra-wahyu-beef.pages.dev`

Untuk source-level rollback, gunakan git tag/commit yang dibuat bersama dokumen ini setelah commit berhasil.
