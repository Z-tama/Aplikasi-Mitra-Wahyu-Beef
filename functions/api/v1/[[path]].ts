import { createSeedState, type AppState } from '../../../src/seed';
import { createDeliveryNote, createInvoice, createOrder, findPartnerForUser, recordPayment, updateOrderStatus } from '../../../src/services';
import type { OrderStatus, Payment, Role, User } from '../../../src/domain';

interface Env {
  AUTH_SECRET?: string;
}

let state: AppState | null = null;

type PagesHandlerContext = { request: Request; env: Env };

export const onRequest = async ({ request, env }: PagesHandlerContext) => {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/v1', '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') return respond(null, 204);

    if (method === 'POST' && path === '/auth/login') {
      const body = await readJson<{ identifier: string; password: string }>(request);
      return respond(login(await loadState(), body.identifier, body.password, env.AUTH_SECRET), 200);
    }

    if (method === 'POST' && path === '/partner-registrations') {
      const body = await readJson<Record<string, string>>(request);
      const result = await mutateState((draft) => {
        const registration = buildPartnerRegistration(body);
        draft.partnerRegistrations = [registration, ...(draft.partnerRegistrations ?? [])];
        draft.auditLogs.unshift({
          id: `audit-registration-${Date.now()}`,
          actorUserId: 'public-registration',
          action: 'PARTNER_REGISTRATION_SUBMITTED',
          entityType: 'partnerRegistration',
          entityId: registration.id,
          newValue: registration,
          timestamp: registration.submittedAt,
        });
        return registration;
      });
      return respond(result, 201);
    }

    const currentState = await loadState();
    const actor = authenticate(currentState, request.headers.get('authorization') ?? undefined, env.AUTH_SECRET);

    if (method === 'GET' && path === '/auth/me') return respond({ user: actor }, 200);
    if (method === 'GET' && path === '/snapshot') return respond(filteredStateForUser(currentState, actor.id), 200);

    if (method === 'PATCH' && path === '/profile/password') {
      const body = await readJson<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>(request);
      const result = await mutateState((draft) => {
        const userRecord = draft.users.find((item) => item.id === actor.id);
        if (!userRecord) throw httpError(404, 'User tidak ditemukan');
        if (actor.role !== 'partner') throw httpError(403, 'Hanya akun mitra yang bisa mengganti password di profil');
        const currentPassword = String(body.currentPassword ?? '');
        const newPassword = String(body.newPassword ?? '');
        const confirmPassword = String(body.confirmPassword ?? '');
        if (!verifyPassword(userRecord, currentPassword)) throw httpError(400, 'Password saat ini tidak sesuai');
        if (newPassword.length < 8) throw httpError(400, 'Password baru minimal 8 karakter');
        if (newPassword !== confirmPassword) throw httpError(400, 'Konfirmasi password tidak sama');
        if (verifyPassword(userRecord, newPassword)) throw httpError(400, 'Password baru tidak boleh sama dengan password saat ini');
        userRecord.passwordHash = hashPassword(newPassword);
        draft.auditLogs.unshift({ id: `audit-password-${Date.now()}`, actorUserId: actor.id, action: 'PARTNER_PASSWORD_UPDATED', entityType: 'user', entityId: actor.id, newValue: { changedByPartner: true }, timestamp: new Date().toISOString() });
        return { user: userRecord };
      });
      return respond(result, 200);
    }

    if (method === 'PATCH' && path === '/profile') {
      const body = await readJson<{ name?: string; address?: string; phone?: string; avatarUrl?: string }>(request);
      const result = await mutateState((draft) => {
        if (actor.role !== 'partner') throw httpError(403, 'Hanya akun mitra yang bisa mengubah profil mitra');
        const userRecord = draft.users.find((item) => item.id === actor.id);
        const partnerRecord = draft.partners.find((item) => item.userId === actor.id);
        if (!userRecord || !partnerRecord) throw httpError(404, 'Profil mitra tidak ditemukan');
        const name = String(body.name ?? '').trim();
        const address = String(body.address ?? '').trim();
        const phone = String(body.phone ?? '').trim();
        const avatarUrl = String(body.avatarUrl ?? '').trim();
        if (!name) throw httpError(400, 'Nama wajib diisi');
        if (!address) throw httpError(400, 'Alamat wajib diisi');
        if (!phone) throw httpError(400, 'Nomor WA wajib diisi');
        userRecord.name = name;
        userRecord.phone = phone;
        userRecord.avatarUrl = avatarUrl || undefined;
        partnerRecord.contactPerson = name;
        partnerRecord.address = address;
        partnerRecord.phone = phone;
        draft.auditLogs.unshift({ id: `audit-profile-${Date.now()}`, actorUserId: actor.id, action: 'PARTNER_PROFILE_UPDATED', entityType: 'partner', entityId: partnerRecord.id, newValue: { name, address, phone, hasAvatar: Boolean(avatarUrl) }, timestamp: new Date().toISOString() });
        return { user: userRecord, state: filteredStateForUser(draft, actor.id) };
      });
      return respond(result, 200);
    }

    if (method === 'POST' && path === '/orders') {
      const body = await readJson<{ partnerId?: string; shippingAddress: string; notes?: string; items: { productId: string; qty: number; packageWeightGram?: 250 | 500 | 1000; packageLabel?: string; notes?: string }[] }>(request);
      const result = await mutateState((draft) => {
        const actorPartner = findPartnerForUser(draft, actor);
        const partnerId = actor.role === 'partner' ? actorPartner?.id : body.partnerId;
        if (!partnerId) throw httpError(400, 'partnerId wajib untuk admin atau user mitra harus punya partner');
        return createOrder(draft, actor, partnerId, body.items, body.shippingAddress, body.notes);
      });
      return respond(result, 201);
    }

    const statusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const body = await readJson<{ status: OrderStatus; note?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return updateOrderStatus(draft, actor, statusMatch[1], body.status, body.note);
      });
      return respond(result, 200);
    }

    const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoices$/);
    if (method === 'POST' && invoiceMatch) {
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'finance_admin', 'sales_admin']);
        return createInvoice(draft, actor, invoiceMatch[1]);
      });
      return respond(result, 201);
    }

    const deliveryMatch = path.match(/^\/orders\/([^/]+)\/delivery-notes$/);
    if (method === 'POST' && deliveryMatch) {
      const body = await readJson<{ driverName?: string; vehicleNumber?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return createDeliveryNote(draft, actor, deliveryMatch[1], body.driverName, body.vehicleNumber);
      });
      return respond(result, 201);
    }

    const paymentMatch = path.match(/^\/invoices\/([^/]+)\/payments$/);
    if (method === 'POST' && paymentMatch) {
      const body = await readJson<Pick<Payment, 'amount' | 'method' | 'referenceNumber'>>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'finance_admin']);
        return recordPayment(draft, actor, paymentMatch[1], Number(body.amount), body.method, body.referenceNumber);
      });
      return respond(result, 201);
    }

    throw httpError(404, 'Endpoint tidak ditemukan');
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return respond({ error: error instanceof Error ? error.message : 'Internal server error' }, status);
  }
};

