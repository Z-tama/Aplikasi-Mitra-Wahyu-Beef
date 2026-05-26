import { createHmac } from 'node:crypto';

export type UploadKind = 'tracking-receipts' | 'profile-photos';
export type StorageKind = UploadKind | 'backups';

export interface StoredObject {
  key: string;
  url: string;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

const allowedTypes: Record<UploadKind, Set<string>> = {
  'tracking-receipts': new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  'profile-photos': new Set(['image/jpeg', 'image/png', 'image/webp']),
};

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function assertUpload(kind: UploadKind, contentType: string, size: number, maxBytes = DEFAULT_MAX_BYTES) {
  const cleanType = normalizeContentType(contentType);
  if (!allowedTypes[kind].has(cleanType)) throw httpStorageError(400, kind === 'tracking-receipts' ? 'File resi harus JPG, PNG, WEBP, atau PDF.' : 'Foto profil harus JPG, PNG, atau WEBP.');
  if (size <= 0) throw httpStorageError(400, 'File upload kosong.');
  if (size > maxBytes) throw httpStorageError(400, `Ukuran file maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`);
}

export async function storeUpload(kind: UploadKind, userId: string, contentType: string, data: Buffer): Promise<StoredObject> {
  assertUpload(kind, contentType, data.length);
  const cleanType = normalizeContentType(contentType);
  const key = `${kind}/${new Date().toISOString().slice(0, 10)}/${safePart(userId)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensions[cleanType] ?? 'bin'}`;
  return storeObject(key, cleanType, data, { allowInlineFallback: true });
}

export async function storeObject(key: string, contentType: string, data: Buffer, options: { allowInlineFallback?: boolean } = {}): Promise<StoredObject> {
  if (isR2Configured()) return uploadToR2(key, normalizeContentType(contentType), data);
  if (process.env.NODE_ENV === 'production' && process.env.R2_REQUIRED === 'true') throw httpStorageError(503, 'Storage R2 belum dikonfigurasi. Hubungi admin.');
  if (!options.allowInlineFallback) throw httpStorageError(503, 'Storage R2 belum dikonfigurasi untuk backup.');
  const cleanType = normalizeContentType(contentType);
  return { key: `inline://${key}`, url: `data:${cleanType};base64,${data.toString('base64')}` };
}

export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

function normalizeContentType(value: string) {
  return String(value || 'application/octet-stream').split(';')[0].trim().toLowerCase();
}

function safePart(value: string) {
  return String(value || 'user').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'user';
}

async function uploadToR2(key: string, contentType: string, data: Buffer): Promise<StoredObject> {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const bucket = requireEnv('R2_BUCKET');
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${bucket}/${key}`;
  const region = 'auto';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(data);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 's3');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: new Uint8Array(data),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw httpStorageError(502, `Upload ke R2 gagal (${response.status}). ${detail.slice(0, 160)}`.trim());
  }
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  return { key, url: publicBase ? `${publicBase}/${key}` : url };
}

async function sha256Hex(value: Buffer | string) {
  const input = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const hash = await crypto.subtle.digest('SHA-256', input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
  return Buffer.from(hash).toString('hex');
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  return createHmac('sha256', kService).update('aws4_request').digest();
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw httpStorageError(503, `Konfigurasi ${name} belum diisi.`);
  return value;
}

function httpStorageError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
