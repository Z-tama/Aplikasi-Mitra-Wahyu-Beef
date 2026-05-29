import { createSeedState, type AppState } from '../../../src/seed';
import { createDeliveryNote, createInvoice, createOrder, findPartnerForUser, recordPayment, updateOrderShipping, updateOrderStatus } from '../../../src/services';
import type { OrderStatus, Payment, Role, User } from '../../../src/domain';

interface Env {
  AUTH_SECRET?: string;
  ALLOW_DEMO_LOGIN?: string;
  DB?: D1Database;
  UPLOADS?: R2Bucket;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

interface R2ObjectBody {
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
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
      return respond(login(await loadState(env), body.identifier, body.password, env), 200);
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
      }, env);
      return respond(result, 201);
    }

    const currentState = await loadState(env);
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
      }, env);
      return respond(result, 200);
    }

    if (method === 'POST' && path === '/profile/photo') {
      if (!env.UPLOADS) throw httpError(503, 'Storage foto belum aktif');
      const actorPartner = findPartnerForUser(currentState, actor);
      if (actor.role !== 'partner' || !actorPartner) throw httpError(403, 'Hanya akun mitra yang bisa upload foto profil');
      const contentType = request.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) throw httpError(400, 'File harus berupa gambar JPG/PNG/WebP');
      const contentLength = Number(request.headers.get('content-length') ?? '0');
      if (contentLength > 1024 * 1024) throw httpError(400, 'Ukuran foto maksimal 1 MB');
      const body = await request.arrayBuffer();
      if (!body.byteLength) throw httpError(400, 'File foto kosong');
      if (body.byteLength > 1024 * 1024) throw httpError(400, 'Ukuran foto maksimal 1 MB');
      const extension = imageExtension(contentType);
      const key = `profile-photos/${actor.id}/${Date.now()}.${extension}`;
      await env.UPLOADS.put(key, body, { httpMetadata: { contentType }, customMetadata: { userId: actor.id, partnerId: actorPartner.id } });
      const avatarUrl = `/api/v1/uploads/${key}`;
      const result = await mutateState((draft) => {
        const userRecord = draft.users.find((item) => item.id === actor.id);
        const partnerRecord = draft.partners.find((item) => item.userId === actor.id);
        if (!userRecord || !partnerRecord) throw httpError(404, 'Profil mitra tidak ditemukan');
        userRecord.avatarUrl = avatarUrl;
        draft.auditLogs.unshift({ id: `audit-photo-${Date.now()}`, actorUserId: actor.id, action: 'PARTNER_PROFILE_PHOTO_UPLOADED', entityType: 'user', entityId: actor.id, newValue: { key, contentType, size: body.byteLength }, timestamp: new Date().toISOString() });
        return { avatarUrl, user: userRecord, state: filteredStateForUser(draft, actor.id) };
      }, env);
      return respond(result, 201);
    }

    const uploadMatch = path.match(/^\/uploads\/(.+)$/);
    if (method === 'GET' && uploadMatch) {
      if (!env.UPLOADS) throw httpError(404, 'File tidak ditemukan');
      const key = decodeURIComponent(uploadMatch[1]);
      if (!key.startsWith('profile-photos/')) throw httpError(403, 'File tidak boleh diakses');
      const object = await env.UPLOADS.get(key);
      if (!object) throw httpError(404, 'File tidak ditemukan');
      return new Response(await object.arrayBuffer(), { status: 200, headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } });
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
      }, env);
      return respond(result, 200);
    }

    if (method === 'POST' && path === '/orders') {
      const body = await readJson<{ partnerId?: string; shippingAddress: string; requestedDeliveryDate?: string; notes?: string; items: { productId: string; qty: number; packageWeightGram?: 250 | 500 | 1000; packageLabel?: string; notes?: string }[] }>(request);
      const result = await mutateState((draft) => {
        const actorPartner = findPartnerForUser(draft, actor);
        const partnerId = actor.role === 'partner' ? actorPartner?.id : body.partnerId;
        if (!partnerId) throw httpError(400, 'partnerId wajib untuk admin atau user mitra harus punya partner');
        return createOrder(draft, actor, partnerId, body.items, body.shippingAddress, body.notes, body.requestedDeliveryDate);
      }, env);
      return respond(result, 201);
    }

    const shippingMatch = path.match(/^\/orders\/([^/]+)\/shipping$/);
    if (method === 'PATCH' && shippingMatch) {
      const body = await readJson<{ shippingCost?: number; packingFee?: number; packingType?: 'none' | 'small_styrofoam' | 'medium_styrofoam' | 'large_styrofoam'; trackingNumber?: string; trackingReceiptUrl?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return updateOrderShipping(draft, actor, shippingMatch[1], body);
      }, env);
      return respond(result, 200);
    }

    const statusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const body = await readJson<{ status: OrderStatus; note?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return updateOrderStatus(draft, actor, statusMatch[1], body.status, body.note);
      }, env);
      return respond(result, 200);
    }

    const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoices$/);
    if (method === 'POST' && invoiceMatch) {
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'finance_admin', 'sales_admin']);
        return createInvoice(draft, actor, invoiceMatch[1]);
      }, env);
      return respond(result, 201);
    }

    const deliveryMatch = path.match(/^\/orders\/([^/]+)\/delivery-notes$/);
    if (method === 'POST' && deliveryMatch) {
      const body = await readJson<{ driverName?: string; vehicleNumber?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return createDeliveryNote(draft, actor, deliveryMatch[1], body.driverName, body.vehicleNumber);
      }, env);
      return respond(result, 201);
    }

    const paymentMatch = path.match(/^\/invoices\/([^/]+)\/payments$/);
    if (method === 'POST' && paymentMatch) {
      const body = await readJson<Pick<Payment, 'amount' | 'method' | 'referenceNumber'>>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'finance_admin']);
        return recordPayment(draft, actor, paymentMatch[1], Number(body.amount), body.method, body.referenceNumber);
      }, env);
      return respond(result, 201);
    }

    throw httpError(404, 'Endpoint tidak ditemukan');
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return respond({ error: error instanceof Error ? error.message : 'Internal server error' }, status);
  }
};

