# BRD — Business Requirements Document

## 1. Latar Belakang Bisnis
Bisnis frozen food memiliki jaringan mitra dengan level berbeda. Setiap level mendapatkan harga berbeda untuk produk yang sama. Saat order dilakukan manual, risiko kesalahan harga, kesalahan stok, keterlambatan dokumen, dan kurangnya visibilitas status order meningkat. Dibutuhkan aplikasi membership untuk menyatukan proses order, dokumen, dan performa mitra.

## 2. Business Goals
- Meningkatkan volume order mitra.
- Mengurangi proses manual admin.
- Menstandarkan harga per tier.
- Mempercepat penerbitan invoice dan surat jalan.
- Membuat mitra lebih aktif lewat leaderboard.
- Menyediakan data transaksi yang siap audit dan mudah direkonsiliasi.

## 3. Business Requirements
### BR-001 Harga Bertingkat
Sistem harus memastikan harga yang muncul dan digunakan saat checkout sesuai tier mitra.

### BR-002 Order Mandiri
Mitra harus bisa order tanpa perlu chat admin untuk setiap transaksi.

### BR-003 Kontrol Order Internal
Admin harus bisa memvalidasi, memproses, dan mengubah status order.

### BR-004 Dokumen Transaksi Otomatis
Invoice dan surat jalan harus dibuat dari order yang sudah valid, bukan input manual terpisah.

### BR-005 Transparansi Status
Mitra harus bisa melihat status order terbaru.

### BR-006 Kompetisi Mitra
Leaderboard harus menghitung performa mitra berdasarkan order valid/selesai.

### BR-007 PSAK-Oriented Transaction Data
Sistem harus menyimpan event transaksi agar finance dapat memetakan order, invoice, pengiriman, penerimaan barang, pembayaran, persediaan, dan piutang ke kebijakan akuntansi sesuai PSAK.

## 4. Business Process Target
1. Admin membuat master produk.
2. Admin mengatur harga per tier.
3. Admin mengundang/membuat akun mitra.
4. Mitra login dan order.
5. Admin mengonfirmasi order.
6. Produksi/warehouse memproses barang.
7. Surat jalan dibuat.
8. Barang dikirim.
9. Invoice diterbitkan.
10. Barang diterima mitra.
11. Finance mencatat pembayaran.
12. Leaderboard terupdate.
13. Laporan dapat ditarik.

## 5. KPI MVP
| KPI | Target MVP |
|---|---:|
| Order dibuat via aplikasi | >= 70% order mitra aktif |
| Kesalahan harga tier | 0 kasus pada order valid |
| Waktu membuat invoice | < 2 menit per order |
| Waktu membuat surat jalan | < 2 menit per order |
| Mitra aktif bulanan | >= 50% dari total mitra |
| Repeat order | meningkat 10–20% setelah 2 bulan |

## 6. Business Rules
1. Mitra hanya bisa melihat harga tier miliknya.
2. Mitra suspended tidak bisa checkout.
3. Order cancelled tidak masuk leaderboard.
4. Order pending tidak masuk revenue recognition event.
5. Invoice issued tidak boleh diedit langsung; harus void/revisi.
6. Harga order bersifat snapshot.
7. Leaderboard menggunakan order delivered sebagai default.
8. Perubahan status order harus mengikuti transition valid.
9. Pengakuan pendapatan tidak dipaksakan di aplikasi; sistem mencatat event yang dibutuhkan finance.
10. Inventory movement harus tercatat saat barang keluar/terkirim sesuai kebijakan operasional.

## 7. Stakeholder
- Owner/CEO
- Head of Sales
- Finance/Accounting
- Warehouse/Produksi
- Admin Operasional
- Mitra Distributor/Agen/Reseller

## 8. Business Risks & Mitigation
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Harga tier salah | Margin rugi | Server-side pricing + price snapshot |
| Invoice tidak sinkron | Rekonsiliasi sulit | Invoice generated from order only |
| Status tidak update | Komplain mitra | Warehouse role + notification |
| Leaderboard tidak fair | Turun trust | Hitung hanya order delivered |
| Akuntansi tidak sesuai | Audit issue | Accounting event log + policy config |
| Data berubah tanpa jejak | Fraud/error | Audit trail immutable |

## 9. Out of Scope Bisnis MVP
- Program komisi kompleks.
- Franchise management.
- Multi-currency.
- Integrasi bank otomatis.
- General ledger penuh.
- Full inventory costing engine.
