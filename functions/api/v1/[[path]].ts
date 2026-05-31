import { createSeedState, type AppState } from '../../../src/seed';
import { createInvoice, createOrder, findPartnerForUser, getLeaderboard, recordPayment, updateOrderShipping, updateOrderStatus } from '../../../src/services';
import type { OrderStatus, Payment, Role, User } from '../../../src/domain';

interface Env {
  AUTH_SECRET?: string;
  ALLOW_DEMO_LOGIN?: string;
  DB?: D1Database;
  UPLOADS?: R2Bucket;
  OLSERA_APP_ID?: string;
  OLSERA_SECRET_KEY?: string;
  OLSERA_STORE_ID?: string;
  OLSERA_API_BASE_URL?: string;
  OLSERA_CUSTOMERS_PATH?: string;
  OLSERA_PRODUCTS_PATH?: string;
  OLSERA_SYNC_TOKEN?: string;
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

    if (method === 'POST' && path === '/integrations/olsera/sync-members') {
      assertOlseraSyncAuthorized(request, env);
      const result = await syncOlseraMembers(env);
      return respond(result, 200);
    }

    if (method === 'POST' && path === '/integrations/olsera/sync-products') {
      assertOlseraSyncAuthorized(request, env);
      const result = await syncOlseraProducts(env);
      return respond(result, 200);
    }

    if (method === 'GET' && path === '/integrations/olsera/product-fields') {
      assertOlseraSyncAuthorized(request, env);
      const result = await inspectOlseraProductFields(env);
      return respond(result, 200);
    }

    if (method === 'POST' && path === '/integrations/olsera/archive-legacy-categories') {
      assertOlseraSyncAuthorized(request, env);
      const result = await archiveLegacyCatalogCategories(env);
      return respond(result, 200);
    }

    const currentState = await loadState(env);
    const actor = authenticate(currentState, request.headers.get('authorization') ?? undefined, env.AUTH_SECRET);

    if (method === 'GET' && path === '/auth/me') return respond({ user: actor }, 200);
    if (method === 'GET' && path === '/snapshot') return respond(filteredStateForUser(currentState, actor.id), 200);

    if (method === 'GET' && path === '/profile/olsera-stats') {
      if (actor.role !== 'partner') throw httpError(403, 'Hanya akun member yang bisa melihat statistik Olsera');
      const partner = findPartnerForUser(currentState, actor);
      if (!partner) throw httpError(404, 'Profil member tidak ditemukan');
      return respond(await fetchOlseraMemberStats(env, partner.businessName), 200);
    }

