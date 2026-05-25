import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppState } from '../seed.ts';
import { demoPasswords } from '../seed.ts';
import type { Role, User } from '../domain.ts';

const SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me';
const sessions = new Map<string, string>();

export function login(state: AppState, identifier: string, password: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const user = state.users.find((item) => item.email.toLowerCase() === normalizedIdentifier || normalizePhone(item.phone) === normalizedIdentifier);
  if (!user || !verifyPassword(user, password)) throw httpError(401, 'Kredensial tidak valid');
  if (user.status !== 'active') throw httpError(403, 'User tidak aktif');
  const token = signToken(user.id);
  sessions.set(token, user.id);
  return { token, user };
}

export function authenticate(state: AppState, authorization?: string): User {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !verifyToken(token)) throw httpError(401, 'Token tidak valid');
  const userId = sessions.get(token) ?? token.split('.')[0];
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.status !== 'active') throw httpError(401, 'Session tidak valid');
  return user;
}

export function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw httpError(403, 'Akses ditolak untuk role ini');
}

export function canSeePartner(user: User, partnerUserId: string) {
  return user.role !== 'partner' || user.id === partnerUserId;
}

function signToken(userId: string) {
  const nonce = randomBytes(12).toString('hex');
  const payload = `${userId}.${Date.now()}.${nonce}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const payload = parts.slice(0, 3).join('.');
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const actual = parts[3];
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

export function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(user: User, password: string) {
  if (user.passwordHash) return user.passwordHash === hashPassword(password);
  const fallback = defaultPasswordForUser(user);
  return Boolean(fallback) && fallback === password;
}

function defaultPasswordForUser(user: User) {
  if (user.email.endsWith('@mitra.wahyubeef.local')) return 'mitrawahyubeef';
  return demoPasswords[user.email];
}

function normalizeIdentifier(value: string) {
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : normalizePhone(trimmed);
}

function normalizePhone(value?: string) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  return digits;
}

export function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
