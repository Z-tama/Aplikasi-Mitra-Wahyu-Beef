# AI BUILDER MASTER PROMPT

Kamu adalah senior product engineer, system analyst, dan solution architect. Bangun rancangan MVP aplikasi membership B2B untuk bisnis frozen food dengan model mitra bertingkat: Distributor, Agen, dan Reseller. Aplikasi bukan marketplace umum, melainkan platform order internal untuk mitra resmi.

## Tujuan Produk
Membuat aplikasi web/mobile responsive yang memungkinkan mitra:
- Login sebagai mitra.
- Melihat katalog produk frozen food.
- Melihat harga produk sesuai tier mitra.
- Membuat order produk.
- Memantau status order: `pending`, `diproses/diproduksi`, `siap_kirim`, `dikirim`, `diterima`, `dibatalkan`.
- Mengunduh/ menerima surat jalan dan invoice sesuai order.
- Melihat leaderboard mitra berdasarkan total order, nominal order, atau poin.

Admin/internal bisnis dapat:
- Mengelola produk, stok, harga per tier, mitra, order, pembayaran, surat jalan, invoice, status pengiriman, dan leaderboard.
- Melihat ringkasan penjualan dan laporan transaksi.
- Menjaga pencatatan yang siap diaudit dan dirancang sesuai prinsip PSAK relevan.

## Prinsip Utama
1. Tier-based pricing: satu produk bisa punya harga berbeda untuk Distributor, Agen, dan Reseller.
2. Invoice dan surat jalan harus berasal dari order yang valid, tidak boleh dibuat manual tanpa referensi order.
3. Status order harus terekam dalam audit trail.
4. Pendapatan tidak otomatis diakui saat order dibuat. Sistem harus mendukung pengakuan pendapatan ketika kewajiban pelaksanaan terpenuhi, umumnya saat barang diterima/risiko manfaat berpindah, sesuai konfigurasi kebijakan akuntansi perusahaan.
5. Sistem harus menyimpan data historis harga. Jika harga berubah, order lama tetap memakai harga saat order dibuat.
6. Semua perubahan penting harus memiliki `created_by`, `updated_by`, timestamp, dan audit log.
7. MVP harus sederhana tetapi extensible.

## Role Pengguna
- Super Admin
- Admin Sales/Operasional
- Admin Finance
- Warehouse/Produksi
- Mitra Distributor
- Mitra Agen
- Mitra Reseller

## Modul MVP Wajib
1. Auth & Role Management
2. Mitra Management
3. Tier Management
4. Product Catalog
5. Tier Price Management
6. Cart & Checkout Order
7. Order Management
8. Order Status Tracking
9. Delivery Note / Surat Jalan
10. Invoice Generation
11. Leaderboard
12. Basic Reporting
13. Audit Trail
14. Accounting Event Log untuk kesiapan PSAK

## Output yang Harus Dibuat AI Builder
Buat aplikasi MVP lengkap dengan:
- Struktur database.
- Backend API.
- Frontend dashboard admin.
- Frontend portal mitra.
- Validasi form.
- Role-based access control.
- Invoice dan surat jalan dalam PDF/printable HTML.
- Seed data contoh: 3 tier, 10 produk frozen food, 9 mitra, beberapa order.
- Unit test minimal untuk pricing, order total, status transition, invoice generation.
- Dokumentasi setup lokal.

## Preferensi Stack
Jika tidak ditentukan, gunakan stack modern:
- Frontend: Next.js + TypeScript + Tailwind CSS.
- Backend: Next.js API routes atau Node/NestJS.
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: NextAuth/Auth.js atau JWT session.
- PDF: server-side HTML-to-PDF atau printable invoice.
- Deployment: Docker-ready.

## Bahasa UI
Bahasa Indonesia.

## Batasan MVP
- Tidak perlu payment gateway dulu.
- Tidak perlu integrasi ekspedisi eksternal dulu.
- Tidak perlu aplikasi native dulu.
- Tidak perlu multi-company dulu, tetapi desain database jangan menutup kemungkinan multi-branch.

## Deliverable MVP
Aplikasi harus bisa menjalankan flow berikut:
1. Admin membuat tier Distributor/Agen/Reseller.
2. Admin membuat produk.
3. Admin mengatur harga produk per tier.
4. Admin membuat akun mitra dan menentukan tier.
5. Mitra login dan melihat katalog dengan harga sesuai tiernya.
6. Mitra membuat order.
7. Admin memproses order.
8. Warehouse mengubah status menjadi diproduksi/siap kirim/dikirim.
9. Admin membuat surat jalan.
10. Admin finance membuat invoice dari order.
11. Mitra melihat status order dan mengunduh invoice/surat jalan.
12. Leaderboard otomatis terupdate berdasarkan order diterima.

## Ketentuan PSAK-Oriented Design
Implementasikan event akuntansi, bukan langsung laporan akuntansi penuh. Simpan transaksi agar dapat dipetakan ke jurnal oleh tim finance.
- Order dibuat: belum revenue.
- Invoice dibuat: catat invoice issued dan piutang usaha jika kebijakan perusahaan mengakui tagihan.
- Barang dikirim: catat delivery event.
- Barang diterima/diterima mitra: eligible untuk revenue recognition sesuai PSAK 72 apabila kontrol barang telah berpindah.
- Stok keluar: catat inventory movement dan COGS trigger sesuai kebijakan PSAK 202.
- Piutang: simpan umur piutang dan status pembayaran untuk kebutuhan PSAK 109 terkait instrumen keuangan/piutang.

Jangan hardcode jurnal akuntansi final. Buat tabel `accounting_events` agar finance bisa mapping ke jurnal.
