import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition } from './domain.ts';
import { createSeedState } from './seed.ts';
import { calculateOrder, createInvoice, createOrder, findPartnerForUser, updateOrderShipping, updateOrderStatus } from './services.ts';

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

test('checkout creates pending order, preserves item notes, and accounting event without recognizing revenue', () => {
  const state = createSeedState();
  const user = state.users.find((item) => item.email === 'agen@mitra.local')!;
  const partner = findPartnerForUser(state, user)!;
  const itemNote = 'Tolong potong kecil dan pilih yang minim lemak';
  const order = createOrder(state, user, partner.id, [{ productId: state.products[1].id, qty: 3, notes: `  ${itemNote}  ` }], partner.address);
  assert.equal(order.status, 'pending');
  assert.equal(order.items[0].notes, itemNote);
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
