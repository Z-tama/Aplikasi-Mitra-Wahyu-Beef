import type { Product } from './domain';

export interface ProductPromotion {
  productId: string;
  percent: number;
  label: string;
  startsAt: string;
  endsAt: string;
}

export const june2026PromotionStartsAt = '2026-06-01T00:00:00+07:00';
export const june2026PromotionEndsAt = '2026-06-30T23:59:59+07:00';

export const june2026ProductPromotions: ProductPromotion[] = [
  { productId: 'prd-prs-003', percent: 10, label: 'Promo Juni 10%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-prs-015', percent: 10, label: 'Promo Juni 10%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-prs-004', percent: 6, label: 'Promo Juni 6%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-tls-010', percent: 30, label: 'Promo Juni 30%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-jrh-001', percent: 6, label: 'Promo Juni 6%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-tls-006', percent: 6, label: 'Promo Juni 6%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-dgs-017', percent: 6, label: 'Promo Juni 6%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
  { productId: 'prd-prs-035', percent: 6, label: 'Promo Juni 6%', startsAt: june2026PromotionStartsAt, endsAt: june2026PromotionEndsAt },
];

export function getActiveProductPromotion(productId: string, now: Date = new Date()) {
  const timestamp = now.getTime();
  return june2026ProductPromotions.find((promo) => promo.productId === productId && timestamp >= new Date(promo.startsAt).getTime() && timestamp <= new Date(promo.endsAt).getTime());
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
