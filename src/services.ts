import type { AppState } from './seed.ts';
import { canTransition, todayIso } from './domain.ts';
import type { AccountingEvent, CartItem, DeliveryNote, Invoice, Order, OrderItem, OrderStatus, Payment, User } from './domain.ts';

export function findPartnerForUser(state: AppState, user: User) {
  return state.partners.find((partner) => partner.userId === user.id);
}

export function getCatalogForPartner(state: AppState, partnerId: string) {
  const partner = state.partners.find((item) => item.id === partnerId);
  if (!partner) throw new Error('Mitra tidak ditemukan');
  if (partner.status !== 'active') throw new Error('Mitra tidak aktif/suspended tidak bisa checkout');
  const tier = state.tiers.find((item) => item.id === partner.tierId);
  if (!tier) throw new Error('Tier mitra tidak ditemukan');

  return state.products
    .filter((product) => product.isActive)
    .map((product) => {
      const price = state.prices.find((item) => item.productId === product.id && item.tierId === partner.tierId && item.isActive);
      return {
        ...product,
        tierId: tier.id,
        tierName: tier.name,
        price: price?.price ?? null,
        isPriceComplete: Boolean(price),
      };
    });
}

export function calculateOrder(state: AppState, partnerId: string, cartItems: CartItem[]) {
  if (cartItems.length === 0) throw new Error('Keranjang kosong');
  const partner = state.partners.find((item) => item.id === partnerId);
  if (!partner) throw new Error('Mitra tidak ditemukan');
  if (partner.status !== 'active') throw new Error('Mitra suspended/inactive tidak boleh checkout');
  const tier = state.tiers.find((item) => item.id === partner.tierId);
  if (!tier) throw new Error('Tier tidak ditemukan');

  const items = cartItems.map((cart, index) => {
    const product = state.products.find((item) => item.id === cart.productId && item.isActive);
    if (!product) throw new Error(`Produk ${cart.productId} tidak tersedia`);
    if (cart.qty < product.minimumOrderQty) throw new Error(`${product.name} minimal order ${product.minimumOrderQty}`);
    const tierPrice = state.prices.find((item) => item.productId === product.id && item.tierId === partner.tierId && item.isActive);
    if (!tierPrice) throw new Error(`Harga tier untuk ${product.name} belum diatur`);
    const packageWeightGram = cart.packageWeightGram;
    const canUsePackaging = ['cat-daging-sapi', 'cat-tulang-sapi', 'cat-jerohan-sapi'].includes(product.categoryId);
    const packageRatio = canUsePackaging && packageWeightGram === 250 ? 0.25 : canUsePackaging && packageWeightGram === 500 ? 0.5 : 1;
    const packageLabel = canUsePackaging && packageWeightGram ? `${packageWeightGram} GR` : product.unit;
    const unitPrice = Math.round(tierPrice.price * packageRatio);
    const lineTotal = cart.qty * unitPrice;
    return {
      id: `draft-item-${index + 1}`,
      orderId: 'draft',
      productId: product.id,
      skuSnapshot: product.sku,
      productNameSnapshot: canUsePackaging && packageWeightGram ? `${product.name} ${packageWeightGram} gr` : product.name,
      unitSnapshot: packageLabel,
      tierIdSnapshot: tier.id,
      tierNameSnapshot: tier.name,
      qty: cart.qty,
      unitPrice,
      discountAmount: 0,
      lineTotal,
      notes: cart.notes?.trim() || undefined,
    } satisfies OrderItem;
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items, subtotal, discountTotal: 0, taxTotal: 0, grandTotal: subtotal };
}

export function createOrder(state: AppState, actor: User, partnerId: string, cartItems: CartItem[], shippingAddress: string, notes?: string): Order {
  const calculated = calculateOrder(state, partnerId, cartItems);
  const sequence = state.orders.length + 1;
  const id = `ord-${Date.now()}`;
  const orderNumber = `ORD-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(sequence).padStart(4, '0')}`;
  const items = calculated.items.map((item, index) => ({ ...item, id: `${id}-item-${index + 1}`, orderId: id }));
  const order: Order = {
    id,
    orderNumber,
    partnerId,
    orderDate: new Date().toISOString(),
    status: 'pending',
    subtotal: calculated.subtotal,
    discountTotal: calculated.discountTotal,
    taxTotal: calculated.taxTotal,
    grandTotal: calculated.grandTotal,
    shippingAddress,
    notes,
    createdBy: actor.id,
    items,
  };
  state.orders.unshift(order);
  state.statusHistories.unshift({ id: `hist-${Date.now()}`, orderId: id, toStatus: 'pending', note: 'Order dibuat mitra', changedBy: actor.id, changedAt: new Date().toISOString() });
  audit(state, actor.id, 'ORDER_CREATED', 'order', id, undefined, order);
  accounting(state, 'ORDER_CREATED', 'order', id, partnerId, order.grandTotal, { revenueRecognized: false, note: 'Order created belum revenue' }, actor.id);
  return order;
}

export function updateOrderShipping(state: AppState, actor: User, orderId: string, input: { shippingCost?: number; packingFee?: number; packingType?: Order['packingType']; trackingNumber?: string; trackingReceiptUrl?: string }) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  const oldValue = { shippingCost: order.shippingCost, packingFee: order.packingFee, packingType: order.packingType, trackingNumber: order.trackingNumber, trackingReceiptUrl: order.trackingReceiptUrl, grandTotal: order.grandTotal };
  const shippingCost = Number(input.shippingCost ?? 0);
  const packingFee = Number(input.packingFee ?? 0);
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw new Error('Ongkir tidak valid');
  if (!Number.isFinite(packingFee) || packingFee < 0) throw new Error('Biaya packing tidak valid');
  order.shippingCost = Math.round(shippingCost);
  order.packingFee = Math.round(packingFee);
  order.packingType = input.packingType ?? 'none';
  order.trackingNumber = input.trackingNumber?.trim() || undefined;
  order.trackingReceiptUrl = input.trackingReceiptUrl?.trim() || undefined;
  order.grandTotal = order.subtotal - order.discountTotal + order.taxTotal + (order.shippingCost ?? 0) + (order.packingFee ?? 0);
  audit(state, actor.id, 'ORDER_SHIPPING_UPDATED', 'order', orderId, oldValue, { shippingCost: order.shippingCost, packingFee: order.packingFee, packingType: order.packingType, trackingNumber: order.trackingNumber, trackingReceiptUrl: order.trackingReceiptUrl, grandTotal: order.grandTotal });
  return order;
}