async function loadState() {
  state ??= createSeedState();
  return state;
}

async function mutateState<T>(fn: (draft: AppState) => T | Promise<T>) {
  const current = await loadState();
  const result = await fn(current);
  state = current;
  return result;
}

async function readJson<T>(request: Request): Promise<T> {
  const raw = await request.text();
  return raw ? JSON.parse(raw) as T : {} as T;
}

function respond(data: unknown, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function login(currentState: AppState, identifier: string, password: string, secret?: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const user = currentState.users.find((item) => item.email.toLowerCase() === normalizedIdentifier || normalizePhone(item.phone) === normalizedIdentifier);
  if (!user || !verifyPassword(user, password)) throw httpError(401, 'Kredensial tidak valid');
  if (user.status !== 'active') throw httpError(403, 'User tidak aktif');
  return { token: signToken(user.id, secret), user };
}

function authenticate(currentState: AppState, authorization?: string, secret?: string): User {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const userId = token ? verifyToken(token, secret) : '';
  if (!userId) throw httpError(401, 'Token tidak valid');
  const user = currentState.users.find((item) => item.id === userId);
  if (!user || user.status !== 'active') throw httpError(401, 'Session tidak valid');
  return user;
}

function signToken(userId: string, _secret?: string) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  return `${userId}.${timestamp}.${random}`;
}

