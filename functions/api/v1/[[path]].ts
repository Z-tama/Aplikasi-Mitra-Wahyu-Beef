import { createSeedState, syncProductCatalogImages, syncProductCatalogPrices, type AppState, type PartnerRegistrationSubmission } from '../../../src/seed';
import { cancelPartnerOrder, createInvoice, createOrder, findPartnerForUser, getLeaderboard, recordPayment, revisePartnerOrder, updateOrderQc, updateOrderShipping, updateOrderStatus } from '../../../src/services';
import { expeditionLabels, formatIdr, statusLabels, type ExpeditionType, type Order, type OrderStatus, type Payment, type Role, type User } from '../../../src/domain';

interface Env {
  AUTH_SECRET?: string;
  ALLOW_DEMO_LOGIN?: string;
  DB?: D1Database;
  UPLOADS?: R2Bucket;
  WAHA_BASE_URL?: string;
  WAHA_SESSION?: string;
  WAHA_API_KEY?: string;
  WAHA_ADMIN_CHAT_ID?: string;
  WAHA_ADMIN_PHONE?: string;
  WAHA_AUTH_HEADER?: string;
  EMAIL_RELAY_URL?: string;
  EMAIL_RELAY_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  MAIL_TO?: string;
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
      await notifyPartnerRegistrationSubmitted(env, result);
      return respond(result, 201);
    }

    const currentState = await loadState(env);
    const actor = authenticate(currentState, request.headers.get('authorization') ?? undefined, env.AUTH_SECRET);

    if (method === 'GET' && path === '/auth/me') return respond({ user: actor }, 200);
    if (method === 'GET' && path === '/snapshot') return respond(filteredStateForUser(currentState, actor.id), 200);

    const registrationStatusMatch = path.match(/^\/partner-registrations\/([^/]+)\/status$/);
    if (method === 'PATCH' && registrationStatusMatch) {
      const body = await readJson<{ status?: PartnerRegistrationSubmission['status']; note?: string }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin']);
        const registration = draft.partnerRegistrations?.find((item) => item.id === registrationStatusMatch[1]);
        if (!registration) throw httpError(404, 'Request mitra tidak ditemukan');
        if (!['contacted', 'approved', 'rejected'].includes(String(body.status))) throw httpError(400, 'Status request tidak valid');
        const oldValue = { ...registration };
        registration.status = body.status as PartnerRegistrationSubmission['status'];
        let createdPartnerId = '';
        let createdUserId = '';
        if (body.status === 'approved') {
          const created = approvePartnerRegistration(draft, registration);
          createdPartnerId = created.partnerId;
          createdUserId = created.userId;
        }
        draft.auditLogs.unshift({ id: `audit-registration-status-${Date.now()}`, actorUserId: actor.id, action: body.status === 'approved' ? 'PARTNER_REGISTRATION_APPROVED_AND_ACCOUNT_CREATED' : 'PARTNER_REGISTRATION_STATUS_UPDATED', entityType: 'partnerRegistration', entityId: registration.id, oldValue, newValue: { ...registration, note: clean(body.note), createdPartnerId, createdUserId }, timestamp: new Date().toISOString() });
        return { registration, state: filteredStateForUser(draft, actor.id) };
      }, env);
      return respond(result, 200);
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
      const body = await readJson<{ partnerId?: string; shippingAddress: string; requestedDeliveryDate?: string; expedition?: ExpeditionType; notes?: string; items: { productId: string; qty: number; packageWeightGram?: 250 | 500 | 1000; packageLabel?: string; notes?: string }[] }>(request);
      const result = await mutateState((draft) => {
        const actorPartner = findPartnerForUser(draft, actor);
        const partnerId = actor.role === 'partner' ? actorPartner?.id : body.partnerId;
        if (!partnerId) throw httpError(400, 'partnerId wajib untuk admin atau user mitra harus punya partner');
        return createOrder(draft, actor, partnerId, body.items, body.shippingAddress, body.notes, body.requestedDeliveryDate, body.expedition);
      }, env);
      await notifyOrderCreated(env, currentState, result, actor);
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

    const qcMatch = path.match(/^\/orders\/([^/]+)\/qc$/);
    if (method === 'PATCH' && qcMatch) {
      const body = await readJson<{ items: { itemId: string; qcDeliveredQty: number }[] }>(request);
      const result = await mutateState((draft) => {
        requireRole(actor, ['super_admin', 'sales_admin', 'warehouse']);
        return updateOrderQc(draft, actor, qcMatch[1], body);
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

    const cancelMatch = path.match(/^\/orders\/([^/]+)\/cancel$/);
    if (method === 'PATCH' && cancelMatch) {
      const body = await readJson<{ note?: string }>(request);
      const result = await mutateState((draft) => cancelPartnerOrder(draft, actor, cancelMatch[1], body.note), env);
      await notifyOrderCancelled(env, currentState, result, actor);
      return respond(result, 200);
    }

    const reviseMatch = path.match(/^\/orders\/([^/]+)\/revise$/);
    if (method === 'PATCH' && reviseMatch) {
      const body = await readJson<{ requestedDeliveryDate?: string; expedition?: ExpeditionType; notes?: string; items: { productId: string; qty: number; packageWeightGram?: 250 | 500 | 1000; packageLabel?: string; notes?: string }[] }>(request);
      const result = await mutateState((draft) => revisePartnerOrder(draft, actor, reviseMatch[1], { cartItems: body.items, requestedDeliveryDate: body.requestedDeliveryDate, expedition: body.expedition, notes: body.notes }), env);
      await notifyOrderRevised(env, currentState, result, actor);
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
  if (env?.DB) {
    const row = await env.DB.prepare("SELECT value FROM app_state WHERE key = ?").bind('state').first<{ value: string }>();
    if (row?.value) {
      const latestState = ensureMitraState(JSON.parse(row.value) as AppState);
      state = latestState;
      await saveState(env, latestState);
      return latestState;
    }
    const seededState = ensureMitraState(createSeedState());
    state = seededState;
    await saveState(env, seededState);
    return seededState;
  }
  if (state) return ensureMitraState(state);
  state = ensureMitraState(createSeedState());
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


async function notifyPartnerRegistrationSubmitted(env: Env, registration: PartnerRegistrationSubmission) {
  if (env.WAHA_BASE_URL && env.WAHA_SESSION && env.WAHA_API_KEY) {
    const target = env.WAHA_ADMIN_CHAT_ID || (env.WAHA_ADMIN_PHONE ? `${normalizePhone(env.WAHA_ADMIN_PHONE)}@c.us` : '');
    if (target) {
      const text = [
        '🔔 *Calon Mitra Baru Mendaftar*',
        '',
        `Usaha: *${registration.businessName}*`,
        `PIC: ${registration.ownerName}`,
        `WA: ${registration.phone}`,
        registration.email ? `Email: ${registration.email}` : '',
        `Lokasi: ${registration.city}, ${registration.province}`,
        `Minat tier: ${registration.interestedTier}`,
        registration.currentSales ? `Estimasi: ${registration.currentSales}` : '',
        registration.notes ? `Catatan: ${registration.notes}` : '',
        '',
        'Buka menu Notifikasi / Mitra Management:',
        'https://mitra.wahyubeef.id/mitra',
      ].filter(Boolean).join('\n');
      try {
        const response = await sendWahaText(env, target, text);
        await recordRegistrationNotificationAudit(env, registration.id, 'WAHA_PARTNER_REGISTRATION_SENT', { target, status: response.status, ok: response.ok });
      } catch (error) {
        await recordRegistrationNotificationAudit(env, registration.id, 'WAHA_PARTNER_REGISTRATION_FAILED', { target, error: error instanceof Error ? error.message : 'WAHA registration notification failed' });
      }
    }
  }
  await notifyPartnerRegistrationEmail(env, registration);
}

async function notifyPartnerRegistrationEmail(env: Env, registration: PartnerRegistrationSubmission) {
  if (!env.RESEND_API_KEY && (!env.EMAIL_RELAY_URL || !env.EMAIL_RELAY_API_KEY)) return;
  const payload = {
    to: env.MAIL_TO,
    title: 'Calon Mitra Baru Mendaftar',
    description: 'Ada calon mitra baru yang mengisi form pendaftaran. Silakan review dari menu Mitra Management.',
    subjectPrefix: '[Wahyu Beef] Calon Mitra Baru',
    registration,
  };
  try {
    const response = env.RESEND_API_KEY ? await sendResendRegistrationEmail(env, payload) : await sendEmailRelay(env, payload);
    await recordRegistrationNotificationAudit(env, registration.id, 'EMAIL_PARTNER_REGISTRATION_SENT', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', status: response.status, ok: response.ok });
  } catch (error) {
    await recordRegistrationNotificationAudit(env, registration.id, 'EMAIL_PARTNER_REGISTRATION_FAILED', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', error: error instanceof Error ? error.message : 'Email registration notification failed' });
  }
}

async function sendResendRegistrationEmail(env: Env, payload: { to?: string; title: string; description: string; subjectPrefix: string; registration: PartnerRegistrationSubmission }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Wahyu Beef Mitra <noreply@wahyubeef.id>',
      to: [payload.to || env.MAIL_TO || 'wahyubeef.id@gmail.com'],
      subject: `${payload.subjectPrefix} - ${payload.registration.businessName}`,
      html: registrationEmailTemplate(payload),
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`RESEND ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

function registrationEmailTemplate(payload: { title: string; description: string; registration: PartnerRegistrationSubmission }) {
  const r = payload.registration;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.title)}</title></head><body style="margin:0;background:#fff7ed;font-family:Inter,Arial,sans-serif;color:#2f1d14;"><div style="max-width:720px;margin:0 auto;padding:28px 16px;"><div style="background:#8b1d16;border-radius:22px 22px 0 0;padding:26px;color:#fff;"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.9;">Wahyu Beef Mitra</div><h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">${escapeHtml(payload.title)}</h1><p style="margin:8px 0 0;color:#ffe7c2;">${escapeHtml(payload.description)}</p></div><div style="background:#fff;border:1px solid #f0d7bd;border-top:0;border-radius:0 0 22px 22px;padding:24px;"><div style="display:inline-block;background:#fff1d6;color:#8b1d16;border-radius:999px;padding:7px 12px;font-weight:700;font-size:13px;">Status Request</div><h2 style="margin:16px 0 6px;font-size:22px;color:#56110d;">${escapeHtml(r.businessName)}</h2><p style="margin:0 0 18px;color:#7a5b49;">${escapeHtml(r.ownerName)} • ${escapeHtml(r.phone)}</p><table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fffaf5;border-radius:14px;overflow:hidden;"><tr><td style="padding:12px;color:#7a5b49;">Email</td><td style="padding:12px;text-align:right;">${escapeHtml(r.email || '-')}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Lokasi</td><td style="padding:12px;text-align:right;">${escapeHtml(`${r.city}, ${r.province}`)}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Jenis Usaha</td><td style="padding:12px;text-align:right;">${escapeHtml(r.businessType || '-')}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Minat Tier</td><td style="padding:12px;text-align:right;">${escapeHtml(r.interestedTier || '-')}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Alamat</td><td style="padding:12px;text-align:right;">${escapeHtml(r.address || '-')}</td></tr></table><p style="margin:18px 0;color:#7a5b49;line-height:1.6;">${escapeHtml(r.notes || 'Tidak ada catatan tambahan.')}</p><div style="margin-top:24px;text-align:center;"><a href="https://mitra.wahyubeef.id/mitra" style="display:inline-block;background:#8b1d16;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:800;">Buka Mitra Management</a></div><p style="margin:24px 0 0;color:#7a5b49;font-size:13px;line-height:1.6;">Email otomatis dari Sistem Mitra Wahyu Beef.</p></div><div style="text-align:center;color:#9a725d;font-size:12px;margin-top:16px;line-height:1.6;">Wahyu Beef — Sukses Berjamaah<br>https://mitra.wahyubeef.id</div></div></body></html>`;
}

async function recordRegistrationNotificationAudit(env: Env | undefined, registrationId: string, action: string, newValue: unknown) {
  await mutateState((draft) => {
    draft.auditLogs.unshift({ id: `audit-registration-notification-${Date.now()}`, actorUserId: 'system', action, entityType: 'partnerRegistration', entityId: registrationId, newValue, timestamp: new Date().toISOString() });
    return null;
  }, env);
}

async function notifyOrderCreated(env: Env, currentState: AppState, order: Order, actor: User) {
  const partner = currentState.partners.find((item) => item.id === order.partnerId);

  if (env.WAHA_BASE_URL && env.WAHA_SESSION && env.WAHA_API_KEY) {
    const target = env.WAHA_ADMIN_CHAT_ID || (env.WAHA_ADMIN_PHONE ? `${normalizePhone(env.WAHA_ADMIN_PHONE)}@c.us` : '');
    if (target) {
      const itemCount = order.items.filter((item) => !item.productId.startsWith('packaging-')).reduce((sum, item) => sum + item.qty, 0);
      const productLines = order.items
        .filter((item) => !item.productId.startsWith('packaging-'))
        .slice(0, 6)
        .map((item) => `• ${item.productNameSnapshot} x ${item.qty} ${item.unitSnapshot} — ${formatIdr(item.lineTotal)}`)
        .join('\n');
      const moreItems = order.items.filter((item) => !item.productId.startsWith('packaging-')).length > 6 ? '\n• ...' : '';
      const text = [
        '🔔 *Order Mitra Baru*',
        '',
        `No Order: *${order.orderNumber}*`,
        `Mitra: ${partner?.businessName ?? '-'}`,
        `PIC: ${partner?.contactPerson ?? actor.name}`,
        `Kontak: ${partner?.phone ?? actor.phone ?? '-'}`,
        `Status: ${statusLabels[order.status]}`,
        `Total: *${formatIdr(order.grandTotal)}*`,
        `Ekspedisi: ${expeditionLabels[order.expedition ?? 'kib']}`,
        order.requestedDeliveryDate ? `Jadwal kirim: ${order.requestedDeliveryDate}` : '',
        `Qty item: ${itemCount}`,
        '',
        productLines ? `Ringkasan:\n${productLines}${moreItems}` : '',
        '',
        'Buka dashboard:',
        'https://mitra.wahyubeef.id/orders',
      ].filter(Boolean).join('\n');

      try {
        const response = await sendWahaText(env, target, text);
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_CREATED_SENT', { target, status: response.status, ok: response.ok });
      } catch (error) {
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_CREATED_FAILED', { target, error: error instanceof Error ? error.message : 'WAHA notification failed' });
      }
    }
  }

  await notifyOrderCreatedEmail(env, currentState, order, actor);
}

async function notifyOrderCancelled(env: Env, currentState: AppState, order: Order, actor: User) {
  const partner = currentState.partners.find((item) => item.id === order.partnerId);

  if (env.WAHA_BASE_URL && env.WAHA_SESSION && env.WAHA_API_KEY) {
    const target = env.WAHA_ADMIN_CHAT_ID || (env.WAHA_ADMIN_PHONE ? `${normalizePhone(env.WAHA_ADMIN_PHONE)}@c.us` : '');
    if (target) {
      const productItems = order.items.filter((item) => !item.productId.startsWith('packaging-'));
      const itemCount = productItems.reduce((sum, item) => sum + item.qty, 0);
      const productLines = productItems
        .slice(0, 8)
        .map((item) => `• ${item.productNameSnapshot} x ${item.qty} ${item.unitSnapshot} — ${formatIdr(item.lineTotal)}`)
        .join('\n');
      const moreItems = productItems.length > 8 ? '\n• ...' : '';
      const text = [
        '❌ *Order Mitra Dibatalkan*',
        '',
        `No Order: *${order.orderNumber}*`,
        `Mitra: ${partner?.businessName ?? '-'}`,
        `PIC: ${partner?.contactPerson ?? actor.name}`,
        `Kontak: ${partner?.phone ?? actor.phone ?? '-'}`,
        `Status: ${statusLabels[order.status]}`,
        `Total order: *${formatIdr(order.grandTotal)}*`,
        `Ekspedisi: ${expeditionLabels[order.expedition ?? 'kib']}`,
        order.requestedDeliveryDate ? `Jadwal kirim: ${order.requestedDeliveryDate}` : '',
        order.cancelledReason ? `Alasan: ${order.cancelledReason}` : '',
        `Qty item: ${itemCount}`,
        '',
        productLines ? `Ringkasan order dibatalkan:\n${productLines}${moreItems}` : '',
        '',
        'Buka dashboard:',
        'https://mitra.wahyubeef.id/orders',
      ].filter(Boolean).join('\n');

      try {
        const response = await sendWahaText(env, target, text);
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_CANCELLED_SENT', { target, status: response.status, ok: response.ok });
      } catch (error) {
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_CANCELLED_FAILED', { target, error: error instanceof Error ? error.message : 'WAHA cancelled notification failed' });
      }
    }
  }

  await notifyOrderCancelledEmail(env, currentState, order, actor);
}

async function notifyOrderCancelledEmail(env: Env, currentState: AppState, order: Order, actor: User) {
  if (!env.RESEND_API_KEY && (!env.EMAIL_RELAY_URL || !env.EMAIL_RELAY_API_KEY)) return;
  const partner = currentState.partners.find((item) => item.id === order.partnerId);
  const payload: OrderEmailPayload = {
    to: env.MAIL_TO,
    title: 'Order Mitra Dibatalkan',
    description: 'Mitra membatalkan pesanan. Mohon hentikan proses operasional untuk order ini bila belum diproses.',
    subjectPrefix: '[Wahyu Beef] Order Mitra Dibatalkan',
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: statusLabels[order.status],
      grandTotal: order.grandTotal,
      requestedDeliveryDate: order.requestedDeliveryDate,
      expedition: order.expedition,
      orderDate: order.orderDate,
      notes: order.cancelledReason || order.notes,
    },
    partner: {
      businessName: partner?.businessName ?? '-',
      contactPerson: partner?.contactPerson ?? actor.name,
      phone: partner?.phone ?? actor.phone ?? '-',
      email: partner?.email ?? actor.email,
      address: partner?.address ?? order.shippingAddress,
    },
    items: order.items.map((item) => ({
      name: item.productNameSnapshot,
      qty: item.qty,
      unit: item.unitSnapshot,
      lineTotal: item.lineTotal,
      notes: item.notes,
    })),
  };
  try {
    const response = env.RESEND_API_KEY ? await sendResendOrderEmail(env, payload) : await sendEmailRelay(env, payload);
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_CANCELLED_SENT', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', status: response.status, ok: response.ok });
  } catch (error) {
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_CANCELLED_FAILED', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', error: error instanceof Error ? error.message : 'Email cancelled notification failed' });
  }
}

async function notifyOrderRevised(env: Env, currentState: AppState, order: Order, actor: User) {
  const partner = currentState.partners.find((item) => item.id === order.partnerId);

  if (env.WAHA_BASE_URL && env.WAHA_SESSION && env.WAHA_API_KEY) {
    const target = env.WAHA_ADMIN_CHAT_ID || (env.WAHA_ADMIN_PHONE ? `${normalizePhone(env.WAHA_ADMIN_PHONE)}@c.us` : '');
    if (target) {
      const productItems = order.items.filter((item) => !item.productId.startsWith('packaging-'));
      const itemCount = productItems.reduce((sum, item) => sum + item.qty, 0);
      const productLines = productItems
        .slice(0, 8)
        .map((item) => `• ${item.productNameSnapshot} x ${item.qty} ${item.unitSnapshot} — ${formatIdr(item.lineTotal)}`)
        .join('\n');
      const moreItems = productItems.length > 8 ? '\n• ...' : '';
      const text = [
        '✏️ *Order Mitra Direvisi*',
        '',
        `No Order: *${order.orderNumber}*`,
        `Mitra: ${partner?.businessName ?? '-'}`,
        `PIC: ${partner?.contactPerson ?? actor.name}`,
        `Kontak: ${partner?.phone ?? actor.phone ?? '-'}`,
        `Status: ${statusLabels[order.status]}`,
        `Total terbaru: *${formatIdr(order.grandTotal)}*`,
        `Ekspedisi: ${expeditionLabels[order.expedition ?? 'kib']}`,
        order.requestedDeliveryDate ? `Jadwal kirim: ${order.requestedDeliveryDate}` : '',
        `Qty item terbaru: ${itemCount}`,
        '',
        productLines ? `Ringkasan revisi:\n${productLines}${moreItems}` : '',
        '',
        'Buka dashboard:',
        'https://mitra.wahyubeef.id/orders',
      ].filter(Boolean).join('\n');

      try {
        const response = await sendWahaText(env, target, text);
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_REVISED_SENT', { target, status: response.status, ok: response.ok });
      } catch (error) {
        await recordNotificationAudit(env, actor.id, order.id, 'WAHA_ORDER_REVISED_FAILED', { target, error: error instanceof Error ? error.message : 'WAHA revised notification failed' });
      }
    }
  }

  await notifyOrderRevisedEmail(env, currentState, order, actor);
}

async function notifyOrderRevisedEmail(env: Env, currentState: AppState, order: Order, actor: User) {
  if (!env.RESEND_API_KEY && (!env.EMAIL_RELAY_URL || !env.EMAIL_RELAY_API_KEY)) return;
  const partner = currentState.partners.find((item) => item.id === order.partnerId);
  const payload: OrderEmailPayload = {
    to: env.MAIL_TO,
    title: 'Order Mitra Direvisi',
    description: 'Mitra merevisi pesanan. Mohon cek ulang item, total, ekspedisi, dan jadwal kirim terbaru.',
    subjectPrefix: '[Wahyu Beef] Order Mitra Direvisi',
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: statusLabels[order.status],
      grandTotal: order.grandTotal,
      requestedDeliveryDate: order.requestedDeliveryDate,
      expedition: order.expedition,
      orderDate: order.orderDate,
      notes: order.notes,
    },
    partner: {
      businessName: partner?.businessName ?? '-',
      contactPerson: partner?.contactPerson ?? actor.name,
      phone: partner?.phone ?? actor.phone ?? '-',
      email: partner?.email ?? actor.email,
      address: partner?.address ?? order.shippingAddress,
    },
    items: order.items.map((item) => ({
      name: item.productNameSnapshot,
      qty: item.qty,
      unit: item.unitSnapshot,
      lineTotal: item.lineTotal,
      notes: item.notes,
    })),
  };
  try {
    const response = env.RESEND_API_KEY ? await sendResendOrderEmail(env, payload) : await sendEmailRelay(env, payload);
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_REVISED_SENT', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', status: response.status, ok: response.ok });
  } catch (error) {
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_REVISED_FAILED', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', error: error instanceof Error ? error.message : 'Email revised notification failed' });
  }
}

