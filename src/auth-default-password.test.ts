import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from './seed.ts';
import { login } from './server/auth.ts';

test('approved partner user without passwordHash can login with mitra default password by phone', () => {
  const state = createSeedState();
  state.users.push({
    id: 'u-live-approved-partner',
    name: 'Mitra Baru Approved',
    email: 'mitra.baru@example.com',
    phone: '6281234567890',
    role: 'partner',
    status: 'active',
  });
  state.partners.push({
    id: 'p-live-approved-partner',
    userId: 'u-live-approved-partner',
    tierId: state.tiers[0].id,
    partnerCode: 'MITRA-NEW-001',
    businessName: 'Mitra Baru',
    contactPerson: 'Mitra Baru Approved',
    phone: '6281234567890',
    email: 'mitra.baru@example.com',
    address: 'Alamat Mitra Baru',
    city: 'Tuban',
    province: 'Jawa Timur',
    creditLimit: 0,
    paymentTermDays: 0,
    status: 'active',
  });

  const session = login(state, '081234567890', 'mitrawahyubeef');
  assert.equal(session.user.id, 'u-live-approved-partner');
});


test('approved partner user with legacy passwordHash can still login with mitra default password by phone', () => {
  const state = createSeedState();
  state.users.push({
    id: 'u-live-approved-partner-legacy-hash',
    name: 'Mitra Legacy Hash',
    email: 'mitra.legacy@example.com',
    phone: '6281234567891',
    role: 'partner',
    status: 'active',
    passwordHash: 'legacy-or-invalid-hash',
  });
  state.partners.push({
    id: 'p-live-approved-partner-legacy-hash',
    userId: 'u-live-approved-partner-legacy-hash',
    tierId: state.tiers[0].id,
    partnerCode: 'MITRA-NEW-002',
    businessName: 'Mitra Legacy Hash',
    contactPerson: 'Mitra Legacy Hash',
    phone: '6281234567891',
    email: 'mitra.legacy@example.com',
    address: 'Alamat Mitra Legacy',
    city: 'Tuban',
    province: 'Jawa Timur',
    creditLimit: 0,
    paymentTermDays: 0,
    status: 'active',
  });

  const session = login(state, '081234567891', 'mitrawahyubeef');
  assert.equal(session.user.id, 'u-live-approved-partner-legacy-hash');
});
