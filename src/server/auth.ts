import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppState } from '../seed';
import { demoPasswords } from '../seed';
import type { Role, User } from '../domain';

const SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me';
const sessions = new Map<string, string>();

export function login(state: AppState, identifier: string, password: string) {
  const user = state.users.find((item) => item.email === identifier || item.phone === identifier);
  if (!user || demoPasswords[user.email] !== password) throw httpError(401, 'Kredensial tidak valid');
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

export function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
