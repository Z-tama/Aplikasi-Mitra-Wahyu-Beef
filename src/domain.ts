export type Role = 'super_admin' | 'sales_admin' | 'finance_admin' | 'warehouse' | 'partner';
export type UserStatus = 'active' | 'suspended' | 'inactive';
export type PartnerStatus = 'active' | 'suspended' | 'inactive';
export type OrderStatus = 'pending' | 'confirmed' | 'in_production' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'void';
export type DeliveryNoteStatus = 'draft' | 'issued' | 'received' | 'void';
export type AccountingEventType =
  | 'ORDER_CREATED'
  | 'INVOICE_ISSUED'
  | 'DELIVERY_NOTE_CREATED'
  | 'GOODS_SHIPPED'
  | 'GOODS_DELIVERED'
  | 'PAYMENT_RECEIVED'
  | 'ORDER_CANCELLED'
  | 'INVOICE_VOIDED'
  | 'INVENTORY_OUT'
  | 'REVERSAL';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  passwordHash?: string;
  role: Role;
  status: UserStatus;
}

export interface PartnerTier {
  id: string;
  code: 'DISTRIBUTOR' | 'AGEN' | 'RESELLER';
  name: string;
  rankOrder: number;
  description: string;
  isActive: boolean;
}

export interface Partner {
  id: string;
  userId: string;
  tierId: string;
  partnerCode: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  creditLimit?: number;
  paymentTermDays: number;
  status: PartnerStatus;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  weightGram?: number;
  imageUrl?: string;
  minimumOrderQty: number;
  baseCost?: number;
  isActive: boolean;
}

export interface ProductTierPrice {
  id: string;
  productId: string;
  tierId: string;
  price: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  unitSnapshot: string;
  tierIdSnapshot: string;
  tierNameSnapshot: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  partnerId: string;
  orderDate: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  shippingAddress: string;
  shippingCost?: number;
  packingFee?: number;
  packingType?: 'none' | 'small_styrofoam' | 'medium_styrofoam' | 'large_styrofoam';
  trackingNumber?: string;
  trackingReceiptUrl?: string;
  notes?: string;
  cancelledReason?: string;
  deliveredAt?: string;
  createdBy: string;
  items: OrderItem[];
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  note?: string;
  changedBy: string;
  changedAt: string;
}

export interface DeliveryNote {
  id: string;
  deliveryNoteNumber: string;
  orderId: string;
  deliveryDate: string;
  driverName?: string;
  vehicleNumber?: string;
  recipientName?: string;
  status: DeliveryNoteStatus;
  notes?: string;
  issuedBy: string;
  issuedAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  partnerId: string;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  voidReason?: string;
  issuedBy?: string;
  issuedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'other';
  referenceNumber?: string;
  notes?: string;
  receivedBy: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
}

export interface AccountingEvent {
  id: string;
  eventType: AccountingEventType;
  referenceType: string;
  referenceId: string;
  partnerId?: string;
  eventDate: string;
  amount?: number;
  currency: 'IDR';
  status: 'pending_mapping' | 'mapped' | 'exported' | 'reversed';
  metadata: Record<string, unknown>;
  createdBy?: string;
}

export interface CartItem {
  productId: string;
  qty: number;
  packageWeightGram?: 250 | 500 | 1000;
  packageLabel?: string;
  notes?: string;
}

export const statusLabels: Record<OrderStatus, string> = {
  pending: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  in_production: 'Diproduksi / dipacking',
  ready_to_ship: 'Siap kirim',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
};

export const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return validTransitions[from].includes(to);
}

export function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
