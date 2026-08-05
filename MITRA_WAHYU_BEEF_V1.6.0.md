# Aplikasi Mitra Wahyu Beef v1.6.0

## Ringkasan
Update promo produk periode Agustus 2026. Fokus menu produk saja; tidak menyenggol menu lain (order management, dashboard, invoice, leaderboard). Promo Juli 2026 tetap disimpan dan otomatis nonaktif setelah rangenya berakhir.

## Promo Agustus 2026 (produk)
Aktif 2026-08-01 00:00 → 2026-08-31 23:59 (+07:00), auto-expire.

| # | Produk | Product ID | Diskon |
|---|--------|-----------|--------|
| 1 | Babat Sapi Ungkep | prd-prs-003 | 8% |
| 2 | Bakso Sapi | prd-prs-004 | 8% |
| 3 | Hati Sapi Ungkep | prd-prs-009 | 18% |
| 4 | Kikil Sapi | prd-jrh-007 | 8% |
| 5 | Hati Sapi | prd-jrh-001 | 8% |
| 6 | Tulang Sapi / Beef Bone | prd-tls-006 | 8% |
| 7 | Iga Reguler / Spare Ribs | prd-tls-004 | 8% |
| 8 | Buntut Reg. / Oxtail | prd-tls-002 | 8% |

## Files changed
- `src/promotions.ts` — tambah `august2026ProductPromotions` + gabung ke `productPromotions`
- `src/promotions.test.ts` — test promo Agustus aktif + auto-expire
- `src/main.tsx` — label versi `Versi Aplikasi v1.6.0`
- `package.json` — version `1.6.0`

## Verifikasi
- `npm run typecheck` ✅
- `npm test` 17/17 ✅
- `npm run build` ✅
- Bundle `dist/assets/index-DKpDnNUv.js` berisi `Versi Aplikasi v1.6.0`, `Promo Agustus 8%`, `Promo Agustus 18%`
- CSS hash tidak berubah (tidak ada perubahan style)

## Catatan rollback
- Source-level: tag `aplikasi-mitra-wahyu-beef-v1.6.0`
- Cloudflare Pages: pilih deployment snapshot sebelumnya (`3d810f09` = v1.5.0)
