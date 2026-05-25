import type { AppState } from './seed';
import type { CartItem, OrderStatus, Payment, User } from './domain';

export interface Session {
  token: string;
  user: User;
}

const API_BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `API error ${response.status}`);
  return payload as T;
}

export const api = {
  login(identifier: string, password: string) {
    return request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  },
  me(token: string) {
    return request<{ user: User }>('/auth/me', {}, token);
  },
  snapshot(token: string) {
    return request<AppState>('/snapshot', {}, token);
  },
  submitPartnerRegistration(input: Record<string, string>) {
    return request<{ whatsappMessage: string; adminWhatsapp: string }>('/partner-registrations', { method: 'POST', body: JSON.stringify(input) });
  },
  updateProfile(token: string, input: { name: string; address: string; phone: string; avatarUrl?: string }) {
    return request<{ user: User; state: AppState }>('/profile', { method: 'PATCH', body: JSON.stringify(input) }, token);
  },
  async uploadProfilePhoto(token: string, file: File) {
    const response = await fetch(`${API_BASE}/profile/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `API error ${response.status}`);
    return payload as { avatarUrl: string; user: User; state: AppState };
  },
  updatePassword(token: string, input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    return request<{ user: User }>('/profile/password', { method: 'PATCH', body: JSON.stringify(input) }, token);
  },
  createOrder(token: string, input: { partnerId?: string; shippingAddress: string; notes?: string; items: CartItem[] }) {
    return request('/orders', { method: 'POST', body: JSON.stringify(input) }, token);
  },
  updateOrderStatus(token: string, orderId: string, status: OrderStatus, note?: string) {
    return request(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }, token);
  },
  createInvoice(token: string, orderId: string) {
    return request(`/orders/${orderId}/invoices`, { method: 'POST', body: JSON.stringify({}) }, token);
  },
  createDeliveryNote(token: string, orderId: string, input: { driverName?: string; vehicleNumber?: string }) {
    return request(`/orders/${orderId}/delivery-notes`, { method: 'POST', body: JSON.stringify(input) }, token);
  },
  recordPayment(token: string, invoiceId: string, input: Pick<Payment, 'amount' | 'method' | 'referenceNumber'>) {
    return request(`/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(input) }, token);
  },
};
