import type { AccountingEvent, AuditLog, DeliveryNote, Invoice, Order, OrderStatusHistory, Partner, PartnerTier, Payment, Product, ProductCategory, ProductTierPrice, User } from './domain';

export interface AppState {
  users: User[];
  tiers: PartnerTier[];
  partners: Partner[];
  categories: ProductCategory[];
  products: Product[];
  prices: ProductTierPrice[];
  orders: Order[];
  statusHistories: OrderStatusHistory[];
  deliveryNotes: DeliveryNote[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditLog[];
  accountingEvents: AccountingEvent[];
}

export const demoPasswords: Record<string, string> = {
  'admin@frozen.local': 'password',
  'sales@frozen.local': 'password',
  'finance@frozen.local': 'password',
  'warehouse@frozen.local': 'password',
  'distributor@mitra.local': 'password',
  'agen@mitra.local': 'password',
  'reseller@mitra.local': 'password',
};

export function createSeedState(): AppState {
  const tiers: PartnerTier[] = [
    { id: 'tier-distributor', code: 'DISTRIBUTOR', name: 'Distributor', rankOrder: 1, description: 'Mitra volume besar', isActive: true },
    { id: 'tier-agen', code: 'AGEN', name: 'Agen', rankOrder: 2, description: 'Mitra reguler area', isActive: true },
    { id: 'tier-reseller', code: 'RESELLER', name: 'Reseller', rankOrder: 3, description: 'Mitra retail awal', isActive: true },
  ];

  const users: User[] = [
    { id: 'u-admin', name: 'Sari Owner', email: 'admin@frozen.local', role: 'super_admin', status: 'active' },
    { id: 'u-sales', name: 'Raka Sales', email: 'sales@frozen.local', role: 'sales_admin', status: 'active' },
    { id: 'u-finance', name: 'Maya Finance', email: 'finance@frozen.local', role: 'finance_admin', status: 'active' },
    { id: 'u-warehouse', name: 'Dimas Warehouse', email: 'warehouse@frozen.local', role: 'warehouse', status: 'active' },
    { id: 'u-distributor', name: 'Budi Distributor', email: 'distributor@mitra.local', role: 'partner', status: 'active' },
    { id: 'u-agen', name: 'Nina Agen', email: 'agen@mitra.local', role: 'partner', status: 'active' },
    { id: 'u-reseller', name: 'Tono Reseller', email: 'reseller@mitra.local', role: 'partner', status: 'active' },
  ];

  const partners: Partner[] = [
    { id: 'p-distributor', userId: 'u-distributor', tierId: 'tier-distributor', partnerCode: 'MITRA-D-001', businessName: 'Toko Frozen Makmur', contactPerson: 'Budi', phone: '0811111111', email: 'distributor@mitra.local', address: 'Jl. Raya Distributor No. 1', city: 'Jakarta', province: 'DKI Jakarta', creditLimit: 25_000_000, paymentTermDays: 14, status: 'active' },
    { id: 'p-agen', userId: 'u-agen', tierId: 'tier-agen', partnerCode: 'MITRA-A-001', businessName: 'Agen Frozen Nina', contactPerson: 'Nina', phone: '0822222222', email: 'agen@mitra.local', address: 'Jl. Agen Sejahtera No. 2', city: 'Bandung', province: 'Jawa Barat', creditLimit: 12_000_000, paymentTermDays: 7, status: 'active' },
    { id: 'p-reseller', userId: 'u-reseller', tierId: 'tier-reseller', partnerCode: 'MITRA-R-001', businessName: 'Reseller Frozen Tono', contactPerson: 'Tono', phone: '0833333333', email: 'reseller@mitra.local', address: 'Jl. Reseller Ceria No. 3', city: 'Depok', province: 'Jawa Barat', creditLimit: 3_000_000, paymentTermDays: 0, status: 'active' },
    { id: 'p2', userId: 'u-distributor', tierId: 'tier-distributor', partnerCode: 'MITRA-D-002', businessName: 'Gudang Beku Nusantara', contactPerson: 'Andi', phone: '0844444444', email: 'andi@example.com', address: 'Jl. Industri Beku 5', city: 'Bekasi', province: 'Jawa Barat', paymentTermDays: 14, status: 'active' },
    { id: 'p3', userId: 'u-agen', tierId: 'tier-agen', partnerCode: 'MITRA-A-002', businessName: 'Agen Frozen Barokah', contactPerson: 'Rini', phone: '0855555555', email: 'rini@example.com', address: 'Jl. Barokah 8', city: 'Bogor', province: 'Jawa Barat', paymentTermDays: 7, status: 'active' },
    { id: 'p4', userId: 'u-reseller', tierId: 'tier-reseller', partnerCode: 'MITRA-R-002', businessName: 'Kedai Beku Mantap', contactPerson: 'Yusuf', phone: '0866666666', email: 'yusuf@example.com', address: 'Jl. Mantap 9', city: 'Tangerang', province: 'Banten', paymentTermDays: 0, status: 'active' },
    { id: 'p5', userId: 'u-agen', tierId: 'tier-agen', partnerCode: 'MITRA-A-003', businessName: 'Frozen Kita', contactPerson: 'Lia', phone: '0877777777', email: 'lia@example.com', address: 'Jl. Kita 10', city: 'Semarang', province: 'Jawa Tengah', paymentTermDays: 7, status: 'active' },
    { id: 'p6', userId: 'u-reseller', tierId: 'tier-reseller', partnerCode: 'MITRA-R-003', businessName: 'Reseller Dapur Beku', contactPerson: 'Wawan', phone: '0888888888', email: 'wawan@example.com', address: 'Jl. Dapur 11', city: 'Surabaya', province: 'Jawa Timur', paymentTermDays: 0, status: 'active' },
    { id: 'p7', userId: 'u-distributor', tierId: 'tier-distributor', partnerCode: 'MITRA-D-003', businessName: 'Frozen Grosir Jaya', contactPerson: 'Ayu', phone: '0899999999', email: 'ayu@example.com', address: 'Jl. Grosir 12', city: 'Yogyakarta', province: 'DIY', paymentTermDays: 14, status: 'suspended' },
  ];

  const categories: ProductCategory[] = [
    { id: 'cat-nugget', name: 'Nugget', slug: 'nugget', isActive: true },
    { id: 'cat-sosis', name: 'Sosis', slug: 'sosis', isActive: true },
    { id: 'cat-seafood', name: 'Seafood', slug: 'seafood', isActive: true },
  ];

  const products: Product[] = [
    ['prd-1', 'FF-001', 'Nugget Ayam 500g', 'cat-nugget', 1, 23000],
    ['prd-2', 'FF-002', 'Nugget Keju 500g', 'cat-nugget', 1, 26000],
    ['prd-3', 'FF-003', 'Sosis Sapi 1kg', 'cat-sosis', 1, 42000],
    ['prd-4', 'FF-004', 'Sosis Ayam 1kg', 'cat-sosis', 1, 36000],
    ['prd-5', 'FF-005', 'Bakso Ikan 500g', 'cat-seafood', 1, 28000],
    ['prd-6', 'FF-006', 'Tempura 500g', 'cat-seafood', 1, 24000],
    ['prd-7', 'FF-007', 'French Fries 1kg', 'cat-nugget', 1, 31000],
    ['prd-8', 'FF-008', 'Chicken Katsu 500g', 'cat-nugget', 1, 33000],
    ['prd-9', 'FF-009', 'Dimsum Ayam 20pcs', 'cat-seafood', 1, 39000],
    ['prd-10', 'FF-010', 'Cireng Frozen 500g', 'cat-nugget', 1, 18000],
  ].map(([id, sku, name, categoryId, moq, cost]) => ({
    id: String(id), sku: String(sku), name: String(name), categoryId: String(categoryId), description: `${name} siap jual untuk mitra frozen food.`, unit: 'pack', weightGram: 500, minimumOrderQty: Number(moq), baseCost: Number(cost), isActive: true,
  }));

  const prices: ProductTierPrice[] = products.flatMap((product, idx) => {
    const base = 30000 + idx * 3500;
    return tiers.map((tier) => ({
      id: `price-${product.id}-${tier.id}`,
      productId: product.id,
      tierId: tier.id,
      price: tier.code === 'DISTRIBUTOR' ? base : tier.code === 'AGEN' ? Math.round(base * 1.12) : Math.round(base * 1.25),
      effectiveFrom: '2026-01-01',
      isActive: true,
    }));
  });

  const orders: Order[] = [
    makeOrder('ord-1', 'ORD-202605-0001', 'p-distributor', 'delivered', [{ product: products[0], qty: 80, price: 30000 }, { product: products[2], qty: 40, price: 37000 }], '2026-05-02T09:00:00.000Z'),
    makeOrder('ord-2', 'ORD-202605-0002', 'p-agen', 'shipped', [{ product: products[4], qty: 30, price: 49300 }, { product: products[5], qty: 25, price: 53200 }], '2026-05-10T10:00:00.000Z'),
    makeOrder('ord-3', 'ORD-202605-0003', 'p-reseller', 'pending', [{ product: products[9], qty: 12, price: 76875 }], '2026-05-18T12:00:00.000Z'),
    makeOrder('ord-4', 'ORD-202605-0004', 'p2', 'delivered', [{ product: products[7], qty: 60, price: 54500 }], '2026-05-12T08:00:00.000Z'),
    makeOrder('ord-5', 'ORD-202605-0005', 'p3', 'delivered', [{ product: products[8], qty: 40, price: 64960 }], '2026-05-16T08:00:00.000Z'),
  ];

  const statusHistories: OrderStatusHistory[] = orders.map((order) => ({ id: `hist-${order.id}`, orderId: order.id, toStatus: order.status, note: 'Seed status awal', changedBy: order.createdBy, changedAt: order.orderDate }));
  const deliveryNotes: DeliveryNote[] = [{ id: 'dn-1', deliveryNoteNumber: 'SJ-202605-0001', orderId: 'ord-1', deliveryDate: '2026-05-03', driverName: 'Andi', vehicleNumber: 'B 1234 XYZ', status: 'issued', issuedBy: 'u-warehouse', issuedAt: '2026-05-03T08:00:00.000Z' }];
  const invoices: Invoice[] = [{ id: 'inv-1', invoiceNumber: 'INV-202605-0001', orderId: 'ord-1', partnerId: 'p-distributor', invoiceDate: '2026-05-03', dueDate: '2026-05-17', status: 'partial', subtotal: orders[0].subtotal, discountTotal: 0, taxTotal: 0, grandTotal: orders[0].grandTotal, amountPaid: 1_500_000, amountDue: orders[0].grandTotal - 1_500_000, issuedBy: 'u-finance', issuedAt: '2026-05-03T09:00:00.000Z' }];
  const payments: Payment[] = [{ id: 'pay-1', invoiceId: 'inv-1', paymentDate: '2026-05-06', amount: 1_500_000, method: 'bank_transfer', referenceNumber: 'TRX-SEED-001', receivedBy: 'u-finance' }];
  const auditLogs: AuditLog[] = [{ id: 'audit-1', actorUserId: 'u-admin', action: 'SEED_DATA_CREATED', entityType: 'system', entityId: 'seed', newValue: { module: 'mvp' }, timestamp: new Date().toISOString() }];
  const accountingEvents: AccountingEvent[] = [
    { id: 'ae-1', eventType: 'ORDER_CREATED', referenceType: 'order', referenceId: 'ord-1', partnerId: 'p-distributor', eventDate: orders[0].orderDate, amount: orders[0].grandTotal, currency: 'IDR', status: 'pending_mapping', metadata: { revenueRecognized: false }, createdBy: 'u-distributor' },
    { id: 'ae-2', eventType: 'INVOICE_ISSUED', referenceType: 'invoice', referenceId: 'inv-1', partnerId: 'p-distributor', eventDate: '2026-05-03T09:00:00.000Z', amount: orders[0].grandTotal, currency: 'IDR', status: 'pending_mapping', metadata: { psakNote: 'Invoice issued, mapping policy by finance' }, createdBy: 'u-finance' },
    { id: 'ae-3', eventType: 'PAYMENT_RECEIVED', referenceType: 'payment', referenceId: 'pay-1', partnerId: 'p-distributor', eventDate: '2026-05-06T09:00:00.000Z', amount: 1_500_000, currency: 'IDR', status: 'pending_mapping', metadata: {}, createdBy: 'u-finance' },
  ];

  return { users, tiers, partners, categories, products, prices, orders, statusHistories, deliveryNotes, invoices, payments, auditLogs, accountingEvents };
}

function makeOrder(id: string, orderNumber: string, partnerId: string, status: Order['status'], rows: { product: Product; qty: number; price: number }[], date: string): Order {
  const items = rows.map((row, index) => ({
    id: `${id}-item-${index + 1}`,
    orderId: id,
    productId: row.product.id,
    skuSnapshot: row.product.sku,
    productNameSnapshot: row.product.name,
    unitSnapshot: row.product.unit,
    tierIdSnapshot: partnerId.includes('distributor') || partnerId === 'p2' ? 'tier-distributor' : partnerId.includes('agen') || partnerId === 'p3' ? 'tier-agen' : 'tier-reseller',
    tierNameSnapshot: partnerId.includes('distributor') || partnerId === 'p2' ? 'Distributor' : partnerId.includes('agen') || partnerId === 'p3' ? 'Agen' : 'Reseller',
    qty: row.qty,
    unitPrice: row.price,
    discountAmount: 0,
    lineTotal: row.qty * row.price,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    id,
    orderNumber,
    partnerId,
    orderDate: date,
    status,
    subtotal,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: subtotal,
    shippingAddress: 'Alamat sesuai data mitra',
    notes: 'Seed order demo',
    deliveredAt: status === 'delivered' ? date : undefined,
    createdBy: partnerId === 'p-distributor' ? 'u-distributor' : partnerId === 'p-agen' ? 'u-agen' : partnerId === 'p-reseller' ? 'u-reseller' : 'u-sales',
    items,
  };
}
