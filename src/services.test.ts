import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './domain.ts';
import { createSeedState } from './seed.ts';
import { calculateOrder, calculateStyrofoamPlan, cancelPartnerOrder, createInvoice, createOrder, findPartnerForUser, getLeaderboard, parseProductWeightGram, revisePartnerOrder, updateOrderQc, updateOrderShipping, updateOrderStatus } from './services.ts';

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

test('thermal truck expedition skips styrofoam packaging fee and packaging item', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address, undefined, undefined, 'truk_thermal_wahyu_beef');
  assert.equal(order.expedition, 'truk_thermal_wahyu_beef');
  assert.equal(order.packingFee, 0);
  assert.equal(order.packingType, 'none');
  assert.equal(order.packingQuantity, 0);
  assert.equal(order.grandTotal, order.subtotal);
  assert.equal(order.items.some((item) => item.productId.startsWith('packaging-styrofoam-')), false);
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

test('partner can revise own pending order without changing order number', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address);
  const originalNumber = order.orderNumber;
  const revised = revisePartnerOrder(state, user, order.id, {
    cartItems: [
      { productId: state.products[1].id, qty: 4, notes: 'Revisi qty' },
      { productId: state.products[2].id, qty: 2 },
    ],
    requestedDeliveryDate: '2026-06-20',
    expedition: 'esboks',
  });
  assert.equal(revised.orderNumber, originalNumber);
  assert.equal(revised.items.filter((item) => !item.productId.startsWith('packaging-')).length, 2);
  assert.equal(revised.requestedDeliveryDate, '2026-06-20');
  assert.equal(revised.expedition, 'esboks');
  assert.equal(state.auditLogs[0].action, 'ORDER_REVISED_BY_PARTNER');
});

test('partner cannot revise order that is already being processed', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3 }], partner.address);
  order.status = 'in_production';
  assert.throws(() => revisePartnerOrder(state, user, order.id, { cartItems: [{ productId: state.products[1].id, qty: 4 }] }), /sebelum diproses/);
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


test('admin QC input adjusts delivered qty, packaging qty, packing fee, and order total', () => {
  const state = createSeedState();
  const warehouse = state.users.find((item) => item.email === 'warehouse@frozen.local')!;
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 10 }], partner.address);
  order.status = 'ready_to_ship';
  const productItem = order.items.find((item) => !item.productId.startsWith('packaging-'))!;
  const packagingItem = order.items.find((item) => item.productId.startsWith('packaging-'))!;
  updateOrderQc(state, warehouse, order.id, { items: [
    { itemId: productItem.id, qcDeliveredQty: 8 },
    { itemId: packagingItem.id, qcDeliveredQty: 0 },
  ] });
  assert.equal(productItem.qcDeliveredQty, 8);
  assert.equal(productItem.lineTotal, productItem.unitPrice * 8);
  assert.equal(packagingItem.qcDeliveredQty, 0);
  assert.equal(packagingItem.lineTotal, 0);
  assert.equal(order.subtotal, productItem.unitPrice * 8);
  assert.equal(order.packingFee, 0);
  assert.equal(order.packingQuantity, 0);
  assert.equal(order.packingType, 'none');
  assert.equal(order.grandTotal, order.subtotal + (order.shippingCost ?? 0));
  assert.equal(state.auditLogs[0].action, 'ORDER_QC_UPDATED');
});


test('leaderboard counts shipped orders as terkirim ranking source', () => {
  const state = createSeedState();
  const rows = getLeaderboard(state);
  const shippedPartnerIds = new Set(state.orders.filter((item) => item.status === 'shipped').map((item) => item.partnerId));
  const deliveredPartnerIds = new Set(state.orders.filter((item) => item.status === 'delivered').map((item) => item.partnerId));
  assert.equal(rows.length, shippedPartnerIds.size);
  assert.deepEqual(new Set(rows.map((row) => row.partnerId)), shippedPartnerIds);
  assert.notDeepEqual(new Set(rows.map((row) => row.partnerId)), deliveredPartnerIds);
  assert.equal(rows.reduce((sum, row) => sum + row.totalOrders, 0), state.orders.filter((item) => item.status === 'shipped').length);
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
