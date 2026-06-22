import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { authenticate, hashPassword, httpError, login, requireRole, verifyPassword } from './auth.ts';
import { loadState, mutateState } from './persistence.ts';
import { backupStatus, runBackup, startBackupScheduler } from './backup.ts';
import { storeUpload } from './storage.ts';
import { cancelPartnerOrder, createInvoice, createOrder, findPartnerForUser, getLeaderboard, recordPayment, revisePartnerOrder, updateOrderQc, updateOrderShipping, updateOrderStatus } from '../services.ts';
import type { ExpeditionType, OrderStatus, Payment } from '../domain.ts';

const PORT = Number(process.env.PORT ?? 3000);
const DIST_DIR = resolve(process.cwd(), 'dist');

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/v1')) await handleApi(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    json(res, status, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

const handleApi: Handler = async (req, res, url) => {
  const path = url.pathname.replace('/api/v1', '') || '/';
  const method = req.method ?? 'GET';

  if (method === 'POST' && path === '/auth/login') {
    const state = await loadState();
    const body = await readJson<{ identifier: string; password: string }>(req);
    return json(res, 200, login(state, body.identifier, body.password));
  }

  if (method === 'POST' && path === '/partner-registrations') {
    const body = await readJson<Record<string, string>>(req);
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
    return json(res, 201, result);
  }

  const state = await loadState();
  const user = authenticate(state, req.headers.authorization);

  if (method === 'GET' && path === '/auth/me') return json(res, 200, { user });
  if (method === 'GET' && path === '/snapshot') return json(res, 200, filteredStateForUser(state, user.id));
  if (method === 'GET' && path === '/backup/status') {
    requireRole(user, ['super_admin']);
    return json(res, 200, backupStatus());
  }
  if (method === 'POST' && path === '/backup/run') {
    requireRole(user, ['super_admin']);
    return json(res, 201, await runBackup('manual'));
  }

  if (method === 'POST' && path === '/uploads/tracking-receipts') {
    requireRole(user, ['super_admin', 'sales_admin', 'warehouse']);
    const contentType = String(req.headers['content-type'] ?? 'application/octet-stream');
    const file = await readRaw(req);
    const stored = await storeUpload('tracking-receipts', user.id, contentType, file);
    return json(res, 201, { trackingReceiptUrl: stored.url, key: stored.key });
  }

  if (method === 'POST' && path === '/profile/photo') {
    if (user.role !== 'partner') throw httpError(403, 'Hanya akun mitra yang bisa upload foto profil');
    const contentType = String(req.headers['content-type'] ?? 'application/octet-stream');
    const file = await readRaw(req);
    const stored = await storeUpload('profile-photos', user.id, contentType, file);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      if (actor.role !== 'partner') throw httpError(403, 'Hanya akun mitra yang bisa upload foto profil');
      const userRecord = draft.users.find((item) => item.id === actor.id);
      if (!userRecord) throw httpError(404, 'User tidak ditemukan');
      userRecord.avatarUrl = stored.url;
      draft.auditLogs.unshift({
        id: `audit-profile-photo-${Date.now()}`,
        actorUserId: actor.id,
        action: 'PARTNER_PROFILE_PHOTO_UPLOADED',
        entityType: 'user',
        entityId: actor.id,
        newValue: { storageKey: stored.key },
        timestamp: new Date().toISOString(),
      });
      return { avatarUrl: stored.url, user: userRecord, state: filteredStateForUser(draft, actor.id) };
    });
    return json(res, 201, result);
  }

  if (method === 'PATCH' && path === '/profile/password') {
    const body = await readJson<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      if (actor.role !== 'partner') throw httpError(403, 'Hanya akun mitra yang bisa mengganti password di profil');
      const userRecord = draft.users.find((item) => item.id === actor.id);
      if (!userRecord) throw httpError(404, 'User tidak ditemukan');
      const currentPassword = String(body.currentPassword ?? '');
      const newPassword = String(body.newPassword ?? '');
      const confirmPassword = String(body.confirmPassword ?? '');
      if (!verifyPassword(userRecord, currentPassword)) throw httpError(400, 'Password saat ini tidak sesuai');
      if (newPassword.length < 8) throw httpError(400, 'Password baru minimal 8 karakter');
      if (newPassword !== confirmPassword) throw httpError(400, 'Konfirmasi password tidak sama');
      if (verifyPassword(userRecord, newPassword)) throw httpError(400, 'Password baru tidak boleh sama dengan password saat ini');
      userRecord.passwordHash = hashPassword(newPassword);
      draft.auditLogs.unshift({
        id: `audit-password-${Date.now()}`,
        actorUserId: actor.id,
        action: 'PARTNER_PASSWORD_UPDATED',
        entityType: 'user',
        entityId: actor.id,
        newValue: { changedByPartner: true },
        timestamp: new Date().toISOString(),
      });
      return { user: userRecord };
    });
    return json(res, 200, result);
  }

  if (method === 'PATCH' && path === '/profile') {
    const body = await readJson<{ name?: string; address?: string; phone?: string; avatarUrl?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
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
      draft.auditLogs.unshift({
        id: `audit-profile-${Date.now()}`,
        actorUserId: actor.id,
        action: 'PARTNER_PROFILE_UPDATED',
        entityType: 'partner',
        entityId: partnerRecord.id,
        newValue: { name, address, phone, hasAvatar: Boolean(avatarUrl) },
        timestamp: new Date().toISOString(),
      });
      return { user: userRecord, state: filteredStateForUser(draft, actor.id) };
    });
    return json(res, 200, result);
  }

  if (method === 'POST' && path === '/orders') {
    const body = await readJson<{ partnerId?: string; shippingAddress: string; requestedDeliveryDate?: string; expedition?: ExpeditionType; notes?: string; items: { productId: string; qty: number }[] }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      const actorPartner = findPartnerForUser(draft, actor);
      const partnerId = actor.role === 'partner' ? actorPartner?.id : body.partnerId;
      if (!partnerId) throw httpError(400, 'partnerId wajib untuk admin atau user mitra harus punya partner');
      return createOrder(draft, actor, partnerId, body.items, body.shippingAddress, body.notes, body.requestedDeliveryDate, body.expedition);
    });
    return json(res, 201, result);
  }

  const qcMatch = path.match(/^\/orders\/([^/]+)\/qc$/);
  if (method === 'PATCH' && qcMatch) {
    const body = await readJson<{ items: { itemId: string; qcDeliveredQty: number }[] }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
      return updateOrderQc(draft, actor, qcMatch[1], body);
    });
    return json(res, 200, result);
  }

  const statusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
  if (method === 'PATCH' && statusMatch) {
    const body = await readJson<{ status: OrderStatus; note?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
      return updateOrderStatus(draft, actor, statusMatch[1], body.status, body.note);
    });
    return json(res, 200, result);
  }

  const cancelMatch = path.match(/^\/orders\/([^/]+)\/cancel$/);
  if (method === 'PATCH' && cancelMatch) {
    const body = await readJson<{ note?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      return cancelPartnerOrder(draft, actor, cancelMatch[1], body.note);
    });
    return json(res, 200, result);
  }

  const shippingMatch = path.match(/^\/orders\/([^/]+)\/shipping$/);
  if (method === 'PATCH' && shippingMatch) {
    const body = await readJson<{ shippingCost?: number; packingFee?: number; packingType?: 'none' | 'small_styrofoam' | 'medium_styrofoam' | 'large_styrofoam'; packingQuantity?: number; trackingNumber?: string; trackingReceiptUrl?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
      return updateOrderShipping(draft, actor, shippingMatch[1], body);
    });
    return json(res, 200, result);
  }

  const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoices$/);
  if (method === 'POST' && invoiceMatch) {
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'finance_admin', 'sales_admin']);
      return createInvoice(draft, actor, invoiceMatch[1]);
    });
    return json(res, 201, result);
  }

  const paymentMatch = path.match(/^\/invoices\/([^/]+)\/payments$/);
  if (method === 'POST' && paymentMatch) {
    const body = await readJson<Pick<Payment, 'amount' | 'method' | 'referenceNumber'>>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'finance_admin']);
      return recordPayment(draft, actor, paymentMatch[1], Number(body.amount), body.method, body.referenceNumber);
    });
    return json(res, 201, result);
  }

  throw httpError(404, 'Endpoint tidak ditemukan');
};

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

