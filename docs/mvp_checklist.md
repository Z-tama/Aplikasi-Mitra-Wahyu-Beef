# MVP CHECKLIST

## Product
- [ ] Tier Distributor, Agen, Reseller tersedia.
- [ ] Produk aktif bisa tampil di katalog.
- [ ] Harga per tier lengkap untuk produk aktif.
- [ ] Mitra bisa login.
- [ ] Mitra melihat harga sesuai tier.
- [ ] Mitra bisa checkout.
- [ ] Admin bisa proses order.
- [ ] Mitra bisa melihat status order.
- [ ] Invoice bisa dibuat dari order.
- [ ] Surat jalan bisa dibuat dari order.
- [ ] Leaderboard berjalan.

## Engineering
- [ ] Database migration.
- [ ] Seed data.
- [ ] RBAC middleware.
- [ ] Server-side price calculation.
- [ ] Atomic transaction checkout.
- [ ] Audit logs.
- [ ] Accounting events.
- [ ] PDF/print templates.
- [ ] Unit tests.
- [ ] Deployment config.

## PSAK-Oriented Readiness
- [ ] Order created tidak otomatis revenue.
- [ ] Invoice issued tercatat sebagai event.
- [ ] Goods delivered tercatat sebagai event.
- [ ] Payment received tercatat sebagai event.
- [ ] Inventory movement tercatat.
- [ ] Invoice outstanding dan aging tersedia.
- [ ] Export CSV tersedia untuk finance.
- [ ] Invoice issued immutable.
- [ ] Void/reversal flow tersedia.

## UAT Scenarios
- [ ] Distributor order produk A dan melihat harga Distributor.
- [ ] Agen order produk A dan melihat harga Agen.
- [ ] Reseller order produk A dan melihat harga Reseller.
- [ ] Admin mengubah status order dari pending sampai delivered.
- [ ] Finance membuat invoice.
- [ ] Warehouse membuat surat jalan.
- [ ] Payment partial dicatat.
- [ ] Leaderboard menghitung hanya order delivered.
- [ ] Order cancelled tidak masuk leaderboard.
- [ ] Perubahan harga tidak mengubah order lama.

## Go-Live
- [ ] Domain/subdomain siap.
- [ ] Admin training.
- [ ] 3–5 mitra pilot dibuat.
- [ ] Produk dan harga awal diinput.
- [ ] Backup database aktif.
- [ ] SOP invoice dan surat jalan disetujui.
- [ ] Finance menyetujui export dan event log.
