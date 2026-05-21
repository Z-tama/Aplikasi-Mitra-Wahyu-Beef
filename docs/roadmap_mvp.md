# ROADMAP MVP

## Phase 0 — Discovery & Alignment
Durasi acuan: 1 minggu.

Output:
- Finalisasi role pengguna.
- Finalisasi tier mitra.
- Finalisasi format invoice dan surat jalan.
- Finalisasi status order.
- Finalisasi kebijakan kapan invoice dibuat dan kapan barang dianggap diterima.
- Finalisasi basis leaderboard.
- Review awal kebutuhan PSAK bersama finance/accounting.

Checklist:
- [ ] Daftar tier final.
- [ ] Daftar produk awal.
- [ ] Contoh invoice lama.
- [ ] Contoh surat jalan lama.
- [ ] Kebijakan pembayaran/jatuh tempo.
- [ ] Kebijakan retur/cancel.

## Phase 1 — Foundation
Durasi acuan: 1–2 minggu.

Build:
- Project setup.
- Database schema.
- Auth.
- RBAC.
- Layout admin dan mitra.
- Audit trail base.

Acceptance:
- User bisa login.
- Role bisa membatasi halaman.
- Database migration berjalan.
- Seed data tersedia.

## Phase 2 — Master Data
Durasi acuan: 1 minggu.

Build:
- Tier CRUD.
- Product CRUD.
- Mitra CRUD.
- Tier pricing CRUD.
- Validasi harga aktif.

Acceptance:
- Admin bisa membuat 3 tier.
- Admin bisa membuat produk.
- Admin bisa assign harga per tier.
- Mitra punya tier.

## Phase 3 — Mitra Catalog & Checkout
Durasi acuan: 1–2 minggu.

Build:
- Katalog mitra.
- Search/filter produk.
- Cart.
- Checkout.
- Server-side price calculation.
- Order creation.

Acceptance:
- Mitra melihat harga sesuai tier.
- Checkout membuat order pending.
- Order menyimpan price snapshot.
- Total order benar.

## Phase 4 — Order Operations
Durasi acuan: 1–2 minggu.

Build:
- Admin order list.
- Detail order.
- Status transition.
- Warehouse/production view.
- Status tracking untuk mitra.

Acceptance:
- Admin bisa ubah status valid.
- Mitra melihat status terbaru.
- Audit log status tercatat.

## Phase 5 — Invoice & Surat Jalan
Durasi acuan: 1–2 minggu.

Build:
- Surat jalan generation.
- Invoice generation.
- Printable/PDF templates.
- Invoice status.
- Payment record sederhana.

Acceptance:
- Surat jalan sesuai item order.
- Invoice sesuai total order.
- Invoice issued tidak bisa diedit langsung.
- Dokumen bisa diunduh/print.

## Phase 6 — Leaderboard & Reports
Durasi acuan: 1 minggu.

Build:
- Leaderboard bulanan.
- Leaderboard filter periode.
- Sales summary.
- Top products.
- Top mitra.
- Invoice aging sederhana.

Acceptance:
- Leaderboard hanya hitung delivered orders.
- Admin bisa lihat ranking.
- Mitra bisa lihat posisinya.

## Phase 7 — PSAK-Oriented Readiness
Durasi acuan: paralel + 1 minggu review.

Build:
- Accounting event log.
- Export accounting events CSV.
- Mapping event ke candidate journal entry.
- Review audit trail.

Acceptance:
- Event otomatis dibuat untuk order/invoice/delivery/payment.
- Finance bisa export event.
- Data memiliki referensi dokumen lengkap.

## Phase 8 — QA, UAT, MVP Launch
Durasi acuan: 1–2 minggu.

Build/Run:
- Unit test.
- Integration test.
- UAT dengan admin dan 3–5 mitra.
- Bug fixing.
- Deployment.
- Training admin.

Acceptance:
- Flow end-to-end lulus.
- Tidak ada blocker critical.
- Admin bisa menjalankan operasional harian.
- Mitra pilot bisa order mandiri.

## Post-MVP Roadmap
### V1.1
- Notifikasi WhatsApp/email.
- Bulk import produk/harga.
- Credit limit mitra.
- Retur barang.
- Promo/voucher per tier.

### V1.2
- Integrasi payment gateway/bank statement.
- Integrasi ekspedisi.
- Multi-warehouse.
- Stock reservation.
- Approval workflow.

### V2
- Mobile app native.
- Gamification lanjutan.
- Komisi/downline.
- Demand forecasting.
- Akuntansi GL integration.
- Tax/e-Faktur integration jika diperlukan.
