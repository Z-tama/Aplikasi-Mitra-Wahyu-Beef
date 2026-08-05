import assert from 'node:assert/strict';
import test from 'node:test';
import { applyProductPromotion, getActiveProductPromotion, july2026ProductPromotions, august2026ProductPromotions } from './promotions.ts';

const julyPromoProducts = [
  ['prd-prs-003', 10],
  ['prd-prs-015', 10],
  ['prd-prs-009', 10],
  ['prd-tls-010', 30],
  ['prd-jrh-001', 10],
  ['prd-tls-006', 7],
  ['prd-tls-004', 7],
  ['prd-tls-002', 7],
] as const;

const augustPromoProducts = [
  ['prd-prs-003', 8],
  ['prd-prs-004', 8],
  ['prd-prs-009', 18],
  ['prd-jrh-007', 8],
  ['prd-jrh-001', 8],
  ['prd-tls-006', 8],
  ['prd-tls-004', 8],
  ['prd-tls-002', 8],
] as const;

test('promo Juli 2026 aktif sesuai daftar produk dan persen', () => {
  assert.equal(july2026ProductPromotions.length, julyPromoProducts.length);
  for (const [productId, percent] of julyPromoProducts) {
    const promo = getActiveProductPromotion(productId, new Date('2026-07-15T12:00:00+07:00'));
    assert.equal(promo?.percent, percent);
    assert.equal(promo?.label, `Promo Juli ${percent}%`);
  }
});

test('promo Agustus 2026 aktif sesuai daftar produk dan persen', () => {
  assert.equal(august2026ProductPromotions.length, augustPromoProducts.length);
  for (const [productId, percent] of augustPromoProducts) {
    const promo = getActiveProductPromotion(productId, new Date('2026-08-15T12:00:00+07:00'));
    assert.equal(promo?.percent, percent);
    assert.equal(promo?.label, `Promo Agustus ${percent}%`);
  }
});

test('promo Juli 2026 otomatis berakhir setelah Juli', () => {
  const duringPromo = applyProductPromotion(100000, 'prd-tls-010', new Date('2026-07-31T23:59:59+07:00'));
  assert.equal(duringPromo.price, 70000);
  assert.equal(duringPromo.discountAmount, 30000);

  const afterPromo = applyProductPromotion(100000, 'prd-tls-010', new Date('2026-08-01T00:00:00+07:00'));
  assert.equal(afterPromo.price, 100000);
  assert.equal(afterPromo.discountAmount, 0);
  assert.equal(afterPromo.promo, undefined);
});

test('promo Agustus 2026 otomatis berakhir setelah Agustus', () => {
  const during = applyProductPromotion(100000, 'prd-prs-009', new Date('2026-08-15T12:00:00+07:00'));
  assert.equal(during.discountAmount, 18000);
  assert.equal(during.price, 82000);

  const after = applyProductPromotion(100000, 'prd-prs-009', new Date('2026-09-01T00:00:00+07:00'));
  assert.equal(after.discountAmount, 0);
  assert.equal(after.promo, undefined);
});