    if (method === 'GET' && path === '/leaderboard/olsera') {
      return respond(await fetchOlseraLeaderboard(env), 200);
    }

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
  member: 'e31ab643c44f7a0ec824b59d1194d60dac334200d845e61d2d289daa0f087ea4',
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
  const required = ['ownerName', 'phone', 'address'];
  for (const field of required) {
    if (!String(body[field] ?? '').trim()) throw httpError(400, 'Data pendaftaran belum lengkap');
  }
  const submittedAt = new Date().toISOString();
  const registration = {
    id: `reg-${Date.now()}`,
    businessName: clean(body.ownerName),
    ownerName: clean(body.ownerName),
    phone: clean(body.phone),
    email: clean(body.email),
    province: '',
    city: '',
    address: clean(body.address),
    businessType: 'Member Wahyu Beef',
    salesChannel: '',
    currentSales: '',
    interestedTier: 'Member',
    notes: clean(body.notes),
    status: 'new' as const,
    submittedAt,
    adminWhatsapp: '6282119000195',
    whatsappMessage: '',
  };
  registration.whatsappMessage = [
    'Pendaftaran Member Baru Wahyu Beef',
    `Nama Lengkap: ${registration.ownerName}`,
    `WA: ${registration.phone}`,
    registration.email ? `Email: ${registration.email}` : '',
    `Alamat: ${registration.address}`,
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
    leaderboardRows: getLeaderboard(currentState).slice(0, 10),
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

function assertOlseraSyncAuthorized(request: Request, env: Env) {
  const expected = env.OLSERA_SYNC_TOKEN;
  if (!expected) throw httpError(500, 'OLSERA_SYNC_TOKEN belum diset');
  const actual = request.headers.get('x-sync-token') ?? '';
  if (actual !== expected) throw httpError(403, 'Token sinkronisasi tidak valid');
}


type OlseraProduct = Record<string, unknown>;


async function inspectOlseraProductFields(env: Env) {
  const products = await fetchOlseraProducts(env);
  const sample = products.slice(0, 5).map((product) => ({
    keys: Object.keys(product).sort(),
    values: Object.fromEntries(Object.entries(product).filter(([key]) => /group|category|price|stock|qty|unit|name|sku|code|id/i.test(key)).slice(0, 80)),
  }));
  return { fetched: products.length, sample };
}

type OlseraProductImportItem = {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  description: string;
  unit: string;
  price: number;
  stock: number;
  raw: OlseraProduct;
};


async function archiveLegacyCatalogCategories(env: Env) {
  const legacyNames = new Set(['DAGING SAPI', 'TULANG SAPI', 'JEROAN SAPI', 'OLAHAN DAGING', 'SEAFOOD SERIES']);
  return mutateState((draft) => {
    const now = new Date().toISOString();
    const archived = draft.categories.filter((category) => category.isActive && legacyNames.has(category.name.toUpperCase()));
    for (const category of archived) category.isActive = false;
    if (archived.length) draft.auditLogs.unshift({ id: `audit-legacy-categories-${Date.now()}`, actorUserId: 'olsera-sync', action: 'LEGACY_CATEGORIES_ARCHIVED', entityType: 'productCategory', entityId: 'legacy-categories', newValue: { archived: archived.map((category) => ({ id: category.id, name: category.name })) }, timestamp: now });
    return { archived: archived.length, names: archived.map((category) => category.name) };
  }, env);
}

async function syncOlseraProducts(env: Env) {
  if (!env.OLSERA_APP_ID || !env.OLSERA_SECRET_KEY || !env.OLSERA_STORE_ID) throw httpError(500, 'Credential Olsera belum lengkap');
  const baseUrl = (env.OLSERA_API_BASE_URL || 'https://api-open.olsera.co.id').replace(/\/$/, '');
  const accessToken = await fetchOlseraAccessToken(baseUrl, env);
  const [products, groups] = await Promise.all([fetchOlseraProducts(env, baseUrl, accessToken), fetchOlseraProductGroups(baseUrl, accessToken)]);
  const result = await mutateState((draft) => importOlseraProducts(draft, products, groups), env);
  return { ...result, source: 'olsera', storeId: env.OLSERA_STORE_ID };
}

async function fetchOlseraProducts(env: Env, suppliedBaseUrl?: string, suppliedAccessToken?: string): Promise<OlseraProduct[]> {
  const baseUrl = suppliedBaseUrl || (env.OLSERA_API_BASE_URL || 'https://api-open.olsera.co.id').replace(/\/$/, '');
  const accessToken = suppliedAccessToken || await fetchOlseraAccessToken(baseUrl, env);
  const pathTemplate = env.OLSERA_PRODUCTS_PATH || '/api/open-api/v1/en/product?page={page}';
  const products: OlseraProduct[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const path = pathTemplate
      .replace('{storeId}', encodeURIComponent(env.OLSERA_STORE_ID || ''))
      .replace('{page}', String(page));
    const separator = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${path.includes('page=') ? '' : `${separator}page=${page}`}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw httpError(response.status, `Olsera product API gagal: ${readOlseraError(payload, response.statusText)}`);
    const payloadRecord = payload as { data?: unknown; products?: unknown; result?: unknown; meta?: { last_page?: unknown } };
    const raw: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payloadRecord.data) ? payloadRecord.data : Array.isArray(payloadRecord.products) ? payloadRecord.products : Array.isArray(payloadRecord.result) ? payloadRecord.result : [];
    products.push(...raw.filter((item: unknown): item is OlseraProduct => Boolean(item && typeof item === 'object')));
    const reportedLastPage = Number(payloadRecord.meta?.last_page ?? 1);
    lastPage = Number.isFinite(reportedLastPage) && reportedLastPage > 0 ? reportedLastPage : 1;
    page += 1;
    if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 900));
  } while (page <= lastPage);

  return products;
}

