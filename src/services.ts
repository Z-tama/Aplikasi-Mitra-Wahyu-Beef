import type { AppState } from './seed.ts';
import { canTransition, defaultExpedition, thermalTruckExpedition, todayIso } from './domain.ts';
import type { AccountingEvent, CartItem, ExpeditionType, Invoice, Order, OrderItem, OrderStatus, Payment, Product, User } from './domain.ts';

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

export type StyrofoamSize = 'small' | 'medium' | 'large';

export interface StyrofoamPlanItem {
  size: StyrofoamSize;
  label: string;
  capacityLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export function parseProductWeightGram(product: Pick<Product, 'unit' | 'weightGram' | 'categoryId'>, packageWeightGram?: number) {
  if (packageWeightGram) return packageWeightGram;
  if (product.weightGram && product.weightGram > 0) return product.weightGram;
  const unit = product.unit.toUpperCase().replace(',', '.');
  const match = unit.match(/(\d+(?:\.\d+)?)\s*(KG|KILOGRAM|GR|GRAM|G)\b/);
  if (!match) return product.categoryId === 'cat-processed-meat' ? 250 : 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return product.categoryId === 'cat-processed-meat' ? 250 : 0;
  return match[2].startsWith('KG') || match[2] === 'KILOGRAM' ? Math.round(value * 1000) : Math.round(value);
}

export function calculateCartWeightGram(products: Product[], cartItems: CartItem[]) {
  return cartItems.reduce((sum, cart) => {
    const product = products.find((item) => item.id === cart.productId);
    if (!product) return sum;
    return sum + parseProductWeightGram(product, cart.packageWeightGram) * cart.qty;
  }, 0);
}

export function calculateStyrofoamPlan(totalWeightGram: number): StyrofoamPlanItem[] {
  const totalKg = Math.ceil(Math.max(0, totalWeightGram) / 1000);
  if (totalKg <= 0) return [];
  const options = {
    small: { size: 'small' as const, label: 'Sterofoam kecil', capacityLabel: '1-15 kg', unitPrice: 20000 },
    medium: { size: 'medium' as const, label: 'Sterofoam sedang', capacityLabel: '15-30 kg', unitPrice: 30000 },
    large: { size: 'large' as const, label: 'Sterofoam besar', capacityLabel: '30-50 kg', unitPrice: 50000 },
  };
  const largeQty = Math.floor(totalKg / 50);
  const remainder = totalKg % 50;
  const plan: StyrofoamPlanItem[] = [];
  if (largeQty > 0) plan.push({ ...options.large, qty: largeQty, lineTotal: largeQty * options.large.unitPrice });
  if (remainder > 0) {
    const option = remainder <= 15 ? options.small : remainder <= 30 ? options.medium : options.large;
    plan.push({ ...option, qty: 1, lineTotal: option.unitPrice });
  }
  return plan;
}

function styrofoamOrderItems(plan: StyrofoamPlanItem[], startIndex: number): OrderItem[] {
  return plan.map((item, index) => ({
    id: `draft-item-${startIndex + index + 1}`,
    orderId: 'draft',
    productId: `packaging-styrofoam-${item.size}`,
    skuSnapshot: `PACK-STYROFOAM-${item.size.toUpperCase()}`,
    productNameSnapshot: item.label,
    unitSnapshot: `${item.capacityLabel} / pcs`,
    tierIdSnapshot: 'packing',
    tierNameSnapshot: 'Biaya Kemasan',
    qty: item.qty,
    unitPrice: item.unitPrice,
    discountAmount: 0,
    lineTotal: item.lineTotal,
    notes: `Otomatis dari total berat pesanan`,
  }));
}

export function calculateOrder(state: AppState, partnerId: string, cartItems: CartItem[], expedition: ExpeditionType = defaultExpedition) {
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
  const totalWeightGram = calculateCartWeightGram(state.products, cartItems);
  const shouldUseStyrofoam = expedition !== thermalTruckExpedition;
  const styrofoamPlan = shouldUseStyrofoam ? calculateStyrofoamPlan(totalWeightGram) : [];
  const packingFee = styrofoamPlan.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items: [...items, ...styrofoamOrderItems(styrofoamPlan, items.length)], subtotal, discountTotal: 0, taxTotal: 0, packingFee, totalWeightGram, styrofoamPlan, grandTotal: subtotal + packingFee };
}