function filteredStateForUser(state: Awaited<ReturnType<typeof loadState>>, userId: string) {
  const user = state.users.find((item) => item.id === userId)!;
  if (user.role !== 'partner') return { ...state, leaderboardRows: getLeaderboard(state).slice(0, 10) };
  const partner = state.partners.find((item) => item.userId === user.id);
  if (!partner) return { ...state, partners: [], orders: [], invoices: [], deliveryNotes: [], payments: [], auditLogs: [], accountingEvents: [] };
  const orderIds = new Set(state.orders.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  const invoiceIds = new Set(state.invoices.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  return {
    ...state,
    users: [user],
    partners: [partner],
    leaderboardRows: getLeaderboard(state).slice(0, 10),
    orders: state.orders.filter((item) => item.partnerId === partner.id),
    statusHistories: state.statusHistories.filter((item) => orderIds.has(item.orderId)),
    invoices: state.invoices.filter((item) => item.partnerId === partner.id),
    deliveryNotes: state.deliveryNotes.filter((item) => orderIds.has(item.orderId)),
    payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    auditLogs: [],
    accountingEvents: [],
  };
}


async function readRaw(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) as T : {} as T;
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function serveStatic(res: ServerResponse, pathname: string) {
  const safePath = normalize(pathname).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = safePath === '/' ? join(DIST_DIR, 'index.html') : join(DIST_DIR, safePath);
  const finalPath = filePath.startsWith(DIST_DIR) ? filePath : join(DIST_DIR, 'index.html');
  try {
    const data = await readFile(finalPath);
    res.writeHead(200, staticHeaders(finalPath));
    res.end(data);
  } catch {
    const data = await readFile(join(DIST_DIR, 'index.html'));
    res.writeHead(200, staticHeaders(join(DIST_DIR, 'index.html')));
    res.end(data);
  }
}

function staticHeaders(filePath: string) {
  const ext = extname(filePath);
  return {
    'Content-Type': contentType(filePath),
    'Cache-Control': ext === '.html' ? 'no-store, max-age=0' : 'no-cache, max-age=0, must-revalidate',
  };
}

function contentType(filePath: string) {
  const ext = extname(filePath);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

if (process.env.NODE_ENV !== 'test') {
  startBackupScheduler();
  server.listen(PORT, '0.0.0.0', () => console.log(`Frozen Membership App listening on http://0.0.0.0:${PORT}`));
}

export { server };
