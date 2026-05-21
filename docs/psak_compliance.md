# PSAK-ORIENTED COMPLIANCE DESIGN

## 1. Prinsip Umum
Dokumen ini bukan opini akuntansi final, tetapi pedoman desain sistem agar data transaksi aplikasi siap dipakai untuk pencatatan dan audit sesuai PSAK yang relevan. Finalisasi tetap perlu dilakukan oleh finance/accounting berdasarkan kontrak, kebijakan pengiriman, retur, diskon, pajak, dan praktik bisnis aktual.

## 2. PSAK Relevan untuk MVP
### PSAK 72 — Pendapatan dari Kontrak dengan Pelanggan
Relevan untuk penjualan frozen food ke mitra. Sistem perlu memisahkan order, invoice, pengiriman, penerimaan, dan revenue recognition event. Pendapatan umumnya diakui ketika kewajiban pelaksanaan terpenuhi dan kontrol barang berpindah ke pelanggan, bukan otomatis ketika order dibuat.

### PSAK 202 — Persediaan
Relevan karena frozen food adalah persediaan untuk dijual. Sistem perlu menyimpan produk, stok/movement, dan data biaya jika ingin mendukung HPP/COGS.

### PSAK 109 — Instrumen Keuangan
Relevan untuk piutang usaha dari invoice yang belum dibayar. Sistem perlu menyimpan invoice, outstanding, payment, aging, dan status piutang.

### PSAK 201 — Penyajian Laporan Keuangan
Relevan secara tidak langsung untuk klasifikasi laporan seperti pendapatan, beban pokok penjualan, persediaan, piutang, kas, dan liabilitas. MVP tidak perlu membuat laporan keuangan penuh, tetapi data harus bisa diekspor dan dipetakan.

## 3. PSAK-Oriented Business Event
| Event Sistem | Makna Operasional | Dampak Akuntansi Potensial |
|---|---|---|
| ORDER_CREATED | Mitra membuat pesanan | Belum otomatis pendapatan |
| ORDER_CONFIRMED | Admin menerima pesanan | Komitmen operasional, belum otomatis pendapatan |
| INVOICE_ISSUED | Tagihan diterbitkan | Potensi piutang usaha sesuai kebijakan |
| DELIVERY_NOTE_CREATED | Surat jalan dibuat | Bukti pengiriman disiapkan |
| GOODS_SHIPPED | Barang keluar/dikirim | Potensi inventory movement; revenue tergantung transfer control |
| GOODS_DELIVERED | Barang diterima | Potensi revenue recognition jika kewajiban terpenuhi |
| PAYMENT_RECEIVED | Pembayaran diterima | Kas/bank bertambah, piutang berkurang |
| ORDER_CANCELLED | Pesanan batal | Tidak masuk revenue dan leaderboard |
| INVOICE_VOIDED | Invoice dibatalkan | Butuh reversal/void tracking |
| INVENTORY_OUT | Stok keluar | Pengurangan persediaan; HPP jika kebijakan mengakui saat penjualan |

## 4. Revenue Recognition Rule untuk Sistem
Jangan hardcode revenue saat order dibuat. Gunakan konfigurasi:

```yaml
revenue_recognition_policy:
  default_trigger: GOODS_DELIVERED
  alternatives:
    - GOODS_SHIPPED
    - CUSTOMER_ACCEPTED
  require_invoice_issued: true
  require_delivery_note: true
  allow_manual_review: true
```

Default MVP yang aman: order masuk leaderboard dan revenue candidate hanya setelah status `delivered`.

## 5. Invoice & Piutang
Sistem harus membedakan:
- Order total.
- Invoice total.
- Amount paid.
- Amount due.
- Invoice status.
- Due date.
- Aging bucket.

Aging bucket MVP:
- Not due.
- 1–30 hari.
- 31–60 hari.
- 61–90 hari.
- >90 hari.

## 6. Inventory & HPP
MVP minimal menyimpan `inventory_movements`. Jika belum ada costing detail, simpan `unit_cost` nullable. Untuk versi berikutnya, tentukan metode biaya persediaan yang dipakai perusahaan, misalnya FIFO atau weighted average, sesuai kebijakan akuntansi.

## 7. Audit Trail Requirements
Untuk kesiapan audit:
- Invoice issued immutable.
- Void invoice wajib alasan.
- Harga order snapshot.
- Perubahan harga tercatat.
- Perubahan status order tercatat.
- Payment record tidak dihapus; jika salah gunakan reversal/correction.

## 8. Document Numbering
Gunakan nomor unik, berurutan, dan period-based:
- Order: `ORD-YYYYMM-0001`
- Invoice: `INV-YYYYMM-0001`
- Surat jalan: `SJ-YYYYMM-0001`

Nomor dokumen issued tidak boleh dipakai ulang walaupun void.

## 9. Required Export for Finance
Sediakan export CSV:
- Orders.
- Order items.
- Invoices.
- Invoice items.
- Payments.
- Delivery notes.
- Inventory movements.
- Accounting events.

## 10. Candidate Journal Mapping
Ini hanya kandidat mapping, bukan jurnal final.

### Saat invoice issued
Jika kebijakan mengakui piutang saat invoice:
- Dr Piutang Usaha
- Cr Pendapatan Ditangguhkan atau Pendapatan, tergantung apakah kewajiban telah terpenuhi

### Saat goods delivered / revenue recognized
- Dr Pendapatan Ditangguhkan, jika sebelumnya ditangguhkan
- Cr Pendapatan Penjualan

### Saat inventory out / COGS recognized
- Dr Beban Pokok Penjualan
- Cr Persediaan

### Saat payment received
- Dr Kas/Bank
- Cr Piutang Usaha

## 11. Data Controls
- Server-side pricing.
- No negative qty.
- No negative price.
- No deleting issued invoice.
- No deleting delivered order.
- Reversal event for corrections.
- Role permission for finance actions.

## 12. PSAK Caveat
Aplikasi ini harus menyimpan data transaksi yang memadai, bukan menggantikan pertimbangan profesional akuntansi. PSAK 72, PSAK 202, PSAK 109, dan PSAK 201 perlu diterapkan sesuai kebijakan perusahaan, kontrak mitra, syarat pengiriman, retur, diskon, dan materialitas.