async function notifyOrderCreatedEmail(env: Env, currentState: AppState, order: Order, actor: User) {
  if (!env.RESEND_API_KEY && (!env.EMAIL_RELAY_URL || !env.EMAIL_RELAY_API_KEY)) return;
  const partner = currentState.partners.find((item) => item.id === order.partnerId);
  const payload = {
    to: env.MAIL_TO,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: statusLabels[order.status],
      grandTotal: order.grandTotal,
      requestedDeliveryDate: order.requestedDeliveryDate,
      expedition: order.expedition,
      orderDate: order.orderDate,
      notes: order.notes,
    },
    partner: {
      businessName: partner?.businessName ?? '-',
      contactPerson: partner?.contactPerson ?? actor.name,
      phone: partner?.phone ?? actor.phone ?? '-',
      email: partner?.email ?? actor.email,
      address: partner?.address ?? order.shippingAddress,
    },
    items: order.items.map((item) => ({
      name: item.productNameSnapshot,
      qty: item.qty,
      unit: item.unitSnapshot,
      lineTotal: item.lineTotal,
      notes: item.notes,
    })),
  };
  try {
    const response = env.RESEND_API_KEY ? await sendResendOrderEmail(env, payload) : await sendEmailRelay(env, payload);
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_CREATED_SENT', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', status: response.status, ok: response.ok });
  } catch (error) {
    await recordNotificationAudit(env, actor.id, order.id, 'EMAIL_ORDER_CREATED_FAILED', { provider: env.RESEND_API_KEY ? 'resend' : 'relay', error: error instanceof Error ? error.message : 'Email notification failed' });
  }
}