function verifyToken(token: string, _secret?: string) {
  const parts = token.split('.');
  return parts.length >= 3 ? parts[0] : '';
}

function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw httpError(403, 'Akses ditolak untuk role ini');
}

function hashPassword(password: string) {
  return `demo-hash:${password}`;
}

function verifyPassword(user: User, password: string) {
  if (user.passwordHash) return user.passwordHash === hashPassword(password);
  const fallback = defaultPasswordForUser(user);
  return Boolean(fallback) && fallback === password;
}

function defaultPasswordForUser(user: User) {
  if (user.email.endsWith('@mitra.wahyubeef.local')) return 'mitrawahyubeef';
  return demoPasswords[user.email];
}

const demoPasswords: Record<string, string> = {
  'admin@frozen.local': 'password',
  'sales@frozen.local': 'password',
  'finance@frozen.local': 'password',
  'warehouse@frozen.local': 'password',
  'distributor@mitra.local': 'password',
  'agen@mitra.local': 'password',
  'reseller@mitra.local': 'password',
};

function normalizeIdentifier(value: string) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : normalizePhone(trimmed);
}

function normalizePhone(value?: string) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  return digits;
}

function buildPartnerRegistration(body: Record<string, string>) {
  const required = ['businessName', 'ownerName', 'phone', 'province', 'city', 'address'];
  for (const field of required) {
    if (!String(body[field] ?? '').trim()) throw httpError(400, 'Data pendaftaran belum lengkap');
  }
  const submittedAt = new Date().toISOString();
  const registration = {
    id: `reg-${Date.now()}`,
    businessName: clean(body.businessName),
    ownerName: clean(body.ownerName),
    phone: clean(body.phone),
    email: clean(body.email),
    province: clean(body.province),
    city: clean(body.city),
    address: clean(body.address),
    businessType: clean(body.businessType),
    salesChannel: clean(body.salesChannel),
    currentSales: clean(body.currentSales),
    interestedTier: clean(body.interestedTier),
    notes: clean(body.notes),
    status: 'new' as const,
    submittedAt,
    adminWhatsapp: '6282119000195',
    whatsappMessage: '',
  };
  registration.whatsappMessage = [
    'Pendaftaran Mitra Baru Wahyu Beef',
    `Nama Usaha: ${registration.businessName}`,
    `PIC: ${registration.ownerName}`,
    `WA: ${registration.phone}`,
    registration.email ? `Email: ${registration.email}` : '',
    `Lokasi: ${registration.city}, ${registration.province}`,
    `Alamat: ${registration.address}`,
    `Jenis Usaha: ${registration.businessType}`,
    registration.salesChannel ? `Channel: ${registration.salesChannel}` : '',
    registration.currentSales ? `Estimasi: ${registration.currentSales}` : '',
    `Minat Tier: ${registration.interestedTier}`,
    registration.notes ? `Catatan: ${registration.notes}` : '',
    `Waktu Submit: ${new Date(submittedAt).toLocaleString('id-ID')}`,
  ].filter(Boolean).join('\n');
  return registration;
}

function clean(value?: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function filteredStateForUser(currentState: AppState, userId: string) {
  const user = currentState.users.find((item) => item.id === userId)!;
  if (user.role !== 'partner') return currentState;
  const partner = currentState.partners.find((item) => item.userId === user.id);
  if (!partner) return { ...currentState, partners: [], orders: [], invoices: [], deliveryNotes: [], payments: [], auditLogs: [], accountingEvents: [] };
  const orderIds = new Set(currentState.orders.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  const invoiceIds = new Set(currentState.invoices.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  return {
    ...currentState,
    users: [user],
    partners: [partner],
    orders: currentState.orders.filter((item) => item.partnerId === partner.id),
    statusHistories: currentState.statusHistories.filter((item) => orderIds.has(item.orderId)),
    invoices: currentState.invoices.filter((item) => item.partnerId === partner.id),
    deliveryNotes: currentState.deliveryNotes.filter((item) => orderIds.has(item.orderId)),
    payments: currentState.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    auditLogs: [],
    accountingEvents: [],
  };
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