export function updateOrderStatus(state: AppState, actor: User, orderId: string, targetStatus: OrderStatus, note?: string) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (!canTransition(order.status, targetStatus)) throw new Error(`Transisi ${order.status} -> ${targetStatus} tidak valid`);
  const oldStatus = order.status;
  order.status = targetStatus;
  if (targetStatus === 'delivered') order.deliveredAt = new Date().toISOString();
  state.statusHistories.unshift({ id: `hist-${Date.now()}`, orderId, fromStatus: oldStatus, toStatus: targetStatus, note, changedBy: actor.id, changedAt: new Date().toISOString() });
  audit(state, actor.id, 'ORDER_STATUS_UPDATED', 'order', orderId, { status: oldStatus }, { status: targetStatus, note });
  if (targetStatus === 'shipped') accounting(state, 'GOODS_SHIPPED', 'order', orderId, order.partnerId, order.grandTotal, { status: targetStatus }, actor.id);
  if (targetStatus === 'delivered') accounting(state, 'GOODS_DELIVERED', 'order', orderId, order.partnerId, order.grandTotal, { psak72: 'Eligible revenue recognition jika kontrol berpindah sesuai kebijakan' }, actor.id);
  if (targetStatus === 'cancelled') accounting(state, 'ORDER_CANCELLED', 'order', orderId, order.partnerId, order.grandTotal, { note }, actor.id);
  return order;
}

export function createDeliveryNote(state: AppState, actor: User, orderId: string, driverName?: string, vehicleNumber?: string): DeliveryNote {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (order.status === 'cancelled' || order.status === 'pending') throw new Error('Surat jalan hanya untuk order valid yang sudah dikonfirmasi');
  const existing = state.deliveryNotes.find((item) => item.orderId === orderId && item.status !== 'void');
  if (existing) return existing;
  const deliveryNote: DeliveryNote = {
    id: `dn-${Date.now()}`,
    deliveryNoteNumber: `SJ-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(state.deliveryNotes.length + 1).padStart(4, '0')}`,
    orderId,
    deliveryDate: todayIso(),
    driverName,
    vehicleNumber,
    status: 'issued',
    issuedBy: actor.id,
    issuedAt: new Date().toISOString(),
  };
  state.deliveryNotes.unshift(deliveryNote);
  audit(state, actor.id, 'DELIVERY_NOTE_CREATED', 'delivery_note', deliveryNote.id, undefined, deliveryNote);
  accounting(state, 'DELIVERY_NOTE_CREATED', 'delivery_note', deliveryNote.id, order.partnerId, order.grandTotal, { orderId }, actor.id);
  return deliveryNote;
}