type OrderEmailPayload = {
  to?: string;
  title?: string;
  description?: string;
  subjectPrefix?: string;
  order: { orderNumber?: string; status?: string; statusLabel?: string; grandTotal?: number; requestedDeliveryDate?: string; expedition?: ExpeditionType; orderDate?: string; notes?: string };
  partner: { businessName?: string; contactPerson?: string; phone?: string; email?: string; address?: string };
  items: { name?: string; qty?: number; unit?: string; lineTotal?: number; notes?: string }[];
};

async function sendResendOrderEmail(env: Env, payload: OrderEmailPayload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Wahyu Beef Mitra <noreply@wahyubeef.id>',
      to: [payload.to || env.MAIL_TO || 'wahyubeef.id@gmail.com'],
      subject: `${payload.subjectPrefix || '[Wahyu Beef] Order Mitra Baru'} - ${payload.order.orderNumber || '-'}`,
      html: orderEmailTemplate(payload),
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`RESEND ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

async function sendEmailRelay(env: Env, payload: unknown) {
  const response = await fetch(env.EMAIL_RELAY_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EMAIL_RELAY_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`EMAIL_RELAY ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

function orderEmailTemplate(payload: OrderEmailPayload) {
  const order = payload.order ?? {};
  const partner = payload.partner ?? {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const itemRows = items.map((item) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #f0e5dc;">${escapeHtml(item.name || '-')}</td><td style="padding:10px 12px;border-bottom:1px solid #f0e5dc;text-align:center;">${escapeHtml(String(item.qty ?? '-'))} ${escapeHtml(item.unit || '')}</td><td style="padding:10px 12px;border-bottom:1px solid #f0e5dc;text-align:right;">${formatIdr(Number(item.lineTotal || 0))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.title || 'Order Mitra Baru')}</title></head><body style="margin:0;background:#fff7ed;font-family:Inter,Arial,sans-serif;color:#2f1d14;"><div style="max-width:720px;margin:0 auto;padding:28px 16px;"><div style="background:#8b1d16;border-radius:22px 22px 0 0;padding:26px;color:#fff;"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.9;">Wahyu Beef Mitra</div><h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">${escapeHtml(payload.title || 'Order Mitra Baru')}</h1><p style="margin:8px 0 0;color:#ffe7c2;">${escapeHtml(payload.description || 'Sistem menerima order baru yang perlu ditindaklanjuti oleh tim kemitraan.')}</p></div><div style="background:#fff;border:1px solid #f0d7bd;border-top:0;border-radius:0 0 22px 22px;padding:24px;"><div style="display:inline-block;background:#fff1d6;color:#8b1d16;border-radius:999px;padding:7px 12px;font-weight:700;font-size:13px;">${escapeHtml(order.statusLabel || order.status || 'Pending')}</div><h2 style="margin:16px 0 6px;font-size:22px;color:#56110d;">${escapeHtml(order.orderNumber || '-')}</h2><p style="margin:0 0 18px;color:#7a5b49;">${escapeHtml(partner.businessName || '-')} • ${escapeHtml(partner.contactPerson || '-')}</p><table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fffaf5;border-radius:14px;overflow:hidden;"><tr><td style="padding:12px;color:#7a5b49;">Total Tagihan</td><td style="padding:12px;text-align:right;font-size:20px;font-weight:800;color:#8b1d16;">${formatIdr(Number(order.grandTotal || 0))}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Kontak Mitra</td><td style="padding:12px;text-align:right;">${escapeHtml(partner.phone || '-')}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Ekspedisi</td><td style="padding:12px;text-align:right;">${escapeHtml(expeditionLabels[order.expedition || 'kib'])}</td></tr><tr><td style="padding:12px;color:#7a5b49;">Jadwal Kirim</td><td style="padding:12px;text-align:right;">${escapeHtml(order.requestedDeliveryDate || '-')}</td></tr></table><h3 style="margin:22px 0 8px;color:#56110d;">Ringkasan Item</h3><table style="width:100%;border-collapse:collapse;border:1px solid #f0e5dc;border-radius:14px;overflow:hidden;"><thead><tr style="background:#fff1d6;color:#56110d;"><th style="padding:10px 12px;text-align:left;">Produk</th><th style="padding:10px 12px;text-align:center;">Qty</th><th style="padding:10px 12px;text-align:right;">Subtotal</th></tr></thead><tbody>${itemRows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#7a5b49;">Tidak ada item.</td></tr>'}</tbody></table><div style="margin-top:24px;text-align:center;"><a href="https://mitra.wahyubeef.id/orders" style="display:inline-block;background:#8b1d16;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:800;">Buka Dashboard Mitra</a></div><p style="margin:24px 0 0;color:#7a5b49;font-size:13px;line-height:1.6;">Email ini dikirim otomatis oleh Sistem Mitra Wahyu Beef. Mohon tidak membalas email ini secara langsung.</p></div><div style="text-align:center;color:#9a725d;font-size:12px;margin-top:16px;line-height:1.6;">Wahyu Beef — Sukses Berjamaah<br>https://mitra.wahyubeef.id</div></div></body></html>`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}

async function sendWahaText(env: Env, chatId: string, text: string) {
  const baseUrl = String(env.WAHA_BASE_URL ?? '').replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = env.WAHA_AUTH_HEADER || 'X-Api-Key';
  if (authHeader.toLowerCase() === 'authorization') headers.Authorization = `Bearer ${env.WAHA_API_KEY}`;
  else headers[authHeader] = String(env.WAHA_API_KEY ?? '');
  const response = await fetch(`${baseUrl}/api/sendText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ session: env.WAHA_SESSION, chatId, text }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`WAHA ${response.status}: ${body.slice(0, 300)}`);
  }
  return response;
}

async function recordNotificationAudit(env: Env | undefined, actorUserId: string, orderId: string, action: string, newValue: unknown) {
  await mutateState((draft) => {
    draft.auditLogs.unshift({ id: `audit-notification-${Date.now()}`, actorUserId, action, entityType: 'order', entityId: orderId, newValue, timestamp: new Date().toISOString() });
    return null;
  }, env);
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
  minbeef: '136d3a96cd9a0977941f8384b83d6cac93c984f6f233bb9d71aa3eefad9ad6f0',
  mitrawahyubeef: '2862ae49e05e2b5c76d20d348bf41d4ac203b01dce9dca6ce6302272a6554832',
  wahyubeef: '62e005f8eedafada91e509c342ffaefb1c06ec79484610d10189b30e418a626c',
};

function verifyPassword(user: User, password: string, env?: Env) {
  const allowDemoLogin = env?.ALLOW_DEMO_LOGIN === 'true';
  if (user.passwordHash?.startsWith('demo-hash:')) return user.passwordHash === hashPassword(password);
  if (user.passwordHash) return knownPasswordHashes[password] === user.passwordHash;
  const fallback = user.email.endsWith('@mitra.wahyubeef.local') ? 'mitrawahyubeef' : allowDemoLogin ? defaultPasswordForUser(user) : undefined;
  return Boolean(fallback) && fallback === password;
}

function ensureMitraState(currentState: AppState) {
  const nextState = syncProductCatalogPrices(syncProductCatalogImages(currentState));
  backfillApprovedPartnerRegistrations(nextState);
  return nextState;
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

function backfillApprovedPartnerRegistrations(draft: AppState) {
  for (const registration of draft.partnerRegistrations ?? []) {
    if (registration.status !== 'approved') continue;
    const hasPartner = draft.partners.some((partner) => partner.id === `p-${registration.id}` || partner.phone === registration.phone || (!!registration.email && partner.email.toLowerCase() === registration.email.toLowerCase()));
    if (!hasPartner) {
      const created = approvePartnerRegistration(draft, registration);
      draft.auditLogs.unshift({ id: `audit-registration-backfill-${Date.now()}-${registration.id}`, actorUserId: 'system', action: 'PARTNER_REGISTRATION_APPROVED_BACKFILLED', entityType: 'partnerRegistration', entityId: registration.id, newValue: created, timestamp: new Date().toISOString() });
    }
  }
}

function approvePartnerRegistration(draft: AppState, registration: PartnerRegistrationSubmission) {
  const existingPartner = draft.partners.find((partner) => partner.phone === registration.phone || (!!registration.email && partner.email.toLowerCase() === registration.email.toLowerCase()));
  const existingUser = draft.users.find((user) => normalizePhone(user.phone) === normalizePhone(registration.phone) || (!!registration.email && user.email.toLowerCase() === registration.email.toLowerCase()));
  const tier = tierForRegistration(draft, registration);
  const timestamp = Date.now();
  const email = registration.email || `${normalizePhone(registration.phone) || `mitra${timestamp}`}@mitra.wahyubeef.local`;
  const userId = existingUser?.id || `u-${registration.id}`;
  const partnerId = existingPartner?.id || `p-${registration.id}`;
  if (existingUser) {
    existingUser.name = registration.ownerName;
    existingUser.email = existingUser.email || email;
    existingUser.phone = registration.phone;
    existingUser.role = 'partner';
    existingUser.status = 'active';
    existingUser.passwordHash = existingUser.passwordHash || hashPassword(defaultPartnerPassword(registration));
  } else {
    draft.users.unshift({ id: userId, name: registration.ownerName, email, phone: registration.phone, role: 'partner', status: 'active', passwordHash: hashPassword(defaultPartnerPassword(registration)) });
  }
  if (existingPartner) {
    existingPartner.userId = userId;
    existingPartner.tierId = tier.id;
    existingPartner.partnerCode = existingPartner.partnerCode || nextPartnerCode(draft, tier.code);
    existingPartner.businessName = registration.businessName;
    existingPartner.contactPerson = registration.ownerName;
    existingPartner.phone = registration.phone;
    existingPartner.email = email;
    existingPartner.address = registration.address;
    existingPartner.city = registration.city;
    existingPartner.province = registration.province;
    existingPartner.paymentTermDays = defaultPaymentTermDays(tier.code);
    existingPartner.creditLimit = defaultCreditLimit(tier.code);
    existingPartner.status = 'active';
  } else {
    draft.partners.unshift({ id: partnerId, userId, tierId: tier.id, partnerCode: nextPartnerCode(draft, tier.code), businessName: registration.businessName, contactPerson: registration.ownerName, phone: registration.phone, email, address: registration.address, city: registration.city, province: registration.province, creditLimit: defaultCreditLimit(tier.code), paymentTermDays: defaultPaymentTermDays(tier.code), status: 'active' });
  }
  return { partnerId, userId };
}

function tierForRegistration(draft: AppState, registration: PartnerRegistrationSubmission) {
  const interest = String(registration.interestedTier ?? '').toLowerCase();
  const code = interest.includes('distributor') ? 'DISTRIBUTOR' : interest.includes('agen') ? 'AGEN' : 'RESELLER';
  return draft.tiers.find((tier) => tier.code === code) || draft.tiers.find((tier) => tier.code === 'RESELLER') || draft.tiers[0];
}

function nextPartnerCode(draft: AppState, tierCode: string) {
  const letter = tierCode === 'DISTRIBUTOR' ? 'D' : tierCode === 'AGEN' ? 'A' : 'R';
  const prefix = `MWB-${letter}-`;
  const legacyPrefix = `MITRA-${letter}-`;
  const maxNumber = draft.partners.reduce((max, partner) => {
    const code = partner.partnerCode || '';
    const value = code.startsWith(prefix) ? Number(code.slice(prefix.length)) : code.startsWith(legacyPrefix) ? Number(code.slice(legacyPrefix.length)) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `${prefix}${String(maxNumber + 1).padStart(3, '0')}`;
}

function defaultPaymentTermDays(tierCode: string) {
  if (tierCode === 'DISTRIBUTOR') return 14;
  if (tierCode === 'AGEN') return 7;
  return 0;
}

function defaultCreditLimit(tierCode: string) {
  if (tierCode === 'DISTRIBUTOR') return 25_000_000;
  if (tierCode === 'AGEN') return 12_000_000;
  return 3_000_000;
}

function defaultPartnerPassword(registration: PartnerRegistrationSubmission) {
  const phone = normalizePhone(registration.phone);
  return phone.length >= 8 ? phone : 'mitrawahyubeef';
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
