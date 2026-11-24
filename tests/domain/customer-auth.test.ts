import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerError, ServerCustomerStore, type CustomerIdentity } from '../../server/customerStore';
import { createCustomerRouter, CUSTOMER_COOKIE } from '../../server/customerRoutes';
import { createCustomerErpRouter } from '../../server/customerErpRoutes';
import type { CustomerIdentityService, CustomerIdentityState } from '../../server/customerAuth';
import type { CustomerPortalStatus } from '../../src/types/customerPortal';
import { ServerRbacStore } from '../../server/rbacStore';
import { createRbacMiddleware } from '../../server/rbacMiddleware';

const profile = { nama: 'Customer Uji', telepon: '', perusahaan: 'Instansi Uji' };
const identity: CustomerIdentity = { uid: 'customer-test', email: 'customer@example.invalid', emailVerified: true, authTime: Date.now() };
const otherIdentity: CustomerIdentity = { ...identity, uid: 'other-test', email: 'other@example.invalid' };
let dir: string;
let server: Server | undefined;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-customer-auth-')); });
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; }
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('customer store: durability and session lifecycle', () => {
  it('keeps hashed sessions across restart without storing password or token in audit', () => {
    const store = new ServerCustomerStore(dir);
    const account = store.register(identity, profile, 'privacy-v1');
    const session = store.login(identity);
    const loaded = new ServerCustomerStore(dir);
    expect(loaded.resolve(session.token)?.account.id).toBe(account.id);
    const disk = fs.readFileSync(path.join(dir, 'customer-portal-db.json'), 'utf8');
    const audit = fs.readFileSync(path.join(dir, 'customer-portal-audit.jsonl'), 'utf8');
    expect(disk).not.toContain(session.token);
    expect(audit).not.toContain(session.token);
    expect(audit).not.toContain(identity.email);
    expect(audit).not.toContain(profile.nama);
    expect(audit).toContain('"phase":"committed"');
    expect(session.account).not.toHaveProperty('firebaseUid');
    expect(session.account.status).toBe('menunggu-verifikasi');
    store.logout(session.token);
    expect(new ServerCustomerStore(dir).resolve(session.token)).toBeNull();
  });

  it('rejects unverified identities and never creates a profile implicitly on login', () => {
    const store = new ServerCustomerStore(dir);
    expect(() => store.login(identity)).toThrow('Lengkapi pendaftaran');
    store.register({ ...identity, emailVerified: false }, profile, 'v1');
    expect(() => store.login({ ...identity, emailVerified: false })).toThrow('Verifikasi email');
    expect(() => store.linkCustomerToB2B(store.listCustomersForStaff()[0].id, 'b2b-active', 'dev.test')).toThrow('Verifikasi email');
    expect(store.login(identity).account.status).toBe('menunggu-verifikasi');
  });

  it('rejects a suspended account and its previously issued sessions after restart', () => {
    const store = new ServerCustomerStore(dir);
    store.register(identity, profile, 'v1');
    const session = store.login(identity);
    const file = path.join(dir, 'customer-portal-db.json');
    const database = JSON.parse(fs.readFileSync(file, 'utf8'));
    database.customers[0].status = 'ditangguhkan';
    fs.writeFileSync(file, JSON.stringify(database));
    const loaded = new ServerCustomerStore(dir);
    expect(loaded.resolve(session.token)).toBeNull();
    expect(() => loaded.login(identity)).toThrow('Akun tidak dapat digunakan');
  });

  it('preserves file and in-memory state on write failure and permits safe registration retry', () => {
    const store = new ServerCustomerStore(dir);
    const account = store.register(identity, profile, 'v1');
    const session = store.login(identity);
    const file = path.join(dir, 'customer-portal-db.json');
    const before = fs.readFileSync(file, 'utf8');
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk failure'); });
    expect(() => store.updateProfile(account.id, { ...profile, nama: 'Changed' })).toThrow('disk failure');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(store.resolve(session.token)?.account.nama).toBe(profile.nama);
    expect(store.register(identity, profile, 'v1').id).toBe(account.id);
    expect(fs.readdirSync(dir).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it.each(['{bad', 'null', '{"version":2,"revision":0,"customers":[],"sessions":[]}'])('fails closed for corrupt or unsupported storage: %s', (content) => {
    const file = path.join(dir, 'customer-portal-db.json');
    fs.writeFileSync(file, content);
    expect(() => new ServerCustomerStore(dir)).toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe(content);
  });

  it('enforces idle, absolute and per-customer session limits without evicting other customers', () => {
    let now = Date.now();
    const store = new ServerCustomerStore(dir, () => now);
    store.register(identity, profile, 'v1');
    store.register(otherIdentity, profile, 'v1');
    const other = store.login(otherIdentity);
    const first = store.login(identity);
    for (let i = 0; i < 10; i++) { now += 1; store.login(identity); }
    expect(store.resolve(first.token)).toBeNull();
    expect(store.resolve(other.token)).not.toBeNull();
    const active = store.login(identity);
    for (let i = 0; i < 7; i++) {
      now += 86400000 - 1;
      const current = store.resolve(active.token);
      expect(current).not.toBeNull();
      store.touch(current!.session.hash);
    }
    now += 10;
    expect(store.resolve(active.token)).toBeNull();
    const idle = store.login(identity);
    now += 86400000;
    expect(store.resolve(idle.token)).toBeNull();
  });

  it('migrates version 1 safely and persists isolated cart and address data', () => {
    const store = new ServerCustomerStore(dir);
    const account = store.register(identity, profile, 'v1');
    const file = path.join(dir, 'customer-portal-db.json');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    disk.version = 1;
    delete disk.carts;
    delete disk.addresses;
    fs.writeFileSync(file, JSON.stringify(disk));
    const migrated = new ServerCustomerStore(dir);
    const session = migrated.login(identity);
    expect(migrated.resolve(session.token)?.account.id).toBe(account.id);
    const cart = migrated.updateCart(account.id, [{ produkId: 'produk-1', varianId: 'varian-1', jumlah: 2 }]);
    expect(cart.items[0].jumlah).toBe(2);
    const addresses = migrated.saveAddress(account.id, {
      label: 'Klinik', penerima: 'Customer Uji', telepon: '081234567890',
      alamat: 'Jl. Uji 1', kota: 'Jakarta', provinsi: 'DKI Jakarta', kodePos: '10110', isUtama: true
    });
    expect(addresses[0].isUtama).toBe(true);
    const restarted = new ServerCustomerStore(dir);
    expect(restarted.getCart(account.id).items).toHaveLength(1);
    expect(restarted.getAddresses(account.id)).toHaveLength(1);
  });
});

describe('customer HTTP authentication: isolated identity service, real disk and cookies', () => {
  let store: ServerCustomerStore;
  let base: string;
  let enabled: boolean;
  let available: boolean;
  let privacyReady: boolean;
  let current: CustomerIdentityState;
  let service: CustomerIdentityService;
  let employeeToken: string;
  let salesRepToken: string;
  let rbac: ServerRbacStore;
  let catalogPublished: boolean;

  beforeEach(async () => {
    enabled = true;
    available = true;
    privacyReady = true;
    catalogPublished = true;
    current = { email: identity.email, emailVerified: true, disabled: false, validAfter: 0 };
    store = new ServerCustomerStore(dir);
    service = {
      available: () => available,
      verify: vi.fn(async (token: string) => {
        if (token === 'valid') return { ...identity, emailVerified: current.emailVerified };
        if (token === 'other') return otherIdentity;
        throw new CustomerError(401, 'INVALID_IDENTITY', 'Invalid test identity');
      }),
      read: vi.fn(async (uid: string) => {
        if (!available) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Unavailable');
        return uid === otherIdentity.uid ? { ...current, email: otherIdentity.email } : current;
      }),
      revoke: vi.fn(async () => { current.validAfter = Date.now() + 1000; })
    };
    rbac = new ServerRbacStore(dir);
    const developer = rbac.bootstrapFirstDeveloper({ username: 'dev.test', password: 'TestPassword123!', fullName: 'Test Developer' }, '127.0.0.1', 'Vitest');
    if (!developer.ok) throw new Error(developer.message);
    const login = rbac.authenticate('dev.test', 'TestPassword123!', '127.0.0.1', 'Vitest');
    if (!login.ok) throw new Error(login.message);
    employeeToken = login.token;
    const salesRole = rbac.listRoles().find((role) => role.id === 'sales_medrep');
    if (!salesRole) throw new Error('Sales role missing');
    const restrictedRole = rbac.updateRole('sales_medrep', {
      permissions: { ...salesRole.permissions, 'sales-marketing': ['view'] }
    }, 'dev.test', developer.role.id, '127.0.0.1');
    if (!restrictedRole.ok) throw new Error(restrictedRole.message);
    const salesRep = rbac.createUser({
      username: 'sales.test', password: 'SalesPassword123!', fullName: 'Sales Rep',
      roleId: 'sales_medrep', employeeId: 'EMP-TEST'
    }, 'dev.test', developer.role.id, '127.0.0.1');
    if (!salesRep.ok) throw new Error(salesRep.message);
    const salesLogin = rbac.authenticate('sales.test', 'SalesPassword123!', '127.0.0.1', 'Vitest');
    if (!salesLogin.ok) throw new Error(salesLogin.message);
    salesRepToken = salesLogin.token;
    const { attachAuth, requireAuth } = createRbacMiddleware(rbac);
    const app = express();
    app.use(attachAuth);
    app.use('/api/customer', createCustomerRouter({
      store, identity: service,
      status: (): CustomerPortalStatus => ({
        enabled, authAvailable: available, registrationAvailable: privacyReady && available,
        privacyUrl: '/privacy', termsUrl: '/terms', privacyVersion: 'v1', firebase: null
      }),
      catalog: () => ({
        isPublished: catalogPublished,
        produk: { item: [{
          id: 'produk-1', isActive: true, nama: 'Alat Uji', tipeModel: 'AU-1',
          kategori: 'Laboratorium', produsen: 'Merek Uji', spesifikasi: 'Spesifikasi uji',
          nomorIzinEdar: 'AKL-1', statusIzinEdar: 'Aktif', satuan: 'unit',
          imageUrl: 'media:image-1',
          varianSku: [{ id: 'varian-1', kodeSKU: 'SKU-1', tipeModel: 'AU-1', nomorIzinEdar: 'AKL-1', satuan: 'unit' }]
        }] }
      })
    }));
    app.use('/api/erp/portal', createCustomerErpRouter({
      store,
      requireView: createRbacMiddleware(rbac).requirePermission('sales-marketing', 'view'),
      requireUpdate: createRbacMiddleware(rbac).requirePermission('sales-marketing', 'update'),
      findB2BCustomers: (id) => id === 'b2b-active'
        ? [{ id, nama: 'Fasyankes Uji', status: 'Aktif' }]
        : id === 'b2b-inactive'
          ? [{ id, nama: 'Fasyankes Nonaktif', status: 'Non-aktif' }]
          : []
    }));
    for (const endpoint of ['/api/sync/state', '/api/rbac/users', '/api/media']) app.get(endpoint, requireAuth, (_req, res) => res.json({ ok: true }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test address');
    base = `http://127.0.0.1:${address.port}`;
  });

  async function request(endpoint: string, body?: unknown, cookie = '', extraHeaders: Record<string, string> = {}, method?: string) {
    const response = await fetch(`${base}${endpoint}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie'), cache: response.headers.get('cache-control') };
  }
  async function register(token = 'valid') {
    return request('/api/customer/auth/daftar', { ...profile, idToken: token, privacyAccepted: true, privacyVersion: 'v1' });
  }
  async function login(token = 'valid') {
    await register(token);
    const result = await request('/api/customer/auth/sesi', { idToken: token });
    expect(result.status).toBe(200);
    return result.cookie!.split(';')[0];
  }

  it('registers and logs in a verified customer without exposing a bearer token', async () => {
    expect((await register()).status).toBe(201);
    const result = await request('/api/customer/auth/sesi', { idToken: 'valid' });
    expect(result.status).toBe(200);
    expect(result.body).not.toHaveProperty('token');
    expect(result.cookie).toContain(CUSTOMER_COOKIE);
    expect(result.cookie).toContain('HttpOnly');
    expect(result.cookie).toContain('SameSite=Lax');
    expect(result.cookie).toContain('Path=/api/customer');
    const me = await request('/api/customer/auth/saya', undefined, result.cookie!.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body.account.email).toBe(identity.email);
    expect(me.cache).toBe('no-store');
  });

  it('rejects cross-origin login CSRF, oversized input, missing consent and role escalation', async () => {
    expect((await request('/api/customer/auth/sesi', { idToken: 'valid' }, '', { Origin: 'https://other.invalid' })).status).toBe(403);
    expect((await request('/api/customer/auth/daftar', { ...profile, idToken: 'valid' })).status).toBe(400);
    expect((await request('/api/customer/auth/daftar', { ...profile, idToken: 'valid', role: 'it_admin' })).status).toBe(400);
    expect((await request('/api/customer/auth/sesi', { idToken: 'x'.repeat(40000) })).status).toBe(413);
    const cookie = await login();
    const denied = await request('/api/customer/profil', { ...profile, status: 'aktif', customerId: 'other' }, cookie, {}, 'PATCH');
    expect(denied.status).toBe(400);
  });

  it('requires email verification and configured policies; blocks disabled portal without deleting data', async () => {
    current.emailVerified = false;
    expect((await register()).status).toBe(201);
    expect((await request('/api/customer/auth/sesi', { idToken: 'valid' })).body.error).toBe('EMAIL_UNVERIFIED');
    current.emailVerified = true;
    const cookie = await login();
    const before = fs.readFileSync(path.join(dir, 'customer-portal-db.json'), 'utf8');
    enabled = false;
    expect((await request('/api/customer/auth/saya', undefined, cookie)).status).toBe(404);
    expect(fs.readFileSync(path.join(dir, 'customer-portal-db.json'), 'utf8')).toBe(before);
    enabled = true;
    privacyReady = false;
    expect((await register()).body.error).toBe('REGISTRATION_UNAVAILABLE');
  });

  it('does not accept employee sessions as customer sessions or customer sessions as employee sessions', async () => {
    const customerCookie = await login();
    const employeeCookie = `ams_session=${salesRepToken}`;
    expect((await request('/api/customer/auth/saya', undefined, employeeCookie)).status).toBe(401);
    expect((await request('/api/customer/auth/saya', undefined, '', { Authorization: `Bearer ${salesRepToken}` })).status).toBe(401);
    const itSupport = rbac.createUser({
      username: 'it.test', password: 'ItSupportPass123!', fullName: 'IT Support',
      roleId: 'developer_it_support', employeeId: 'EMP-IT'
    }, 'dev.test', 'developer_it_support', '127.0.0.1');
    if (!itSupport.ok) throw new Error(itSupport.message);
    const itLogin = rbac.authenticate('it.test', 'ItSupportPass123!', '127.0.0.1', 'Vitest');
    if (!itLogin.ok) throw new Error(itLogin.message);
    expect((await request('/api/customer/auth/saya', undefined, `ams_session=${itLogin.token}`)).status).toBe(401);
    for (const endpoint of ['/api/sync/state', '/api/rbac/users', '/api/media']) {
      expect((await request(endpoint, undefined, customerCookie)).status).toBe(401);
      expect((await request(endpoint, undefined, employeeCookie)).status).toBe(200);
    }
  });

  it('gives a developer ERP session an isolated portal workspace that staff cannot link', async () => {
    const developerCookie = `ams_session=${employeeToken}`;
    const me = await request('/api/customer/auth/saya', undefined, developerCookie);
    expect(me.status).toBe(200);
    expect(me.body.account).toMatchObject({ aksesDeveloper: true, nama: 'Test Developer' });
    expect(me.body.account).not.toHaveProperty('developerUserId');
    expect(service.read).not.toHaveBeenCalled();
    expect((await request('/api/customer/auth/saya', undefined, developerCookie)).body.account.id).toBe(me.body.account.id);

    const cart = await request('/api/customer/keranjang', { items: [{ produkId: 'produk-1', varianId: 'varian-1', jumlah: 2 }] }, developerCookie, {}, 'PUT');
    expect(cart.status).toBe(200);
    expect((await request('/api/customer/keranjang', { items: [] }, developerCookie, { Origin: 'https://other.invalid' }, 'PUT')).status).toBe(403);
    expect((await request('/api/customer/auth/keluar-semua', {}, developerCookie)).body.error).toBe('DEVELOPER_SESSION');

    const customerCookie = await login();
    expect((await request('/api/customer/keranjang', undefined, customerCookie)).body.cart.items).toEqual([]);
    expect((await request('/api/customer/auth/saya', undefined, `${customerCookie}; ${developerCookie}`)).body.account.email).toBe(identity.email);

    const staff = await request('/api/erp/portal/customers', undefined, developerCookie);
    expect(staff.body.items.map((item: { email: string }) => item.email)).toEqual([identity.email]);
    expect((await request(`/api/erp/portal/customers/${me.body.account.id}/tautkan`, { pelangganId: 'b2b-active' }, developerCookie)).status).toBe(404);

    const reloaded = new ServerCustomerStore(dir);
    expect(reloaded.getCart(me.body.account.id).items).toHaveLength(1);
  });

  it('keeps profiles scoped to the session and persists changes after restart', async () => {
    const first = await login();
    const second = await login('other');
    const saved = await request('/api/customer/profil', { ...profile, nama: 'Updated' }, first, {}, 'PATCH');
    expect(saved.status).toBe(200);
    expect((await request('/api/customer/profil', undefined, second)).body.account.nama).toBe(profile.nama);
    const firstToken = first.slice(CUSTOMER_COOKIE.length + 1);
    expect(new ServerCustomerStore(dir).resolve(firstToken)?.account.nama).toBe('Updated');
  });

  it('serves published catalog and keeps cart and addresses isolated between customers', async () => {
    const first = await login();
    const second = await login('other');
    const catalog = await request('/api/customer/katalog', undefined, first);
    expect(catalog.status).toBe(200);
    expect(catalog.body.items[0].nama).toBe('Alat Uji');
    expect(catalog.body.items[0].imageUrls).toContain('/api/website/media/image-1');
    expect(catalog.body.items[0]).not.toHaveProperty('firebaseUid');
    expect((await request('/api/customer/katalog?q=SKU-1', undefined, first)).body.items).toHaveLength(1);
    expect((await request('/api/customer/katalog/produk-1', undefined, first)).body.item.nama).toBe('Alat Uji');
    const cart = await request('/api/customer/keranjang', {
      items: [{ produkId: 'produk-1', varianId: 'varian-1', jumlah: 2 }]
    }, first, {}, 'PUT');
    expect(cart.status).toBe(200);
    expect(cart.body.cart.items[0].jumlah).toBe(2);
    expect((await request('/api/customer/keranjang', undefined, second)).body.cart.items).toHaveLength(0);
    const address = await request('/api/customer/alamat', {
      label: 'Klinik', penerima: 'Customer Uji', telepon: '081234567890',
      alamat: 'Jl. Uji 1', kota: 'Jakarta', provinsi: 'DKI Jakarta', kodePos: '10110', isUtama: true
    }, first);
    expect(address.status).toBe(201);
    expect(address.body.items).toHaveLength(1);
    expect((await request('/api/customer/alamat', undefined, second)).body.items).toHaveLength(0);
    const addressId = address.body.items[0].id;
    const changed = await request(`/api/customer/alamat/${addressId}`, {
      label: 'Kantor pusat', penerima: 'Customer Uji', telepon: '081234567890',
      alamat: 'Jl. Uji 2', kota: 'Jakarta', provinsi: 'DKI Jakarta', kodePos: '10110', isUtama: true
    }, first, {}, 'PATCH');
    expect(changed.body.items[0].label).toBe('Kantor pusat');
    expect((await request(`/api/customer/alamat/${addressId}`, {
      label: 'Tidak boleh', penerima: 'Customer Uji', telepon: '081234567890',
      alamat: 'Jl. Uji 3', kota: 'Jakarta', provinsi: 'DKI Jakarta', kodePos: '10110', isUtama: true
    }, second, {}, 'PATCH')).status).toBe(404);
  });

  it('only serves published catalog products and rejects items after they are unpublished', async () => {
    const cookie = await login();
    catalogPublished = false;
    expect((await request('/api/customer/katalog', undefined, cookie)).body.items).toEqual([]);
    expect((await request('/api/customer/katalog/produk-1', undefined, cookie)).status).toBe(404);
  });

  it('requires employee RBAC and same-origin staff action to link and suspend customer accounts', async () => {
    const first = await login();
    const second = await login('other');
    const employeeCookie = `ams_session=${employeeToken}`;
    const list = await request('/api/erp/portal/customers', undefined, employeeCookie);
    expect(list.status).toBe(200);
    expect(list.body.items[0]).not.toHaveProperty('firebaseUid');
    expect(list.body.items[0]).not.toHaveProperty('privacyVersion');
    expect((await request('/api/erp/portal/customers', undefined, first)).status).toBe(401);
    expect((await request('/api/erp/portal/customers/customer-id/tautkan', { pelangganId: 'b2b-active' }, employeeCookie, { Origin: 'https://other.invalid' })).status).toBe(403);
    expect((await request('/api/erp/portal/customers/customer-id/tautkan', { pelangganId: 'b2b-inactive' }, employeeCookie)).status).toBe(409);
    expect((await request('/api/erp/portal/customers/customer-id/tautkan', { pelangganId: 'x'.repeat(17000) }, employeeCookie)).status).toBe(413);

    const customerId = list.body.items.find((item: { email: string }) => item.email === identity.email).id;
    expect((await request(`/api/erp/portal/customers/${customerId}/tautkan`, { pelangganId: 'b2b-active' }, `ams_session=${salesRepToken}`)).status).toBe(403);
    const linked = await request(`/api/erp/portal/customers/${customerId}/tautkan`, { pelangganId: 'b2b-active' }, employeeCookie);
    expect(linked.status).toBe(200);
    expect(linked.body.customer).toMatchObject({ status: 'aktif', pelangganId: 'b2b-active' });
    expect((await request('/api/customer/auth/saya', undefined, first)).body.account).not.toHaveProperty('pelangganId');

    const secondId = list.body.items.find((item: { email: string }) => item.email === otherIdentity.email).id;
    expect((await request(`/api/erp/portal/customers/${secondId}/tautkan`, { pelangganId: 'b2b-active' }, employeeCookie)).status).toBe(409);
    const suspended = await request(`/api/erp/portal/customers/${customerId}/tangguhkan`, {}, employeeCookie);
    expect(suspended.body.customer.status).toBe('ditangguhkan');
    expect((await request('/api/customer/auth/saya', undefined, first)).status).toBe(401);
    expect((await request('/api/customer/auth/saya', undefined, second)).status).toBe(200);
    const audit = fs.readFileSync(path.join(dir, 'customer-portal-audit.jsonl'), 'utf8');
    expect(audit).toContain('"action":"CUSTOMER_LINKED_TO_B2B"');
    expect(audit).toContain('"actor":"dev.test"');
    expect(audit).toContain('"action":"CUSTOMER_SUSPENDED"');
  });

  it.each(['disabled', 'password-reset', 'email-changed', 'email-unverified'])('revokes sessions when Firebase reports %s', async (change) => {
    const cookie = await login();
    if (change === 'disabled') current.disabled = true;
    if (change === 'password-reset') current.validAfter = identity.authTime + 1000;
    if (change === 'email-changed') current.email = 'changed@example.invalid';
    if (change === 'email-unverified') current.emailVerified = false;
    expect((await request('/api/customer/auth/saya', undefined, cookie)).status).toBe(401);
    expect(new ServerCustomerStore(dir).resolve(cookie.slice(CUSTOMER_COOKIE.length + 1))).toBeNull();
  });

  it('fails closed on Firebase outage but still permits local logout', async () => {
    const cookie = await login();
    available = false;
    expect((await request('/api/customer/auth/saya', undefined, cookie)).status).toBe(503);
    const result = await request('/api/customer/auth/keluar', {}, cookie);
    expect(result.status).toBe(200);
    expect(result.cookie).toContain('Max-Age=0');
    available = true;
    expect((await request('/api/customer/auth/saya', undefined, cookie)).status).toBe(401);
  });

  it('does not resurrect a session revoked while the Firebase check is pending', async () => {
    const cookie = await login();
    let release!: (value: CustomerIdentityState) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    vi.mocked(service.read).mockImplementationOnce(() => {
      entered();
      return new Promise<CustomerIdentityState>((resolve) => { release = resolve; });
    });
    const pending = request('/api/customer/auth/saya', undefined, cookie);
    await started;
    expect((await request('/api/customer/auth/keluar', {}, cookie)).status).toBe(200);
    release(current);
    expect((await pending).status).toBe(401);
  });

  it('revokes all sessions only for the current customer', async () => {
    const first = await login();
    const sameUser = await login();
    const other = await login('other');
    expect((await request('/api/customer/auth/keluar-semua', {}, first)).status).toBe(200);
    expect(service.revoke).toHaveBeenCalledWith(identity.uid);
    expect((await request('/api/customer/auth/saya', undefined, sameUser)).status).toBe(401);
    current.validAfter = 0;
    expect((await request('/api/customer/auth/saya', undefined, other)).status).toBe(200);
  });

  it('limits registration and session exchange attempts', async () => {
    for (let i = 0; i < 5; i++) expect((await register()).status).toBe(201);
    expect((await register()).status).toBe(429);
    for (let i = 0; i < 20; i++) expect((await request('/api/customer/auth/sesi', { idToken: 'bad' })).status).toBe(401);
    expect((await request('/api/customer/auth/sesi', { idToken: 'bad' })).status).toBe(429);
  });
});
