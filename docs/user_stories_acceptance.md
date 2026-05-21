# USER STORIES & ACCEPTANCE CRITERIA

## Epic 1 — Authentication
### US-001 Login Admin
Sebagai admin, saya ingin login agar dapat mengelola sistem.

Acceptance:
- Given akun aktif, when kredensial benar, then masuk dashboard admin.
- Given akun nonaktif, when login, then ditolak.

### US-002 Login Mitra
Sebagai mitra, saya ingin login agar dapat melihat katalog dan order.

Acceptance:
- Mitra aktif bisa login.
- Mitra suspended bisa login untuk melihat histori, tetapi tidak bisa checkout jika kebijakan mengizinkan. Alternatif: suspended tidak bisa login. Pilih satu di konfigurasi.

## Epic 2 — Tier & Pricing
### US-003 Kelola Tier
Sebagai admin, saya ingin mengelola tier agar struktur mitra rapi.

Acceptance:
- Nama tier unik.
- Tier bisa aktif/nonaktif.

### US-004 Harga Produk per Tier
Sebagai admin, saya ingin mengatur harga produk per tier agar tiap mitra mendapat harga yang tepat.

Acceptance:
- Harga wajib lebih dari 0.
- Kombinasi product-tier-effective date valid.
- Sistem menolak checkout jika harga tier tidak tersedia.

## Epic 3 — Product Catalog
### US-005 Lihat Katalog
Sebagai mitra, saya ingin melihat produk frozen food agar bisa memilih produk.

Acceptance:
- Hanya produk aktif tampil.
- Harga yang tampil sesuai tier.
- Produk bisa dicari berdasarkan nama/SKU/kategori.

## Epic 4 — Order
### US-006 Checkout
Sebagai mitra, saya ingin checkout produk agar bisa membuat pesanan.

Acceptance:
- Qty valid.
- Harga dihitung server-side.
- Order number unik.
- Status awal pending.

### US-007 Lihat Riwayat Order
Sebagai mitra, saya ingin melihat riwayat order agar tahu transaksi saya.

Acceptance:
- Mitra hanya melihat order miliknya.
- Bisa filter status dan tanggal.

### US-008 Update Status Order
Sebagai admin/warehouse, saya ingin update status order agar proses operasional terlacak.

Acceptance:
- Transition valid.
- Status change masuk audit log.
- Mitra melihat status terbaru.

## Epic 5 — Surat Jalan
### US-009 Generate Surat Jalan
Sebagai warehouse/admin, saya ingin membuat surat jalan agar pengiriman punya dokumen resmi.

Acceptance:
- Surat jalan berasal dari order valid.
- Nomor surat jalan unik.
- Bisa print/PDF.

## Epic 6 — Invoice
### US-010 Generate Invoice
Sebagai finance, saya ingin membuat invoice dari order agar penagihan rapi.

Acceptance:
- Invoice total sama dengan order snapshot.
- Nomor invoice unik.
- Invoice issued immutable.

### US-011 Catat Pembayaran
Sebagai finance, saya ingin mencatat pembayaran agar status invoice akurat.

Acceptance:
- Payment bisa partial/full.
- Outstanding terhitung otomatis.
- Payment masuk accounting event log.

## Epic 7 — Leaderboard
### US-012 Lihat Leaderboard
Sebagai mitra, saya ingin melihat leaderboard agar termotivasi meningkatkan order.

Acceptance:
- Ranking default bulan berjalan.
- Hanya order delivered dihitung.
- Mitra bisa melihat posisinya.

## Epic 8 — Reporting
### US-013 Sales Summary
Sebagai owner/admin, saya ingin melihat ringkasan sales agar bisa memantau performa.

Acceptance:
- Bisa filter tanggal.
- Menampilkan total order value, jumlah order, top produk, top mitra.

## Epic 9 — PSAK-Oriented Events
### US-014 Accounting Event Log
Sebagai finance, saya ingin setiap transaksi penting menghasilkan event agar mudah direkonsiliasi.

Acceptance:
- Order created membuat event.
- Invoice issued membuat event.
- Goods delivered membuat event.
- Payment received membuat event.
- Event tidak bisa diedit, hanya bisa void/reversal event.