export function createInvoice(state: AppState, actor: User, orderId: string): Invoice {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (order.status === 'cancelled') throw new Error('Invoice tidak boleh dibuat untuk order cancelled');
  const existing = state.invoices.find((item) => item.orderId === orderId && item.status !== 'void');
  if (existing) return existing;
  const partner = state.partners.find((item) => item.id === order.partnerId);
  const due = new Date();
  due.setDate(due.getDate() + (partner?.paymentTermDays ?? 0));
  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber: `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(state.invoices.length + 1).padStart(4, '0')}`,
    orderId,
    partnerId: order.partnerId,
    invoiceDate: todayIso(),
    dueDate: due.toISOString().slice(0, 10),
    status: 'issued',
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    grandTotal: order.grandTotal,
    amountPaid: 0,
    amountDue: order.grandTotal,
    issuedBy: actor.id,
    issuedAt: new Date().toISOString(),
  };
  state.invoices.unshift(invoice);
  audit(state, actor.id, 'INVOICE_ISSUED', 'invoice', invoice.id, undefined, invoice);
  accounting(state, 'INVOICE_ISSUED', 'invoice', invoice.id, order.partnerId, order.grandTotal, { psakNote: 'Invoice issued; jurnal final mengikuti kebijakan finance' }, actor.id);
  return invoice;
}

export function recordPayment(state: AppState, actor: User, invoiceId: string, amount: number, method: Payment['method'], referenceNumber?: string): Payment {
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error('Invoice tidak ditemukan');
  if (invoice.status === 'void') throw new Error('Invoice void tidak bisa dibayar');
  if (amount <= 0) throw new Error('Nominal pembayaran harus positif');
  if (amount > invoice.amountDue) throw new Error('Pembayaran melebihi outstanding');
  const payment: Payment = { id: `pay-${Date.now()}`, invoiceId, paymentDate: todayIso(), amount, method, referenceNumber, receivedBy: actor.id };
  state.payments.unshift(payment);
  invoice.amountPaid += amount;
  invoice.amountDue = Math.max(0, invoice.grandTotal - invoice.amountPaid);
  invoice.status = invoice.amountDue === 0 ? 'paid' : 'partial';
  audit(state, actor.id, 'PAYMENT_RECEIVED', 'payment', payment.id, undefined, payment);
  accounting(state, 'PAYMENT_RECEIVED', 'payment', payment.id, invoice.partnerId, amount, { invoiceId }, actor.id);
  return payment;
}

export function getLeaderboard(state: AppState) {
  const rows = state.partners.map((partner) => {
    const delivered = state.orders.filter((order) => order.partnerId === partner.id && order.status === 'delivered');
    const totalOrderValue = delivered.reduce((sum, order) => sum + order.grandTotal, 0);
    const totalOrderQty = delivered.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    const tier = state.tiers.find((item) => item.id === partner.tierId);
    return { partnerId: partner.id, partnerName: partner.businessName, tier: tier?.name ?? '-', totalOrderValue, totalOrderQty, totalOrders: delivered.length, points: Math.floor(totalOrderValue / 100000), rank: 0 };
  }).filter((row) => row.totalOrders > 0).sort((a, b) => b.points - a.points || b.totalOrderValue - a.totalOrderValue);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function audit(state: AppState, actorUserId: string, action: string, entityType: string, entityId: string, oldValue?: unknown, newValue?: unknown) {
  state.auditLogs.unshift({ id: `audit-${Date.now()}-${state.auditLogs.length}`, actorUserId, action, entityType, entityId, oldValue, newValue, timestamp: new Date().toISOString() });
}

function accounting(state: AppState, eventType: AccountingEvent['eventType'], referenceType: string, referenceId: string, partnerId: string | undefined, amount: number | undefined, metadata: Record<string, unknown>, createdBy: string) {
  state.accountingEvents.unshift({ id: `ae-${Date.now()}-${state.accountingEvents.length}`, eventType, referenceType, referenceId, partnerId, eventDate: new Date().toISOString(), amount, currency: 'IDR', status: 'pending_mapping', metadata, createdBy });
}