export function createOrder(state: AppState, actor: User, partnerId: string, cartItems: CartItem[], shippingAddress: string, notes?: string, requestedDeliveryDate?: string, expedition: ExpeditionType = defaultExpedition): Order {
  const calculated = calculateOrder(state, partnerId, cartItems, expedition);
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
    expedition,
    packingFee: calculated.packingFee,
    packingType: calculated.styrofoamPlan.length === 1 ? `${calculated.styrofoamPlan[0].size}_styrofoam` as Order['packingType'] : calculated.styrofoamPlan.length ? 'large_styrofoam' : 'none',
    packingQuantity: calculated.styrofoamPlan.reduce((sum, item) => sum + item.qty, 0),
    requestedDeliveryDate,
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

export function revisePartnerOrder(state: AppState, actor: User, orderId: string, input: { cartItems: CartItem[]; requestedDeliveryDate?: string; expedition?: ExpeditionType; notes?: string }) {
  if (actor.role !== 'partner') throw new Error('Hanya akun mitra yang bisa mengedit pesanan lewat menu Order Saya');
  const partner = findPartnerForUser(state, actor);
  if (!partner) throw new Error('Profil mitra tidak ditemukan');
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (order.partnerId !== partner.id) throw new Error('Order ini bukan milik mitra yang sedang login');
  if (!['pending', 'confirmed'].includes(order.status)) throw new Error('Order hanya bisa diedit sebelum diproses / dispatching');
  if (!input.cartItems.length) throw new Error('Pesanan wajib memiliki minimal 1 item produk');

  const oldValue = {
    subtotal: order.subtotal,
    grandTotal: order.grandTotal,
    packingFee: order.packingFee,
    packingType: order.packingType,
    packingQuantity: order.packingQuantity,
    requestedDeliveryDate: order.requestedDeliveryDate,
    expedition: order.expedition,
    itemCount: order.items.length,
  };
  const expedition = input.expedition ?? order.expedition ?? defaultExpedition;
  const calculated = calculateOrder(state, partner.id, input.cartItems, expedition);
  const revisedItems = calculated.items.map((item, index) => ({ ...item, id: `${order.id}-item-${index + 1}`, orderId: order.id }));

  order.subtotal = calculated.subtotal;
  order.discountTotal = calculated.discountTotal;
  order.taxTotal = calculated.taxTotal;
  order.grandTotal = calculated.grandTotal + (order.shippingCost ?? 0);
  order.packingFee = calculated.packingFee;
  order.packingType = calculated.styrofoamPlan.length === 1 ? `${calculated.styrofoamPlan[0].size}_styrofoam` as Order['packingType'] : calculated.styrofoamPlan.length ? 'large_styrofoam' : 'none';
  order.packingQuantity = calculated.styrofoamPlan.reduce((sum, item) => sum + item.qty, 0);
  order.requestedDeliveryDate = input.requestedDeliveryDate || undefined;
  order.expedition = expedition;
  order.notes = input.notes?.trim() || order.notes;
  order.items = revisedItems;

  const newValue = {
    subtotal: order.subtotal,
    grandTotal: order.grandTotal,
    packingFee: order.packingFee,
    packingType: order.packingType,
    packingQuantity: order.packingQuantity,
    requestedDeliveryDate: order.requestedDeliveryDate,
    expedition: order.expedition,
    itemCount: order.items.length,
  };
  state.statusHistories.unshift({ id: `hist-revise-${Date.now()}`, orderId, fromStatus: order.status, toStatus: order.status, note: 'Order direvisi mitra', changedBy: actor.id, changedAt: new Date().toISOString() });
  audit(state, actor.id, 'ORDER_REVISED_BY_PARTNER', 'order', orderId, oldValue, newValue);
  return order;
}

export function updateOrderShipping(state: AppState, actor: User, orderId: string, input: { shippingCost?: number; packingFee?: number; packingType?: Order['packingType']; packingQuantity?: number; trackingNumber?: string; trackingReceiptUrl?: string }) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  const oldValue = { shippingCost: order.shippingCost, packingFee: order.packingFee, packingType: order.packingType, packingQuantity: order.packingQuantity, trackingNumber: order.trackingNumber, trackingReceiptUrl: order.trackingReceiptUrl, grandTotal: order.grandTotal };
  const shippingCost = Number(input.shippingCost ?? 0);
  const packingFee = Number(input.packingFee ?? 0);
  const packingType = input.packingType ?? 'none';
  const packingQuantity = packingType === 'none' ? 0 : Math.round(Number(input.packingQuantity ?? order.packingQuantity ?? 1));
  if (!Number.isFinite(shippingCost) || shippingCost < 0) throw new Error('Ongkir tidak valid');
  if (!Number.isFinite(packingFee) || packingFee < 0) throw new Error('Biaya packing tidak valid');
  if (!Number.isFinite(packingQuantity) || packingQuantity < 0) throw new Error('Qty packing tidak valid');
  order.shippingCost = Math.round(shippingCost);
  order.packingFee = Math.round(packingFee);
  order.packingType = packingType;
  order.packingQuantity = packingQuantity;
  order.trackingNumber = input.trackingNumber?.trim() || undefined;
  order.trackingReceiptUrl = input.trackingReceiptUrl?.trim() || undefined;
  order.grandTotal = order.subtotal - order.discountTotal + order.taxTotal + (order.shippingCost ?? 0) + (order.packingFee ?? 0);
  audit(state, actor.id, 'ORDER_SHIPPING_UPDATED', 'order', orderId, oldValue, { shippingCost: order.shippingCost, packingFee: order.packingFee, packingType: order.packingType, packingQuantity: order.packingQuantity, trackingNumber: order.trackingNumber, trackingReceiptUrl: order.trackingReceiptUrl, grandTotal: order.grandTotal });
  return order;
}


