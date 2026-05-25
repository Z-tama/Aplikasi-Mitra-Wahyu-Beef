import type { AccountingEvent, AuditLog, DeliveryNote, Invoice, Order, OrderStatusHistory, Partner, PartnerTier, Payment, Product, ProductCategory, ProductTierPrice, User } from './domain';

export interface PartnerRegistrationSubmission {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  province: string;
  city: string;
  address: string;
  businessType: string;
  salesChannel?: string;
  currentSales?: string;
  interestedTier: string;
  notes?: string;
  status: 'new' | 'contacted' | 'approved' | 'rejected';
  submittedAt: string;
  adminWhatsapp: string;
  whatsappMessage: string;
}

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
  partnerRegistrations?: PartnerRegistrationSubmission[];
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
    { id: 'u-admin', name: 'Sari Owner', email: 'admin@frozen.local', phone: '0800000001', role: 'super_admin', status: 'active' },
    { id: 'u-sales', name: 'Raka Sales', email: 'sales@frozen.local', phone: '0800000002', role: 'sales_admin', status: 'active' },
    { id: 'u-finance', name: 'Maya Finance', email: 'finance@frozen.local', phone: '0800000003', role: 'finance_admin', status: 'active' },
    { id: 'u-warehouse', name: 'Dimas Warehouse', email: 'warehouse@frozen.local', phone: '0800000004', role: 'warehouse', status: 'active' },
    { id: 'u-distributor', name: 'Budi Distributor', email: 'distributor@mitra.local', phone: '0811111111', role: 'partner', status: 'active' },
    { id: 'u-agen', name: 'Nina Agen', email: 'agen@mitra.local', phone: '0822222222', role: 'partner', status: 'active' },
    { id: 'u-reseller', name: 'Tono Reseller', email: 'reseller@mitra.local', phone: '0833333333', role: 'partner', status: 'active' },
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
    { id: 'cat-daging-sapi', name: 'Daging Sapi', slug: 'daging-sapi', isActive: true },
    { id: 'cat-tulang-sapi', name: 'Tulang Sapi', slug: 'tulang-sapi', isActive: true },
    { id: 'cat-jerohan-sapi', name: 'Jerohan Sapi', slug: 'jerohan-sapi', isActive: true },
    { id: 'cat-processed-meat', name: 'Processed Meat', slug: 'processed-meat', isActive: true },
    { id: 'cat-seafood-series', name: 'Seafood Series', slug: 'seafood-series', isActive: true },
  ];

  const wahyuProducts = [
    { id: 'prd-dgs-001', sku: 'WB-DGS-001', name: 'Saikoro', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 155000, agen: 175000, reseller: 192000 },
    { id: 'prd-dgs-002', sku: 'WB-DGS-002', name: 'Tenderloin / Has Dalam', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 150000, agen: 170000, reseller: 186000 },
    { id: 'prd-dgs-003', sku: 'WB-DGS-003', name: 'Sirloin / Has Luar', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 140000, agen: 158000, reseller: 174000 },
    { id: 'prd-dgs-004', sku: 'WB-DGS-004', name: 'Rib Eye / Cube Roll', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 140000, agen: 158000, reseller: 174000 },
    { id: 'prd-dgs-005', sku: 'WB-DGS-005', name: 'Rendang Cut', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 135000, agen: 152500, reseller: 167500 },
    { id: 'prd-dgs-006', sku: 'WB-DGS-006', name: 'Dice Cut / Potong Dadu', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-007', sku: 'WB-DGS-007', name: 'Beef Slice (Non Fat)', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 135000, agen: 152500, reseller: 167500 },
    { id: 'prd-dgs-008', sku: 'WB-DGS-008', name: 'Beef Slice (Fat)', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-009', sku: 'WB-DGS-009', name: 'Eye Round / Gandik', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-010', sku: 'WB-DGS-010', name: 'Knuckle / Kelapa', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-011', sku: 'WB-DGS-011', name: 'Blade / Punuk', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-012', sku: 'WB-DGS-012', name: 'Topside / Paha', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-013', sku: 'WB-DGS-013', name: 'Chuck / Daging Leher', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-014', sku: 'WB-DGS-014', name: 'Sengkel / Kisi', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-015', sku: 'WB-DGS-015', name: 'Sandung Lamur', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 125000, agen: 141000, reseller: 155000 },
    { id: 'prd-dgs-016', sku: 'WB-DGS-016', name: 'Daging Giling (Non Fat)', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 130000, agen: 147000, reseller: 161000 },
    { id: 'prd-dgs-017', sku: 'WB-DGS-017', name: 'Daging Giling (Fat 15%)', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 115000, agen: 130000, reseller: 142500 },
    { id: 'prd-dgs-018', sku: 'WB-DGS-018', name: 'Tetelan FQ 45', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 70000, agen: 86000, reseller: 101500 },
    { id: 'prd-dgs-019', sku: 'WB-DGS-019', name: 'Tetelan FQ 65', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 85000, agen: 104500, reseller: 119000 },
    { id: 'prd-dgs-020', sku: 'WB-DGS-020', name: 'Tetelan FQ 85', categoryId: 'cat-daging-sapi', size: '1 KG', distributor: 110000, agen: 126500, reseller: 140000 },
    { id: 'prd-tls-001', sku: 'WB-TLS-001', name: 'Buntut Super / Center Cut', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 120000, agen: 135500, reseller: 150000 },
    { id: 'prd-tls-002', sku: 'WB-TLS-002', name: 'Buntut Reg. / Oxtail', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 90000, agen: 108000, reseller: 121500 },
    { id: 'prd-tls-003', sku: 'WB-TLS-003', name: 'Iga Super / Short Ribs', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 100000, agen: 120000, reseller: 135000 },
    { id: 'prd-tls-004', sku: 'WB-TLS-004', name: 'Iga Reguler / Spare Ribs', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 90000, agen: 108000, reseller: 121500 },
    { id: 'prd-tls-005', sku: 'WB-TLS-005', name: 'Tulang Muda / Cartilage', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 90000, agen: 108000, reseller: 121500 },
    { id: 'prd-tls-006', sku: 'WB-TLS-006', name: 'Tulang Sapi / Beef Bone', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 60000, agen: 75000, reseller: 88000 },
    { id: 'prd-tls-007', sku: 'WB-TLS-007', name: 'Tulang Leher / Neck Bone', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 60000, agen: 75000, reseller: 88000 },
    { id: 'prd-tls-008', sku: 'WB-TLS-008', name: 'Punggung / Back Bone', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 60000, agen: 75000, reseller: 88000 },
    { id: 'prd-tls-009', sku: 'WB-TLS-009', name: 'Rusuk / Back Ribs', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 60000, agen: 75000, reseller: 88000 },
    { id: 'prd-tls-010', sku: 'WB-TLS-010', name: 'Sum-sum / Bone Marrow', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 40000, agen: 54500, reseller: 67500 },
    { id: 'prd-tls-011', sku: 'WB-TLS-011', name: 'Serbuk Daging & Tulang', categoryId: 'cat-tulang-sapi', size: '1 KG', distributor: 35000, agen: 48000, reseller: 60000 },
    { id: 'prd-jrh-001', sku: 'WB-JRH-001', name: 'Hati Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 70000, agen: 86000, reseller: 101500 },
    { id: 'prd-jrh-002', sku: 'WB-JRH-002', name: 'Lidah Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 115000, agen: 130000, reseller: 142500 },
    { id: 'prd-jrh-003', sku: 'WB-JRH-003', name: 'Lidah Slice', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 120000, agen: 135500, reseller: 149000 },
    { id: 'prd-jrh-004', sku: 'WB-JRH-004', name: 'Ginjal Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 60000, agen: 75000, reseller: 88000 },
    { id: 'prd-jrh-005', sku: 'WB-JRH-005', name: 'Jantung Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 65000, agen: 81000, reseller: 95500 },
    { id: 'prd-jrh-006', sku: 'WB-JRH-006', name: 'Babat Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 65000, agen: 81000, reseller: 95500 },
    { id: 'prd-jrh-007', sku: 'WB-JRH-007', name: 'Kikil Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 65000, agen: 81000, reseller: 95500 },
    { id: 'prd-jrh-008', sku: 'WB-JRH-008', name: 'Paru Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 90000, agen: 108000, reseller: 121500 },
    { id: 'prd-jrh-009', sku: 'WB-JRH-009', name: 'Paru Slice', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 95000, agen: 114000, reseller: 128000 },
    { id: 'prd-jrh-010', sku: 'WB-JRH-010', name: 'Kulit Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 55000, agen: 68500, reseller: 80500 },
    { id: 'prd-jrh-011', sku: 'WB-JRH-011', name: 'Usus Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 50000, agen: 62500, reseller: 73500 },
    { id: 'prd-jrh-012', sku: 'WB-JRH-012', name: 'Torpedo Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 65000, agen: 81000, reseller: 95500 },
    { id: 'prd-jrh-013', sku: 'WB-JRH-013', name: 'Cingur Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 75000, agen: 94000, reseller: 110000 },
    { id: 'prd-jrh-014', sku: 'WB-JRH-014', name: 'Otot / Urat', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 75000, agen: 94000, reseller: 110000 },
    { id: 'prd-jrh-015', sku: 'WB-JRH-015', name: 'Limpa Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 65000, agen: 81000, reseller: 95500 },
    { id: 'prd-jrh-016', sku: 'WB-JRH-016', name: 'Otak Sapi', categoryId: 'cat-jerohan-sapi', size: 'PCS', distributor: 65000, agen: 73000, reseller: 80500 },
    { id: 'prd-jrh-017', sku: 'WB-JRH-017', name: 'Lemak Sapi', categoryId: 'cat-jerohan-sapi', size: '1 KG', distributor: 50000, agen: 62500, reseller: 73500 },
    { id: 'prd-prs-001', sku: 'WB-PRS-001', name: 'Ayam Kampung Bakar', categoryId: 'cat-processed-meat', size: '1/2 EKOR', distributor: 45000, agen: 52500, reseller: 57500 },
    { id: 'prd-prs-002', sku: 'WB-PRS-002', name: 'Ayam Kampung Ungkep', categoryId: 'cat-processed-meat', size: '1/2 EKOR', distributor: 45000, agen: 52500, reseller: 57500 },
    { id: 'prd-prs-003', sku: 'WB-PRS-003', name: 'Babat Sapi Ungkep', categoryId: 'cat-processed-meat', size: '200 GR', distributor: 30000, agen: 37500, reseller: 42500 },
    { id: 'prd-prs-004', sku: 'WB-PRS-004', name: 'Bakso Sapi', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-005', sku: 'WB-PRS-005', name: 'Empal Ungkep', categoryId: 'cat-processed-meat', size: '5 POTONG', distributor: 65000, agen: 72500, reseller: 77500 },
    { id: 'prd-prs-006', sku: 'WB-PRS-006', name: 'Galantine Ayam', categoryId: 'cat-processed-meat', size: '10 POTONG', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-007', sku: 'WB-PRS-007', name: 'Galantine Sapi', categoryId: 'cat-processed-meat', size: '10 POTONG', distributor: 45000, agen: 52500, reseller: 57500 },
    { id: 'prd-prs-008', sku: 'WB-PRS-008', name: 'Hati Ampela Ungkep', categoryId: 'cat-processed-meat', size: '10 POTONG', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-009', sku: 'WB-PRS-009', name: 'Hati Sapi Ungkep', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-010', sku: 'WB-PRS-010', name: 'Krengsengan Iga', categoryId: 'cat-processed-meat', size: '400 GR', distributor: 75000, agen: 82500, reseller: 87500 },
    { id: 'prd-prs-011', sku: 'WB-PRS-011', name: 'Lidah Sapi Ungkep', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 55000, agen: 62500, reseller: 67500 },
    { id: 'prd-prs-012', sku: 'WB-PRS-012', name: 'Paru Sapi Ungkep', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 40000, agen: 47500, reseller: 52500 },
    { id: 'prd-prs-013', sku: 'WB-PRS-013', name: 'Sate Ayam', categoryId: 'cat-processed-meat', size: '10 TUSUK', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-014', sku: 'WB-PRS-014', name: 'Sate Sapi', categoryId: 'cat-processed-meat', size: '10 TUSUK', distributor: 45000, agen: 52500, reseller: 57500 },
    { id: 'prd-prs-015', sku: 'WB-PRS-015', name: 'Usus Sapi Ungkep', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 25000, agen: 32500, reseller: 37500 },
    { id: 'prd-prs-016', sku: 'WB-PRS-016', name: 'Rolade Daging', categoryId: 'cat-processed-meat', size: '12 POTONG', distributor: 50000, agen: 57500, reseller: 62500 },
    { id: 'prd-prs-017', sku: 'WB-PRS-017', name: 'Bakso Roemahan', categoryId: 'cat-processed-meat', size: '1 PACK', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-018', sku: 'WB-PRS-018', name: 'Marinated Beef Slice', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 40000, agen: 47500, reseller: 52500 },
    { id: 'prd-prs-019', sku: 'WB-PRS-019', name: 'Marinated Tenderloin', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 45000, agen: 52500, reseller: 57500 },
    { id: 'prd-prs-020', sku: 'WB-PRS-020', name: 'Abon Sapi Premium', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 40000, agen: 47500, reseller: 52500 },
    { id: 'prd-prs-021', sku: 'WB-PRS-021', name: 'Abon Ayam Organik', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 38000, agen: 45500, reseller: 53000 },
    { id: 'prd-prs-022', sku: 'WB-PRS-022', name: 'Wahyu Beef Tallow', categoryId: 'cat-processed-meat', size: '1 JAR', distributor: 45000, agen: 52500, reseller: 60000 },
    { id: 'prd-prs-023', sku: 'WB-PRS-023', name: 'Bola Rendang', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 50000, agen: 57500, reseller: 62500 },
    { id: 'prd-prs-024', sku: 'WB-PRS-024', name: 'Dendeng Balado', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 40000, agen: 47500, reseller: 52500 },
    { id: 'prd-prs-025', sku: 'WB-PRS-025', name: 'Bakso Veggies', categoryId: 'cat-processed-meat', size: '250 GR', distributor: 45000, agen: 52500, reseller: 60000 },
    { id: 'prd-prs-026', sku: 'WB-PRS-026', name: 'Paket Krawu', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-027', sku: 'WB-PRS-027', name: 'Sego Sambel Otot Ungkep', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 30000, agen: 37500, reseller: 42500 },
    { id: 'prd-prs-028', sku: 'WB-PRS-028', name: 'Sego Sambel Babat Ungkep', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 25000, agen: 32500, reseller: 37500 },
    { id: 'prd-prs-029', sku: 'WB-PRS-029', name: 'Sego Sambel Paru Ungkep', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 25000, agen: 32500, reseller: 37500 },
    { id: 'prd-prs-030', sku: 'WB-PRS-030', name: 'Sego Sambel Usus Ungkep', categoryId: 'cat-processed-meat', size: '100 GR', distributor: 20000, agen: 27500, reseller: 32500 },
    { id: 'prd-prs-031', sku: 'WB-PRS-031', name: 'Paket Rolade Sapi', categoryId: 'cat-processed-meat', size: '6 POTONG', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-prs-032', sku: 'WB-PRS-032', name: 'Paket Galantine Sapi', categoryId: 'cat-processed-meat', size: '5 POTONG', distributor: 30000, agen: 37500, reseller: 42500 },
    { id: 'prd-prs-033', sku: 'WB-PRS-033', name: 'Paket Tenderloin Steak', categoryId: 'cat-processed-meat', size: '200 GR', distributor: 50000, agen: 57500, reseller: 62500 },
    { id: 'prd-prs-034', sku: 'WB-PRS-034', name: 'Marinated Beef Slice Series', categoryId: 'cat-processed-meat', size: '500 GR', distributor: 80000, agen: 95000, reseller: 105000 },
    { id: 'prd-prs-035', sku: 'WB-PRS-035', name: 'Beef Patty', categoryId: 'cat-processed-meat', size: '200 GR', distributor: 27500, agen: 35000, reseller: 40000 },
    { id: 'prd-prs-036', sku: 'WB-PRS-036', name: 'Sosis Sapi', categoryId: 'cat-processed-meat', size: '5 POTONG', distributor: 37500, agen: 45000, reseller: 50000 },
    { id: 'prd-sfd-001', sku: 'WB-SFD-001', name: 'Dori Fillet', categoryId: 'cat-seafood-series', size: '500 GR', distributor: 25000, agen: 32500, reseller: 37500 },
    { id: 'prd-sfd-002', sku: 'WB-SFD-002', name: 'Salmon Fillet', categoryId: 'cat-seafood-series', size: '200 GR', distributor: 60000, agen: 62500, reseller: 67500 },
    { id: 'prd-sfd-003', sku: 'WB-SFD-003', name: 'Tengiri Fillet', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 40000, agen: 42500, reseller: 52500 },
    { id: 'prd-sfd-004', sku: 'WB-SFD-004', name: 'Tengiri Cut Steak', categoryId: 'cat-seafood-series', size: '500 GR', distributor: 75000, agen: 82500, reseller: 87500 },
    { id: 'prd-sfd-005', sku: 'WB-SFD-005', name: 'Tongkol Fillet', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 20000, agen: 27500, reseller: 32500 },
    { id: 'prd-sfd-006', sku: 'WB-SFD-006', name: 'Kakap Merah Fillet', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 50000, agen: 57500, reseller: 62500 },
    { id: 'prd-sfd-007', sku: 'WB-SFD-007', name: 'Ikan Kembung', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 20000, agen: 27500, reseller: 32500 },
    { id: 'prd-sfd-008', sku: 'WB-SFD-008', name: 'Udang Vaname', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 30000, agen: 37500, reseller: 42500 },
    { id: 'prd-sfd-009', sku: 'WB-SFD-009', name: 'Udang Kupas', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 50000, agen: 57500, reseller: 62500 },
    { id: 'prd-sfd-010', sku: 'WB-SFD-010', name: 'Cumi Hitam', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 20000, agen: 27500, reseller: 32500 },
    { id: 'prd-sfd-011', sku: 'WB-SFD-011', name: 'Cumi Tube Calamary', categoryId: 'cat-seafood-series', size: '500 GR', distributor: 35000, agen: 42500, reseller: 47500 },
    { id: 'prd-sfd-012', sku: 'WB-SFD-012', name: 'Baby Gurita', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 25000, agen: 32500, reseller: 37500 },
    { id: 'prd-sfd-013', sku: 'WB-SFD-013', name: 'Tuna Fillet', categoryId: 'cat-seafood-series', size: '250 GR', distributor: 35000, agen: 42500, reseller: 47500 },
  ];


  const productImageByName: Record<string, string> = {
    'Saikoro': '/assets/products/foto-daging-sapi-1-saikoro-tenderloin-saikoro-2.webp',
    'Tenderloin / Has Dalam': '/assets/products/foto-daging-sapi-1-saikoro-tenderloin-saikoro-1.webp',
    'Sirloin / Has Luar': '/assets/products/foto-daging-sapi-1-saikoro-dsc07724.webp',
    'Rib Eye / Cube Roll': '/assets/products/foto-daging-sapi-1-saikoro-dsc07786.webp',
    'Rendang Cut': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07884.webp',
    'Dice Cut / Potong Dadu': '/assets/products/foto-daging-sapi-1-saikoro-dsc07702.webp',
    'Beef Slice (Non Fat)': '/assets/products/foto-daging-sapi-16-daging-giling-non-fat-dscf8091.webp',
    'Beef Slice (Fat)': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dscf2998.webp',
    'Eye Round / Gandik': '/assets/products/foto-daging-sapi-1-saikoro-dsc07664.webp',
    'Knuckle / Kelapa': '/assets/products/foto-daging-sapi-1-saikoro-dsc07666.webp',
    'Blade / Punuk': '/assets/products/foto-daging-sapi-1-saikoro-dsc07672.webp',
    'Topside / Paha': '/assets/products/foto-daging-sapi-1-saikoro-dsc07701.webp',
    'Chuck / Daging Leher': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-2.webp',
    'Sengkel / Kisi': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-1.webp',
    'Sandung Lamur': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07883.webp',
    'Daging Giling (Non Fat)': '/assets/products/foto-daging-sapi-16-daging-giling-non-fat-dsc06233.webp',
    'Daging Giling (Fat 15%)': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-minced-beef-1.webp',
    'Tetelan FQ 45': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Tetelan FQ 65': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07911.webp',
    'Tetelan FQ 85': '/assets/products/foto-daging-sapi-15-sandung-lamur-sandung-lamur.webp',
    'Buntut Super / Center Cut': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-story-1.webp',
    'Buntut Reg. / Oxtail': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-3.webp',
    'Iga Super / Short Ribs': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07884.webp',
    'Iga Reguler / Spare Ribs': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Tulang Muda / Cartilage': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-2.webp',
    'Tulang Sapi / Beef Bone': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-1.webp',
    'Tulang Leher / Neck Bone': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-2.webp',
    'Punggung / Back Bone': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-3.webp',
    'Rusuk / Back Ribs': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07883.webp',
    'Sum-sum / Bone Marrow': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-story-1.webp',
    'Serbuk Daging & Tulang': '/assets/products/foto-daging-sapi-16-daging-giling-non-fat-dsc06245.webp',
    'Hati Sapi': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dsc06718.webp',
    'Lidah Sapi': '/assets/products/foto-daging-sapi-1-saikoro-dsc07664.webp',
    'Lidah Slice': '/assets/products/foto-daging-sapi-1-saikoro-dsc07666.webp',
    'Ginjal Sapi': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dsc06735.webp',
    'Jantung Sapi': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dsc06749.webp',
    'Babat Sapi': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07884.webp',
    'Kikil Sapi': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-3.webp',
    'Paru Sapi': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Paru Slice': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07883.webp',
    'Kulit Sapi': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-story-1.webp',
    'Usus Sapi': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-2.webp',
    'Torpedo Sapi': '/assets/products/foto-daging-sapi-1-saikoro-dsc07701.webp',
    'Cingur Sapi': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-1.webp',
    'Otot / Urat': '/assets/products/foto-daging-sapi-14-sengkel-sengkel-feed-3.webp',
    'Limpa Sapi': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dsc06699.webp',
    'Otak Sapi': '/assets/products/foto-daging-sapi-17-daging-giling-fat-15-dsc06706.webp',
    'Lemak Sapi': '/assets/products/beef-tallow-dscf2192.webp',
    'Ayam Kampung Bakar': '/assets/products/abon-bon-beef-bon-beef-abon-ayam.webp',
    'Ayam Kampung Ungkep': '/assets/products/abon-bon-beef-bon-beef-abon-ayam.webp',
    'Babat Sapi Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Bakso Sapi': '/assets/products/bakso-veggies-feed-1.webp',
    'Empal Ungkep': '/assets/products/beef-patty-dsc02137.webp',
    'Galantine Ayam': '/assets/products/abon-bon-beef-bon-beef-abon-ayam.webp',
    'Galantine Sapi': '/assets/products/beef-patty-dsc02128.webp',
    'Hati Ampela Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Hati Sapi Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Krengsengan Iga': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07884.webp',
    'Lidah Sapi Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Paru Sapi Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Sate Ayam': '/assets/products/abon-bon-beef-bon-beef-abon-ayam.webp',
    'Sate Sapi': '/assets/products/beef-patty-dsc02137.webp',
    'Usus Sapi Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Rolade Daging': '/assets/products/beef-patty-dsc02128.webp',
    'Bakso Roemahan': '/assets/products/bakso-roemahan-mockup-bakso-roemahan-v2.webp',
    'Marinated Beef Slice': '/assets/products/foto-daging-sapi-16-daging-giling-non-fat-dscf8086.webp',
    'Marinated Tenderloin': '/assets/products/foto-daging-sapi-1-saikoro-tenderloin-saikoro-1.webp',
    'Abon Sapi Premium': '/assets/products/abon-bon-beef-bon-beef-abon-sapi.webp',
    'Abon Ayam Organik': '/assets/products/abon-bon-beef-bon-beef-abon-ayam.webp',
    'Wahyu Beef Tallow': '/assets/products/beef-tallow-beef-tallow.webp',
    'Bola Rendang': '/assets/products/beef-patty-dsc02137.webp',
    'Dendeng Balado': '/assets/products/dendeng-balado-poster-wahyu-beef-dendeng-balado.webp',
    'Bakso Veggies': '/assets/products/bakso-veggies-feed-bakso-veggies-2.webp',
    'Paket Krawu': '/assets/products/beef-patty-dsc02137.webp',
    'Sego Sambel Otot Ungkep': '/assets/products/beef-patty-dsc02137.webp',
    'Sego Sambel Babat Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Sego Sambel Paru Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Sego Sambel Usus Ungkep': '/assets/products/foto-daging-sapi-15-sandung-lamur-dsc07841.webp',
    'Paket Rolade Sapi': '/assets/products/beef-patty-dsc02128.webp',
    'Paket Galantine Sapi': '/assets/products/beef-patty-dsc02128.webp',
    'Paket Tenderloin Steak': '/assets/products/foto-daging-sapi-1-saikoro-tenderloin-saikoro-2.webp',
    'Marinated Beef Slice Series': '/assets/products/foto-daging-sapi-16-daging-giling-non-fat-dscf8076.webp',
    'Beef Patty': '/assets/products/beef-patty-dsc02131.webp',
    'Sosis Sapi': '/assets/products/beef-patty-dsc02128.webp',
    'Dori Fillet': '/assets/products/bakso-veggies-story-1.webp',
    'Salmon Fillet': '/assets/products/bakso-veggies-story-1.webp',
    'Tengiri Fillet': '/assets/products/bakso-veggies-story-1.webp',
    'Tengiri Cut Steak': '/assets/products/bakso-veggies-story-1.webp',
    'Tongkol Fillet': '/assets/products/bakso-veggies-story-1.webp',
    'Kakap Merah Fillet': '/assets/products/bakso-veggies-story-1.webp',
    'Ikan Kembung': '/assets/products/bakso-veggies-story-1.webp',
    'Udang Vaname': '/assets/products/bakso-veggies-story-1.webp',
    'Udang Kupas': '/assets/products/bakso-veggies-story-1.webp',
    'Cumi Hitam': '/assets/products/bakso-veggies-story-1.webp',
    'Cumi Tube Calamary': '/assets/products/bakso-veggies-story-1.webp',
    'Baby Gurita': '/assets/products/bakso-veggies-story-1.webp',
    'Tuna Fillet': '/assets/products/bakso-veggies-story-1.webp',
  };

  const products: Product[] = wahyuProducts.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    categoryId: item.categoryId,
    description: `Wahyu Beef ${item.name} kemasan ${item.size}.`,
    unit: item.size,
    imageUrl: productImageByName[item.name],
    minimumOrderQty: 1,
    baseCost: item.distributor,
    isActive: true,
  }));

  const prices: ProductTierPrice[] = wahyuProducts.flatMap((item) => [
    { id: `price-${item.id}-tier-distributor`, productId: item.id, tierId: 'tier-distributor', price: item.distributor, effectiveFrom: '2026-01-01', isActive: true },
    { id: `price-${item.id}-tier-agen`, productId: item.id, tierId: 'tier-agen', price: item.agen, effectiveFrom: '2026-01-01', isActive: true },
    { id: `price-${item.id}-tier-reseller`, productId: item.id, tierId: 'tier-reseller', price: item.reseller, effectiveFrom: '2026-01-01', isActive: true },
  ]);

  const priceFor = (product: Product, tierId: string) => prices.find((price) => price.productId === product.id && price.tierId === tierId)?.price ?? product.baseCost ?? 0;
  const orders: Order[] = [
    makeOrder('ord-1', 'ORD-202605-0001', 'p-distributor', 'delivered', [{ product: products[0], qty: 20, price: priceFor(products[0], 'tier-distributor') }, { product: products[20], qty: 12, price: priceFor(products[20], 'tier-distributor') }], '2026-05-02T09:00:00.000Z'),
    makeOrder('ord-2', 'ORD-202605-0002', 'p-agen', 'shipped', [{ product: products[48], qty: 15, price: priceFor(products[48], 'tier-agen') }, { product: products[55], qty: 10, price: priceFor(products[55], 'tier-agen') }], '2026-05-10T10:00:00.000Z'),
    makeOrder('ord-3', 'ORD-202605-0003', 'p-reseller', 'pending', [{ product: products[90], qty: 8, price: priceFor(products[90], 'tier-reseller') }], '2026-05-18T12:00:00.000Z'),
    makeOrder('ord-4', 'ORD-202605-0004', 'p2', 'delivered', [{ product: products[4], qty: 18, price: priceFor(products[4], 'tier-distributor') }], '2026-05-12T08:00:00.000Z'),
    makeOrder('ord-5', 'ORD-202605-0005', 'p3', 'delivered', [{ product: products[83], qty: 16, price: priceFor(products[83], 'tier-agen') }], '2026-05-16T08:00:00.000Z'),
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
