# PRD — Product Requirements Document

## 1. Nama Produk
Mitra Frozen Food Membership App

## 2. Visi Produk
Menjadi sistem order B2B utama untuk mengelola mitra frozen food, harga bertingkat, pemesanan, dokumen transaksi, dan kompetisi performa mitra dalam satu platform yang rapi, transparan, dan siap audit.

## 3. Objective MVP
MVP bertujuan membuktikan bahwa mitra dapat melakukan order secara mandiri dengan harga sesuai tier, admin dapat memproses order sampai invoice/surat jalan, dan leaderboard dapat mendorong order berulang.

## 4. Scope MVP
### Included
- Login user.
- Role admin dan mitra.
- CRUD produk.
- CRUD tier.
- CRUD mitra.
- Harga produk per tier.
- Katalog mitra dengan harga sesuai tier.
- Checkout order.
- Status tracking order.
- Generate invoice.
- Generate surat jalan.
- Leaderboard bulanan.
- Basic reports.
- Audit trail.
- Accounting event log.

### Excluded
- Payment gateway.
- Integrasi ekspedisi.
- Integrasi e-Faktur.
- Mobile native app.
- Multi-warehouse kompleks.
- Akuntansi general ledger penuh.
- Forecast demand.

## 5. User Roles & Permissions
| Role | Permission Utama |
|---|---|
| Super Admin | Full access |
| Admin Sales | Kelola mitra, order, status awal |
| Admin Finance | Invoice, pembayaran, laporan finance |
| Warehouse | Melihat order produksi, update produksi/kirim |
| Mitra | Katalog, order, status, dokumen, leaderboard |

## 6. Functional Requirements

### FR-001 Login
User dapat login menggunakan email/nomor HP dan password.

Acceptance:
- Login berhasil jika kredensial valid dan user aktif.
- User nonaktif tidak bisa login.
- Setelah login diarahkan sesuai role.

### FR-002 Tier Management
Admin dapat membuat tier Distributor, Agen, Reseller.

Acceptance:
- Tier memiliki nama unik.
- Tier bisa dinonaktifkan jika tidak dipakai order aktif.

### FR-003 Product Management
Admin dapat membuat produk frozen food.

Acceptance:
- Produk wajib memiliki SKU, nama, satuan, dan status.
- SKU unik.
- Produk nonaktif tidak tampil di katalog mitra.

### FR-004 Tier Pricing
Admin dapat mengatur harga produk per tier.

Acceptance:
- Satu produk dapat punya harga berbeda per tier.
- Harga tidak boleh negatif.
- Order menyimpan snapshot harga saat checkout.
- Perubahan harga tidak mengubah order lama.

### FR-005 Mitra Management
Admin dapat membuat akun mitra dan menentukan tier.

Acceptance:
- Mitra wajib punya nama, kontak, dan tier.
- Mitra suspended tidak bisa checkout.

### FR-006 Catalog Mitra
Mitra melihat katalog produk dengan harga sesuai tier.

Acceptance:
- Mitra Distributor melihat harga Distributor.
- Mitra Agen melihat harga Agen.
- Mitra Reseller melihat harga Reseller.
- Harga tidak dikirim dari frontend saat checkout sebagai source of truth.

### FR-007 Cart & Checkout
Mitra dapat memasukkan produk ke keranjang dan checkout.

Acceptance:
- Total order dihitung server-side.
- Qty minimal 1 atau sesuai MOQ.
- Checkout menghasilkan nomor order unik.
- Status awal `pending`.

### FR-008 Order Management
Admin dapat melihat dan memproses order.

Acceptance:
- Admin dapat ubah status sesuai transition yang valid.
- Status tidak bisa mundur sembarangan tanpa permission.
- Semua perubahan status tercatat.

### FR-009 Surat Jalan
Admin/warehouse dapat membuat surat jalan dari order valid.

Acceptance:
- Surat jalan berisi item sesuai order.
- Surat jalan punya nomor unik.
- Surat jalan bisa diunduh/print.
- Surat jalan tidak bisa dibuat untuk order cancelled.

### FR-010 Invoice
Finance dapat membuat invoice dari order valid.

Acceptance:
- Invoice mengambil item, harga, dan total dari snapshot order.
- Invoice punya nomor unik.
- Invoice issued tidak bisa diedit langsung.
- Invoice bisa void dengan alasan.

### FR-011 Payment Status
Finance dapat menandai pembayaran.

Acceptance:
- Invoice bisa unpaid, partial, paid, void.
- Pembayaran partial mengurangi outstanding.
- Pembayaran tidak boleh melebihi invoice total kecuali ada overpayment handling di fase berikutnya.

### FR-012 Leaderboard
Mitra melihat ranking berdasarkan order delivered.

Acceptance:
- Ranking default per bulan berjalan.
- Order cancelled/pending tidak dihitung.
- Admin dapat memilih periode.

### FR-013 Reporting
Admin dapat melihat laporan dasar.

Acceptance:
- Sales summary per periode.
- Top mitra.
- Top produk.
- Invoice aging sederhana.

### FR-014 Audit Trail
Sistem mencatat aksi penting.

Acceptance:
- Tercatat user, aksi, entity, entity_id, old_value, new_value, timestamp.

### FR-015 Accounting Event Log
Sistem mencatat event transaksi penting untuk mapping akuntansi.

Acceptance:
- Event dibuat otomatis saat order, invoice, delivery, payment.
- Event immutable.
- Event menyimpan amount, reference entity, dan metadata.

## 7. Non-Functional Requirements
- Mobile responsive.
- Secure RBAC.
- Server-side price calculation.
- Atomic order transaction.
- Audit log immutable.
- Export CSV untuk laporan dasar.
- Backup-ready database.

## 8. UX Requirements
### Mitra
- Dashboard ringkas: status order aktif, ranking, total order bulan ini.
- Katalog mudah dicari.
- Checkout maksimal 3 langkah.
- Riwayat order mudah difilter.

### Admin
- Dashboard status order.
- Filter order berdasarkan status, mitra, tanggal.
- Tombol generate invoice/surat jalan jelas.
- Warning jika harga tier belum lengkap.

## 9. Analytics MVP
Track:
- Jumlah login mitra.
- Jumlah order dibuat.
- Conversion catalog to checkout.
- Total GMV/order value.
- Repeat order mitra.
- Leaderboard engagement.

## 10. Risks
- Kesalahan pengakuan pendapatan jika revenue diakui saat order, bukan saat kewajiban terpenuhi.
- Harga tier tidak lengkap menyebabkan checkout error.
- Invoice berubah setelah issued tanpa jejak audit.
- Leaderboard dimanipulasi order palsu jika menghitung pending order.

## 11. Definition of Done MVP
- Semua flow utama berjalan end-to-end.
- Data seed tersedia.
- Role permission berjalan.
- PDF/print invoice dan surat jalan tersedia.
- Unit test core pricing dan order total lulus.
- Accounting event log terbentuk otomatis.