async function loadState(env?: Env) {
  if (state) return state;
  if (env?.DB) {
    const row = await env.DB.prepare("SELECT value FROM app_state WHERE key = ?").bind('state').first<{ value: string }>();
    if (row?.value) {
      state = JSON.parse(row.value) as AppState;
      return state;
    }
  }
  state = createSeedState();
  if (env?.DB) await saveState(env, state);
  return state;
}

async function saveState(env: Env | undefined, nextState: AppState) {
  state = nextState;
  if (!env?.DB) return;
  await env.DB.prepare("INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .bind('state', JSON.stringify(nextState))
    .run();
}

async function mutateState<T>(fn: (draft: AppState) => T | Promise<T>, env?: Env) {
  const current = await loadState(env);
  const result = await fn(current);
  await saveState(env, current);
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

function login(currentState: AppState, identifier: string, password: string, env?: Env) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const user = currentState.users.find((item) => normalizeIdentifier(item.email) === normalizedIdentifier || normalizePhone(item.phone) === normalizedIdentifier);
  if (!user || !verifyPassword(user, password, env)) throw httpError(401, 'Kredensial tidak valid');
  if (user.status !== 'active') throw httpError(403, 'User tidak aktif');
  return { token: signToken(user.id, env?.AUTH_SECRET), user };
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

const knownPasswordHashes: Record<string, string> = {
  password: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  mitrawahyubeef: '2862ae49e05e2b5c76d20d348bf41d4ac203b01dce9dca6ce6302272a6554832',
  wahyubeef: '62e005f8eedafada91e509c342ffaefb1c06ec79484610d10189b30e418a626c',
};

function verifyPassword(user: User, password: string, env?: Env) {
  const allowDemoLogin = env?.ALLOW_DEMO_LOGIN === 'true';
  if (user.passwordHash?.startsWith('demo-hash:')) return allowDemoLogin && user.passwordHash === hashPassword(password);
  if (user.passwordHash) return knownPasswordHashes[password] === user.passwordHash;
  const fallback = user.email.endsWith('@mitra.wahyubeef.local') ? 'mitrawahyubeef' : allowDemoLogin ? defaultPasswordForUser(user) : undefined;
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

function imageExtension(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
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
