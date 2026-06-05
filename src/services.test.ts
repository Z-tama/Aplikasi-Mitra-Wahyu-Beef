import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './domain.ts';
import { createSeedState } from './seed.ts';
import { calculateOrder, calculateStyrofoamPlan, cancelPartnerOrder, createInvoice, createOrder, findPartnerForUser, parseProductWeightGram, updateOrderShipping, updateOrderStatus } from './services.ts';

test('tier pricing uses partner tier and snapshots totals', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'distributor@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const product = state.products[0];
  const tierPrice = state.prices.find((item) => item.productId === product.id && item.tierId === partner.tierId)!.price;
  const calculated = calculateOrder(state, partner.id, [{ productId: product.id, qty: 10 }]);
  assert.equal(calculated.subtotal, tierPrice * 10);
  assert.equal(calculated.grandTotal, calculated.subtotal + calculated.packingFee);
  assert.equal(calculated.items[0].unitPrice, tierPrice);
  assert.equal(calculated.items[0].productNameSnapshot, product.name);
});

test('processed meat without explicit gram defaults to 250 gram per pcs', () => {
  assert.equal(parseProductWeightGram({ unit: '5 POTONG', categoryId: 'cat-processed-meat' }), 250);
  assert.equal(parseProductWeightGram({ unit: '1 PACK', categoryId: 'cat-processed-meat' }), 250);
  assert.equal(parseProductWeightGram({ unit: '200 GR', categoryId: 'cat-processed-meat' }), 200);
});

test('styrofoam plan uses large boxes first and remainder box by weight range', () => {
  const plan = calculateStyrofoamPlan(120000);
  assert.deepEqual(plan.map((item) => ({ size: item.size, qty: item.qty, lineTotal: item.lineTotal })), [
    { size: 'large', qty: 2, lineTotal: 100000 },
    { size: 'medium', qty: 1, lineTotal: 30000 },
  ]);
});

test('checkout creates pending order, preserves requested delivery date and item notes, and accounting event without recognizing revenue', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const itemNote = 'Tolong potong kecil dan pilih yang minim lemak';
  const requestedDeliveryDate = '2026-05-30';
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3, notes: `  ${itemNote}  ` }], partner.address, undefined, requestedDeliveryDate);
  assert.equal(order.status, 'pending');
  assert.equal(order.requestedDeliveryDate, requestedDeliveryDate);
  assert.equal(order.items[0].notes, itemNote);
  assert.ok(order.items.some((item) => item.productId.startsWith('packaging-styrofoam-')));
  assert.equal(order.grandTotal, order.subtotal + (order.packingFee ?? 0));
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

test('partner can cancel own order before it is processed', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address);
  cancelPartnerOrder(state, user, order.id);
  assert.equal(order.status, 'cancelled');
  assert.equal(state.accountingEvents[0].eventType, 'ORDER_CANCELLED');
});

test('partner cannot cancel order that is already being processed', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address);
  order.status = 'in_production';
  assert.throws(() => cancelPartnerOrder(state, user, order.id), /sebelum diproses/);
});

test('admin can add ongkir, packing qty, and tracking receipt before customer tracking', () => {
  const state = createSeedState();
  const warehouse = state.users.find((item) => item.email === 'warehouse@frozen.local')!;
  const order = state.orders.find((item) => item.status === 'shipped')!;
  const originalSubtotal = order.subtotal;
  updateOrderShipping(state, warehouse, order.id, {
    shippingCost: 45000,
    packingFee: 150000,
    packingType: 'large_styrofoam',
    packingQuantity: 3,
    trackingNumber: 'JNE123456789',
    trackingReceiptUrl: 'data:image/png;base64,ZmFrZS1yZXNp',
  });
  assert.equal(order.shippingCost, 45000);
  assert.equal(order.packingFee, 150000);
  assert.equal(order.packingType, 'large_styrofoam');
  assert.equal(order.packingQuantity, 3);
  assert.equal(order.trackingNumber, 'JNE123456789');
  assert.equal(order.trackingReceiptUrl, 'data:image/png;base64,ZmFrZS1yZXNp');
  assert.equal(order.grandTotal, originalSubtotal + 195000);
  assert.equal(state.auditLogs[0].action, 'ORDER_SHIPPING_UPDATED');
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
