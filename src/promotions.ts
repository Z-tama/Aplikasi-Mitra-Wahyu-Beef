import type { Product } from './domain';

export interface ProductPromotion {
  productId: string;
  percent: number;
  label: string;
  startsAt: string;
  endsAt: string;
}

export const july2026PromotionStartsAt = '2026-07-01T00:00:00+07:00';
export const july2026PromotionEndsAt = '2026-07-31T23:59:59+07:00';

export const july2026ProductPromotions: ProductPromotion[] = [
  { productId: 'prd-prs-003', percent: 10, label: 'Promo Juli 10%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-prs-015', percent: 10, label: 'Promo Juli 10%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-prs-009', percent: 10, label: 'Promo Juli 10%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-tls-010', percent: 30, label: 'Promo Juli 30%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-jrh-001', percent: 10, label: 'Promo Juli 10%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-tls-006', percent: 7, label: 'Promo Juli 7%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-tls-004', percent: 7, label: 'Promo Juli 7%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
  { productId: 'prd-tls-002', percent: 7, label: 'Promo Juli 7%', startsAt: july2026PromotionStartsAt, endsAt: july2026PromotionEndsAt },
];

export const august2026PromotionStartsAt = '2026-08-01T00:00:00+07:00';
export const august2026PromotionEndsAt = '2026-08-31T23:59:59+07:00';

export const august2026ProductPromotions: ProductPromotion[] = [
  { productId: 'prd-prs-003', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-prs-004', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-prs-009', percent: 18, label: 'Promo Agustus 18%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-jrh-007', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-jrh-001', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-tls-006', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-tls-004', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
  { productId: 'prd-tls-002', percent: 8, label: 'Promo Agustus 8%', startsAt: august2026PromotionStartsAt, endsAt: august2026PromotionEndsAt },
];

export const productPromotions: ProductPromotion[] = [
  ...july2026ProductPromotions,
  ...august2026ProductPromotions,
];

export function getActiveProductPromotion(productId: string, now: Date = new Date()) {
  const timestamp = now.getTime();
  return productPromotions.find((promo) => promo.productId === productId && timestamp >= new Date(promo.startsAt).getTime() && timestamp <= new Date(promo.endsAt).getTime());
}

export function isProductOnPromo(productId: string, now: Date = new Date()) {
  return Boolean(getActiveProductPromotion(productId, now));
}

export function applyProductPromotion(price: number, productId: string, now: Date = new Date()) {
  const promo = getActiveProductPromotion(productId, now);
  if (!promo || price <= 0) return { price, normalPrice: price, discountAmount: 0, promo: undefined };
  const discountAmount = Math.round(price * (promo.percent / 100));
  return { price: Math.max(0, price - discountAmount), normalPrice: price, discountAmount, promo };
}

export function promotionSearchText(product: Pick<Product, 'id' | 'name' | 'sku'>) {
  const promo = getActiveProductPromotion(product.id);
  return promo ? `${product.name} ${product.sku} ${promo.label}` : `${product.name} ${product.sku}`;
}