async function fetchOlseraProductGroups(baseUrl: string, accessToken: string) {
  const paths = [
    '/api/open-api/v1/en/product/group?page={page}',
    '/api/open-api/v1/en/product/productgroup?page={page}',
    '/api/open-api/v1/en/product/klasifikasi?page={page}',
  ];
  for (const pathTemplate of paths) {
    const groups: OlseraProduct[] = [];
    let page = 1;
    let lastPage = 1;
    let ok = false;
    do {
      const url = `${baseUrl}${pathTemplate.replace('{page}', String(page))}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) break;
      if (!response.ok) break;
      ok = true;
      const payloadRecord = payload as { data?: unknown; groups?: unknown; result?: unknown; meta?: { last_page?: unknown } };
      const raw: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payloadRecord.data) ? payloadRecord.data : Array.isArray(payloadRecord.groups) ? payloadRecord.groups : Array.isArray(payloadRecord.result) ? payloadRecord.result : [];
      groups.push(...raw.filter((item: unknown): item is OlseraProduct => Boolean(item && typeof item === 'object')));
      const reportedLastPage = Number(payloadRecord.meta?.last_page ?? 1);
      lastPage = Number.isFinite(reportedLastPage) && reportedLastPage > 0 ? reportedLastPage : 1;
      page += 1;
      if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 600));
    } while (page <= lastPage);
    if (ok && groups.length) {
      const map = new Map<string, string>();
      for (const group of groups) {
        const id = readFirst(group, ['id', 'product_group_id', 'klasifikasi_id']);
        const name = readFirst(group, ['name', 'group_name', 'klasifikasi', 'description']);
        if (id && name) map.set(id, name);
      }
      if (map.size) return map;
    }
  }
  return new Map<string, string>();
}

function importOlseraProducts(draft: AppState, rawProducts: OlseraProduct[], groups = new Map<string, string>()) {
  const now = new Date().toISOString();
  const activeOldCategories = draft.categories.filter((category) => category.isActive).length;
  const activeOldProducts = draft.products.filter((product) => product.isActive).length;
  const imported = rawProducts.map((product) => mapOlseraProduct(product, groups)).filter((item) => item.name && item.price > 0);
  const groupNames = Array.from(new Set(imported.map((item) => item.categoryName))).sort(sortCategoryNames);
  const categories = groupNames.map((name) => ({ id: `olsera-cat-${slugify(name)}`, name, slug: slugify(name), isActive: true }));
  const categoryMap = new Map(categories.map((category) => [category.name, category.id]));
  const tiers = draft.tiers.length ? draft.tiers : [{ id: 'tier-reseller', code: 'RESELLER', name: 'Member Basic', discountRate: 0, paymentTermDays: 0, isActive: true }];

  draft.categories = [
    ...draft.categories.map((category) => category.isActive ? { ...category, isActive: false, slug: category.slug.startsWith('archived-') ? category.slug : `archived-${category.slug}` } : category),
    ...categories,
  ];
  draft.products = [
    ...draft.products.map((product) => product.isActive ? { ...product, isActive: false } : product),
    ...imported.map((item) => ({
      id: item.id,
      categoryId: categoryMap.get(item.categoryName) || categories[0]?.id || 'olsera-cat-lainnya',
      sku: item.sku,
      name: item.name,
      description: item.stock > 0 ? `${item.description}${item.description ? ' • ' : ''}Stok Olsera: ${item.stock}` : item.description,
      unit: item.unit,
      weightGram: undefined,
      imageUrl: readFirst(item.raw, ['photo', 'image', 'image_url', 'photo_md', 'photo_lg', 'picture']) || undefined,
      minimumOrderQty: 1,
      baseCost: undefined,
      isActive: true,
    })),
  ];
  draft.prices = [
    ...draft.prices.map((price) => price.isActive ? { ...price, isActive: false, effectiveTo: now } : price),
    ...imported.flatMap((item) => tiers.map((tier) => ({
      id: `olsera-price-${item.id}-${tier.id}`,
      productId: item.id,
      tierId: tier.id,
      price: item.price,
      effectiveFrom: now.slice(0, 10),
      isActive: true,
    }))),
  ];
  draft.auditLogs.unshift({ id: `audit-olsera-products-${Date.now()}`, actorUserId: 'olsera-sync', action: 'OLSERA_PRODUCTS_SYNCED', entityType: 'integration', entityId: 'olsera-products', newValue: { fetched: rawProducts.length, imported: imported.length, categories: categories.length, archivedProducts: activeOldProducts, archivedCategories: activeOldCategories }, timestamp: now });
  return { fetched: rawProducts.length, imported: imported.length, categories: categories.length, archivedProducts: activeOldProducts, archivedCategories: activeOldCategories, stockSynced: imported.some((item) => item.stock > 0) };
}

function mapOlseraProduct(product: OlseraProduct, groups = new Map<string, string>()): OlseraProductImportItem {
  const name = readFirst(product, ['name', 'product_name', 'product_text', 'product']) || 'Produk Olsera';
  const sku = readFirst(product, ['sku', 'code', 'product_code', 'barcode']) || `OLS-${readFirst(product, ['id', 'product_id']) || slugify(name)}`;
  const id = `olsera-prd-${slugify(readFirst(product, ['id', 'product_id']) || sku || name)}`;
  const groupId = readFirst(product, ['product_group_id', 'klasifikasi_id', 'group_id']);
  const categoryName = readFirst(product, ['group_name', 'product_group_name', 'klasifikasi', 'category_name', 'category', 'group']) || groups.get(groupId) || (groupId ? `Grup ${groupId}` : 'Lainnya');
  const price = readNumber(product, ['sell_price', 'selling_price', 'price', 'price_sell', 'retail_price', 'sellprice', 'price_sell_store', 'store_price']);
  const stock = readNumber(product, ['stock_qty', 'stock', 'qty', 'quantity', 'available_stock', 'total_stock']);
  return {
    id,
    sku,
    name,
    categoryName,
    description: readFirst(product, ['description', 'notes', 'variant_name']),
    unit: readFirst(product, ['unit', 'uom', 'unit_name']) || 'pcs',
    price,
    stock,
    raw: product,
  };
}

function sortCategoryNames(a: string, b: string) {
  const preferred = ['DAGING', 'TULANG', 'JEROAN', 'OLAHAN', 'BERKAH CHICKEN'];
  const ai = preferred.indexOf(a.toUpperCase());
  const bi = preferred.indexOf(b.toUpperCase());
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
}

function slugify(value: string) {
  return String(value || 'item').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

async function syncOlseraMembers(env: Env) {
  if (!env.OLSERA_APP_ID || !env.OLSERA_SECRET_KEY || !env.OLSERA_STORE_ID) throw httpError(500, 'Credential Olsera belum lengkap');
  const members = await fetchOlseraMembers(env);
  const result = await mutateState((draft) => upsertOlseraMembers(draft, members), env);
  return { ...result, source: 'olsera', storeId: env.OLSERA_STORE_ID, importedType: 'MEMBER' };
}

type OlseraMember = Record<string, unknown>;

async function fetchOlseraMembers(env: Env): Promise<OlseraMember[]> {
  const baseUrl = (env.OLSERA_API_BASE_URL || 'https://api-open.olsera.co.id').replace(/\/$/, '');
  const accessToken = await fetchOlseraAccessToken(baseUrl, env);
  const pathTemplate = env.OLSERA_CUSTOMERS_PATH || '/api/open-api/v1/en/customersupplier/customer?search=MEMBER&page={page}';
  const members: OlseraMember[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const path = pathTemplate
      .replace('{storeId}', encodeURIComponent(env.OLSERA_STORE_ID || ''))
      .replace('{page}', String(page));
    const separator = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${path.includes('page=') ? '' : `${separator}page=${page}`}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw httpError(response.status, `Olsera API gagal: ${readOlseraError(payload, response.statusText)}`);
    const payloadRecord = payload as { data?: unknown; customers?: unknown; result?: unknown; meta?: { last_page?: unknown } };
    const raw: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payloadRecord.data) ? payloadRecord.data : Array.isArray(payloadRecord.customers) ? payloadRecord.customers : Array.isArray(payloadRecord.result) ? payloadRecord.result : [];
    members.push(...raw.filter((item: unknown): item is OlseraMember => Boolean(item && typeof item === 'object')));
    const reportedLastPage = Number(payloadRecord.meta?.last_page ?? 1);
    lastPage = Number.isFinite(reportedLastPage) && reportedLastPage > 0 ? reportedLastPage : 1;
    page += 1;
    if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 1200));
  } while (page <= lastPage);

  return members.filter((member) => String(readFirst(member, ['customer_type_name', 'type_name', 'customer_type'])).toUpperCase() === 'MEMBER');
}

async function fetchOlseraLeaderboard(env: Env) {
  if (!env.OLSERA_APP_ID || !env.OLSERA_SECRET_KEY) throw httpError(500, 'Credential Olsera belum lengkap');
  const baseUrl = (env.OLSERA_API_BASE_URL || 'https://api-open.olsera.co.id').replace(/\/$/, '');
  const accessToken = await fetchOlseraAccessToken(baseUrl, env);
  const members = await fetchOlseraMembers(env);
  const candidates = members
    .map((member) => ({
      member,
      memberId: String(readFirst(member, ['id', 'customer_id']) || readFirst(member, ['name', 'customer_text', 'customer_name'])),
      memberName: String(readFirst(member, ['name', 'customer_text', 'customer_name']) || 'Member Olsera'),
      points: readNumber(member, ['balance_points', 'points', 'point', 'loyalty_points']),
    }))
    .sort((a, b) => b.points - a.points || a.memberName.localeCompare(b.memberName))
    .slice(0, 10);

  const enriched: Array<{ rank: number; memberId: string; memberName: string; points: number; transactionCount: number; transactionAmount: number; paidAmount: number; debtAmount: number }> = [];
  for (const candidate of candidates) {
    const stats = await computeOlseraMemberStats(baseUrl, accessToken, candidate.memberName);
    enriched.push({ rank: 0, memberId: candidate.memberId, memberName: candidate.memberName, points: candidate.points, ...stats });
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  return enriched
    .sort((a, b) => b.points - a.points || b.transactionCount - a.transactionCount || b.transactionAmount - a.transactionAmount || a.memberName.localeCompare(b.memberName))
    .map((row, index) => ({ ...row, rank: index + 1, tier: 'Member Basic' }));
}

async function fetchOlseraMemberStats(env: Env, customerName: string) {
  if (!env.OLSERA_APP_ID || !env.OLSERA_SECRET_KEY) throw httpError(500, 'Credential Olsera belum lengkap');
  const baseUrl = (env.OLSERA_API_BASE_URL || 'https://api-open.olsera.co.id').replace(/\/$/, '');
  const accessToken = await fetchOlseraAccessToken(baseUrl, env);
  return { ...(await computeOlseraMemberStats(baseUrl, accessToken, customerName)), source: 'olsera' };
}

async function computeOlseraMemberStats(baseUrl: string, accessToken: string, customerName: string) {
  const orders = await fetchOlseraClosedOrdersBySearch(baseUrl, accessToken, customerName);
  const transactionCount = orders.length;
  const transactionAmount = orders.reduce((sum, order) => sum + readNumber(order, ['total_amount', 'order_amount']), 0);
  const paidAmount = orders.filter((order) => Number(readFirst(order, ['is_paid'])) === 1).reduce((sum, order) => sum + readNumber(order, ['total_amount', 'order_amount']), 0);
  const debtAmount = Math.max(0, transactionAmount - paidAmount);
  return { transactionCount, transactionAmount, paidAmount, debtAmount };
}

async function fetchOlseraClosedOrdersBySearch(baseUrl: string, accessToken: string, search: string) {
  const orders: OlseraMember[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = `${baseUrl}/api/open-api/v1/en/order/closeorder?search=${encodeURIComponent(search)}&page=${page}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404) return orders;
    if (!response.ok) throw httpError(response.status, `Olsera order API gagal: ${readOlseraError(payload, response.statusText)}`);
    const payloadRecord = payload as { data?: unknown; meta?: { last_page?: unknown } };
    const raw = Array.isArray(payloadRecord.data) ? payloadRecord.data : [];
    orders.push(...raw.filter((item: unknown): item is OlseraMember => Boolean(item && typeof item === 'object')));
    const reportedLastPage = Number(payloadRecord.meta?.last_page ?? 1);
    lastPage = Number.isFinite(reportedLastPage) && reportedLastPage > 0 ? reportedLastPage : 1;
    page += 1;
    if (page <= lastPage) await new Promise((resolve) => setTimeout(resolve, 500));
  } while (page <= lastPage);
  return orders;
}