export function updateOrderQc(state: AppState, actor: User, orderId: string, input: { items: { itemId: string; qcDeliveredQty: number }[] }) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (order.status !== 'ready_to_ship') throw new Error('Input QC hanya tersedia pada status Proses QC');
  const oldValue = {
    subtotal: order.subtotal,
    packingFee: order.packingFee,
    packingType: order.packingType,
    packingQuantity: order.packingQuantity,
    grandTotal: order.grandTotal,
    items: order.items.map((item) => ({ id: item.id, qty: item.qty, qcDeliveredQty: item.qcDeliveredQty, lineTotal: item.lineTotal })),
  };
  for (const row of input.items) {
    const item = order.items.find((candidate) => candidate.id === row.itemId);
    if (!item) continue;
    const qty = Math.max(0, Math.min(item.qty, Math.round(Number(row.qcDeliveredQty))));
    if (!Number.isFinite(qty)) throw new Error('Qty hasil QC tidak valid');
    item.qcDeliveredQty = qty;
    item.lineTotal = Math.max(0, qty * item.unitPrice - item.discountAmount);
  }
  const productItems = order.items.filter((item) => !item.productId.startsWith('packaging-'));
  const packagingItems = order.items.filter((item) => item.productId.startsWith('packaging-'));
  order.subtotal = productItems.reduce((sum, item) => sum + item.lineTotal, 0);
  order.packingFee = packagingItems.reduce((sum, item) => sum + item.lineTotal, 0);
  order.packingQuantity = packagingItems.reduce((sum, item) => sum + (item.qcDeliveredQty ?? item.qty), 0);
  const firstActivePackaging = packagingItems.find((item) => (item.qcDeliveredQty ?? item.qty) > 0);
  order.packingType = !order.packingQuantity ? 'none'
    : firstActivePackaging?.productId.includes('small') ? 'small_styrofoam'
      : firstActivePackaging?.productId.includes('medium') ? 'medium_styrofoam'
        : firstActivePackaging?.productId.includes('large') ? 'large_styrofoam'
          : order.packingType;
  order.grandTotal = order.subtotal - order.discountTotal + order.taxTotal + (order.shippingCost ?? 0) + (order.packingFee ?? 0);
  const newValue = {
    subtotal: order.subtotal,
    packingFee: order.packingFee,
    packingType: order.packingType,
    packingQuantity: order.packingQuantity,
    grandTotal: order.grandTotal,
    items: order.items.map((item) => ({ id: item.id, qty: item.qty, qcDeliveredQty: item.qcDeliveredQty, lineTotal: item.lineTotal })),
  };
  audit(state, actor.id, 'ORDER_QC_UPDATED', 'order', orderId, oldValue, newValue);
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

export function cancelPartnerOrder(state: AppState, actor: User, orderId: string, note = 'Dibatalkan oleh mitra') {
  if (actor.role !== 'partner') throw new Error('Hanya akun mitra yang bisa membatalkan order lewat menu Order Saya');
  const partner = findPartnerForUser(state, actor);
  if (!partner) throw new Error('Profil mitra tidak ditemukan');
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order tidak ditemukan');
  if (order.partnerId !== partner.id) throw new Error('Order ini bukan milik mitra yang sedang login');
  if (!['pending', 'confirmed'].includes(order.status)) throw new Error('Order hanya bisa dibatalkan sebelum diproses / dispatching');
  return updateOrderStatus(state, actor, orderId, 'cancelled', note);
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
    const shipped = state.orders.filter((order) => order.partnerId === partner.id && order.status === 'shipped');
    const totalOrderValue = shipped.reduce((sum, order) => sum + order.grandTotal, 0);
    const totalOrderQty = shipped.reduce((sum, order) => sum + order.items.filter((item) => !item.productId.startsWith('packaging-')).reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    const tier = state.tiers.find((item) => item.id === partner.tierId);
    return { partnerId: partner.id, partnerName: partner.businessName, tier: tier?.name ?? '-', totalOrderValue, totalOrderQty, totalOrders: shipped.length, points: Math.floor(totalOrderValue / 100000), rank: 0 };
  }).filter((row) => row.totalOrders > 0).sort((a, b) => b.points - a.points || b.totalOrderValue - a.totalOrderValue);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function audit(state: AppState, actorUserId: string, action: string, entityType: string, entityId: string, oldValue?: unknown, newValue?: unknown) {
  state.auditLogs.unshift({ id: `audit-${Date.now()}-${state.auditLogs.length}`, actorUserId, action, entityType, entityId, oldValue, newValue, timestamp: new Date().toISOString() });
}

function accounting(state: AppState, eventType: AccountingEvent['eventType'], referenceType: string, referenceId: string, partnerId: string | undefined, amount: number | undefined, metadata: Record<string, unknown>, createdBy: string) {
  state.accountingEvents.unshift({ id: `ae-${Date.now()}-${state.accountingEvents.length}`, eventType, referenceType, referenceId, partnerId, eventDate: new Date().toISOString(), amount, currency: 'IDR', status: 'pending_mapping', metadata, createdBy });
}
