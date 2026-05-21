# BLUEPRINT — Aplikasi Membership Mitra Frozen Food

## 1. Ringkasan
Aplikasi membership mitra frozen food adalah platform B2B order management untuk mitra bertingkat: Distributor, Agen, dan Reseller. Setiap tier memiliki harga produk yang berbeda. Mitra dapat memesan produk, memantau status order, menerima invoice dan surat jalan, serta bersaing dalam leaderboard berdasarkan performa order.

## 2. Masalah yang Diselesaikan
- Harga mitra sering keliru karena tiap tier punya harga berbeda.
- Order via WhatsApp/manual sulit dilacak.
- Invoice dan surat jalan rawan tidak sinkron dengan order.
- Status produksi/pengiriman tidak transparan untuk mitra.
- Performa mitra sulit dipantau.
- Data transaksi tidak tertata untuk akuntansi dan audit.

## 3. Sasaran Produk
- Mengurangi kesalahan harga per tier.
- Memusatkan order mitra dalam satu sistem.
- Membuat dokumen invoice dan surat jalan otomatis dari data order.
- Memberi transparansi status order ke mitra.
- Meningkatkan repeat order lewat leaderboard.
- Membuat data transaksi siap PSAK-oriented, audit trail, dan rekonsiliasi finance.

## 4. Persona
### 4.1 Owner/Management
Butuh dashboard performa order, mitra terbaik, penjualan per produk, dan kontrol operasional.

### 4.2 Admin Sales
Mengelola mitra, menerima order, membantu perubahan order, dan memantau pipeline.

### 4.3 Admin Finance
Menerbitkan invoice, mencatat pembayaran, melihat aging piutang, dan menyiapkan data akuntansi.

### 4.4 Warehouse/Produksi
Melihat order yang perlu diproduksi/dipacking, update status produksi dan pengiriman.

### 4.5 Mitra
Melihat produk dan harga khusus tier, order cepat, cek status, unduh invoice/surat jalan, dan mengejar ranking leaderboard.

## 5. Modul Sistem
### 5.1 Authentication & Authorization
- Login email/nomor HP + password.
- Role-based access control.
- Mitra hanya bisa melihat data miliknya.
- Admin dapat melihat semua data sesuai permission.

### 5.2 Tier Management
- CRUD tier: Distributor, Agen, Reseller.
- Urutan tier.
- Deskripsi tier.
- Status aktif/nonaktif.

### 5.3 Mitra Management
- CRUD mitra.
- Assign tier.
- Data kontak, alamat, NPWP/NIK opsional, limit kredit opsional.
- Status: active, suspended, inactive.

### 5.4 Product Catalog
- CRUD produk.
- SKU, nama produk, kategori, berat, satuan, foto, deskripsi.
- Status aktif/nonaktif.
- Minimum order quantity opsional.

### 5.5 Tier Pricing
- Harga per produk per tier.
- Effective date.
- History harga.
- Validasi: order menyimpan harga snapshot saat checkout.

### 5.6 Order
- Cart.
- Checkout.
- Nomor order otomatis.
- Multi item.
- Catatan order.
- Alamat kirim.
- Status lifecycle.

### 5.7 Order Status Tracking
Status standar:
1. `pending` — order dibuat, menunggu konfirmasi.
2. `confirmed` — order dikonfirmasi admin.
3. `in_production` — sedang diproduksi/dipacking.
4. `ready_to_ship` — siap dikirim.
5. `shipped` — sedang dikirim.
6. `delivered` — diterima mitra.
7. `cancelled` — dibatalkan.

Semua perubahan status masuk audit trail.

### 5.8 Surat Jalan
- Dibuat dari order confirmed/ready_to_ship/shipped.
- Berisi nomor surat jalan, tanggal, mitra, alamat, item, qty, satuan, driver/kurir opsional, tanda tangan.
- Printable/PDF.

### 5.9 Invoice
- Dibuat dari order valid.
- Berisi nomor invoice, tanggal invoice, jatuh tempo, data mitra, item, harga, subtotal, diskon, pajak opsional, total.
- Status invoice: draft, issued, paid, partial, void.
- Tidak boleh mengubah invoice issued tanpa membuat revisi/void.

### 5.10 Leaderboard
Basis ranking MVP:
- Total nilai order delivered dalam periode.
- Total qty order delivered.
- Jumlah order delivered.
- Poin: configurable, default `floor(total_order_value / 100000)`.

Leaderboard hanya menghitung order `delivered` agar ranking tidak dimanipulasi dari order pending/cancelled.

### 5.11 Reporting
- Sales summary.
- Order by status.
- Top products.
- Top mitra.
- Invoice aging sederhana.
- Stock movement sederhana.

### 5.12 Audit Trail
Catat:
- Login penting opsional.
- Create/update/delete entity penting.
- Perubahan status order.
- Generate invoice/surat jalan.
- Perubahan harga.
- Void invoice.

### 5.13 Accounting Event Log
Tabel event untuk mapping ke jurnal:
- `ORDER_CREATED`
- `INVOICE_ISSUED`
- `DELIVERY_NOTE_CREATED`
- `GOODS_SHIPPED`
- `GOODS_DELIVERED`
- `PAYMENT_RECEIVED`
- `ORDER_CANCELLED`
- `INVOICE_VOIDED`
- `INVENTORY_OUT`

## 6. Arsitektur MVP
### Frontend Mitra
- Login.
- Katalog produk.
- Keranjang.
- Checkout.
- Riwayat order.
- Detail order.
- Invoice/surat jalan.
- Leaderboard.

### Frontend Admin
- Dashboard.
- Master data produk.
- Master data tier.
- Master data harga.
- Master data mitra.
- Order management.
- Invoice management.
- Surat jalan.
- Leaderboard config.
- Reports.

### Backend
- REST API atau tRPC.
- Business logic pricing di server.
- RBAC middleware.
- Transaction handling untuk order.
- PDF/print generator.

### Database
PostgreSQL dengan relasi kuat, constraint, unique index, dan audit columns.

## 7. Prinsip Keamanan
- Password hashing.
- RBAC.
- Validasi input server-side.
- Mitra tidak boleh menentukan harga dari frontend.
- Invoice/surat jalan harus dicek ownership.
- Rate limit login.
- Audit log untuk aksi penting.

## 8. Non-Functional Requirements
- Responsive mobile-first.
- Waktu loading katalog < 3 detik untuk 500 produk.
- Order checkout atomic transaction.
- PDF bisa digenerate ulang dari data invoice/surat jalan.
- Data historis tidak rusak saat harga produk berubah.

## 9. MVP Success Criteria
- 90% order mitra bisa dibuat tanpa admin input manual.
- 0 kesalahan harga tier pada order valid.
- Invoice dan surat jalan selalu match dengan order.
- Admin bisa melihat status order real-time.
- Leaderboard otomatis berjalan per bulan.