async function fetchOlseraAccessToken(baseUrl: string, env: Env) {
  const form = new URLSearchParams({ grant_type: 'secret_key', app_id: env.OLSERA_APP_ID ?? '', secret_key: env.OLSERA_SECRET_KEY ?? '' });
  const response = await fetch(`${baseUrl}/api/open-api/v1/id/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form.toString() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, `Olsera token gagal: ${readOlseraError(payload, response.statusText)}`);
  const token = (payload as { access_token?: unknown }).access_token;
  if (!token || typeof token !== 'string') throw httpError(502, 'Olsera token response tidak berisi access_token');
  return token;
}

function readOlseraError(payload: unknown, fallback: string) {
  const record = payload as { message?: unknown; error?: unknown };
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; error?: unknown };
    if (typeof nested.message === 'string') return nested.message;
    if (typeof nested.error === 'string') return nested.error;
  }
  return fallback;
}

function upsertOlseraMembers(draft: AppState, members: OlseraMember[]) {
  const now = new Date().toISOString();
  const fallbackTier = draft.tiers.find((tier) => tier.code === 'RESELLER') ?? draft.tiers[0];
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const member of members) {
    const externalId = readFirst(member, ['id', 'customer_id', 'customerId', 'member_id', 'memberId']);
    const phone = normalizePhone(readFirst(member, ['phone', 'mobile', 'mobile_phone', 'customer_phone', 'whatsapp']));
    const email = String(readFirst(member, ['email', 'customer_email']) || '').trim().toLowerCase();
    const name = String(readFirst(member, ['name', 'customer_name', 'fullname', 'full_name']) || '').trim();
    if (!phone && !email) { skipped.push(String(externalId || name || 'unknown')); continue; }

    const userId = `olsera-user-${externalId || phone || email}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const partnerId = `olsera-member-${externalId || phone || email}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const displayName = name || email || phone || 'Member Olsera';
    const safeEmail = email || `${partnerId}@olsera.local`;
    const address = String(readFirst(member, ['address', 'customer_address', 'shipping_address']) || '-');
    const city = String(readFirst(member, ['city', 'customer_city']) || '-');
    const province = String(readFirst(member, ['province', 'state']) || '-');
    const points = readNumber(member, ['balance_points', 'points', 'point', 'loyalty_points']);

    const existingUser = draft.users.find((user) => user.id === userId || (email && user.email.toLowerCase() === email) || (phone && normalizePhone(user.phone) === phone));
    if (existingUser) {
      existingUser.name = displayName;
      existingUser.email = safeEmail;
      existingUser.phone = phone || existingUser.phone;
      existingUser.role = 'partner';
      existingUser.status = 'active';
      existingUser.passwordHash = knownPasswordHashes.member;
      updated += 1;
    } else {
      draft.users.push({ id: userId, name: displayName, email: safeEmail, phone, role: 'partner', status: 'active', passwordHash: knownPasswordHashes.member });
      created += 1;
    }

    const ownerUser = existingUser ?? draft.users.find((user) => user.id === userId)!;
    const existingPartner = draft.partners.find((partner) => partner.id === partnerId || partner.userId === ownerUser.id || (phone && normalizePhone(partner.phone) === phone) || (email && partner.email.toLowerCase() === email));
    const partnerPayload = {
      userId: ownerUser.id,
      tierId: fallbackTier.id,
      partnerCode: `OLSERA-${String(externalId || phone || email).slice(0, 24).toUpperCase()}`,
      businessName: displayName,
      contactPerson: displayName,
      phone: phone || '-',
      email: safeEmail,
      address,
      city,
      province,
      paymentTermDays: 0,
      points,
      status: 'active' as const,
    };
    if (existingPartner) Object.assign(existingPartner, partnerPayload);
    else draft.partners.push({ id: partnerId, ...partnerPayload });
  }

  draft.auditLogs.unshift({ id: `audit-olsera-sync-${Date.now()}`, actorUserId: 'olsera-sync', action: 'OLSERA_MEMBERS_SYNCED', entityType: 'integration', entityId: 'olsera-members', newValue: { fetched: members.length, created, updated, skipped: skipped.length }, timestamp: now });
  return { fetched: members.length, created, updated, skipped };
}

function readFirst(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  const raw = readFirst(source, keys).replace(/,/g, '');
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}
