import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { authenticate, httpError, login, requireRole } from './auth';
import { loadState, mutateState } from './persistence';
import { createDeliveryNote, createInvoice, createOrder, findPartnerForUser, recordPayment, updateOrderStatus } from '../services';
import type { OrderStatus, Payment } from '../domain';

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

  const state = await loadState();
  const user = authenticate(state, req.headers.authorization);

  if (method === 'GET' && path === '/auth/me') return json(res, 200, { user });
  if (method === 'GET' && path === '/snapshot') return json(res, 200, filteredStateForUser(state, user.id));

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
    const body = await readJson<{ partnerId?: string; shippingAddress: string; notes?: string; items: { productId: string; qty: number }[] }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      const actorPartner = findPartnerForUser(draft, actor);
      const partnerId = actor.role === 'partner' ? actorPartner?.id : body.partnerId;
      if (!partnerId) throw httpError(400, 'partnerId wajib untuk admin atau user mitra harus punya partner');
      return createOrder(draft, actor, partnerId, body.items, body.shippingAddress, body.notes);
    });
    return json(res, 201, result);
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

  const invoiceMatch = path.match(/^\/orders\/([^/]+)\/invoices$/);
  if (method === 'POST' && invoiceMatch) {
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'finance_admin', 'sales_admin']);
      return createInvoice(draft, actor, invoiceMatch[1]);
    });
    return json(res, 201, result);
  }

  const deliveryMatch = path.match(/^\/orders\/([^/]+)\/delivery-notes$/);
  if (method === 'POST' && deliveryMatch) {
    const body = await readJson<{ driverName?: string; vehicleNumber?: string }>(req);
    const result = await mutateState((draft) => {
      const actor = authenticate(draft, req.headers.authorization);
      requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
      return createDeliveryNote(draft, actor, deliveryMatch[1], body.driverName, body.vehicleNumber);
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

function filteredStateForUser(state: Awaited<ReturnType<typeof loadState>>, userId: string) {
  const user = state.users.find((item) => item.id === userId)!;
  if (user.role !== 'partner') return state;
  const partner = state.partners.find((item) => item.userId === user.id);
  if (!partner) return { ...state, partners: [], orders: [], invoices: [], deliveryNotes: [], payments: [], auditLogs: [], accountingEvents: [] };
  const orderIds = new Set(state.orders.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  const invoiceIds = new Set(state.invoices.filter((item) => item.partnerId === partner.id).map((item) => item.id));
  return {
    ...state,
    users: [user],
    partners: [partner],
    orders: state.orders.filter((item) => item.partnerId === partner.id),
    statusHistories: state.statusHistories.filter((item) => orderIds.has(item.orderId)),
    invoices: state.invoices.filter((item) => item.partnerId === partner.id),
    deliveryNotes: state.deliveryNotes.filter((item) => orderIds.has(item.orderId)),
    payments: state.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    auditLogs: [],
    accountingEvents: [],
  };
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
    res.writeHead(200, { 'Content-Type': contentType(finalPath) });
    res.end(data);
  } catch {
    const data = await readFile(join(DIST_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  }
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
  server.listen(PORT, '0.0.0.0', () => console.log(`Frozen Membership App listening on http://0.0.0.0:${PORT}`));
}

export { server };
