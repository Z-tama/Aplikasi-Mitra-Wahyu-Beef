import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './domain.ts';
import { createSeedState } from './seed.ts';
import { calculateOrder, createInvoice, createOrder, findPartnerForUser, updateOrderStatus } from './services.ts';

test('tier pricing uses partner tier and snapshots totals', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'distributor@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const product = state.products[0];
  const tierPrice = state.prices.find((item) => item.productId === product.id && item.tierId === partner.tierId)!.price;
  const calculated = calculateOrder(state, partner.id, [{ productId: product.id, qty: 10 }]);
  assert.equal(calculated.grandTotal, tierPrice * 10);
  assert.equal(calculated.items[0].unitPrice, tierPrice);
  assert.equal(calculated.items[0].productNameSnapshot, product.name);
});

test('checkout creates pending order and accounting event without recognizing revenue', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address);
  assert.equal(order.status, 'pending');
  assert.equal(state.accountingEvents[0].eventType, 'ORDER_CREATED');
  assert.equal(state.accountingEvents[0].metadata.revenueRecognized, false);
});

test('order status transition follows lifecycle rules', () => {
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('pending', 'delivered'), false);
  const state = createSeedState();
  const admin = state.users.find((item) => item.email === 'sales@frozen.local')!;
  const order = state.orders.find((item) => item.status === 'pending')!;
  updateOrderStatus(state, admin, order.id, 'confirmed', 'OK');
  assert.equal(order.status, 'confirmed');
  assert.throws(() => updateOrderStatus(state, admin, order.id, 'delivered'));
});

test('invoice generation mirrors order snapshot total', () => {
  const state = createSeedState();
  const finance = state.users.find((item) => item.email === 'finance@frozen.local')!;
  const order = state.orders.find((item) => item.status === 'shipped')!;
  const invoice = createInvoice(state, finance, order.id);
  assert.equal(invoice.grandTotal, order.grandTotal);
  assert.equal(invoice.amountDue, order.grandTotal);
  assert.equal(invoice.status, 'issued');
  assert.equal(state.accountingEvents[0].eventType, 'INVOICE_ISSUED');
});
