import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFileIfPresent } from './readJsonFile';
import {
  customerProfileError,
  type CustomerAccount,
  type CustomerAddress,
  type CustomerCart,
  type CustomerCartItem,
  type CustomerProfileInput
} from '../src/types/customerPortal';

export class CustomerError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface CustomerIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  authTime: number;
}

interface CustomerRecord extends CustomerAccount {
  firebaseUid: string;
  pelangganId?: string;
  /** RBAC user id of a developer workspace; such records never authenticate through Firebase. */
  developerUserId?: string;
  privacyVersion: string;
  privacyAcceptedAt: string;
}

export interface CustomerStaffSummary {
  id: string;
  email: string;
  nama: string;
  telepon: string;
  perusahaan: string;
  status: CustomerAccount['status'];
  pelangganId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  hash: string;
  customerId: string;
  email: string;
  authTime: number;
  issuedAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

interface CustomerDatabase {
  version: 2;
  revision: number;
  customers: CustomerRecord[];
  sessions: CustomerSession[];
  carts: Array<{ customerId: string; cart: CustomerCart }>;
  addresses: Array<{ customerId: string; items: CustomerAddress[] }>;
}

const DAY = 86400000;
const DEVELOPER_UID_PREFIX = 'rbac-developer:';
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const dateString = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const validEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function validDatabase(value: unknown): value is CustomerDatabase {
  if (!record(value) || value.version !== 2 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 ||
      !Array.isArray(value.customers) || !Array.isArray(value.sessions) ||
      !Array.isArray(value.carts) || !Array.isArray(value.addresses)) return false;
  const ids = new Set<string>();
  const uids = new Set<string>();
  const emails = new Set<string>();
  const developers = new Set<string>();
  for (const c of value.customers) {
    if (record(c) && c.developerUserId !== undefined) {
      if (typeof c.developerUserId !== 'string' || !c.developerUserId || developers.has(c.developerUserId) ||
          c.firebaseUid !== `${DEVELOPER_UID_PREFIX}${c.developerUserId}` || c.aksesDeveloper !== true || c.pelangganId !== undefined) return false;
      developers.add(c.developerUserId);
    } else if (record(c) && (c.aksesDeveloper !== undefined || String(c.firebaseUid).startsWith(DEVELOPER_UID_PREFIX))) return false;
    if (!record(c) || customerProfileError(c) || typeof c.id !== 'string' || !c.id ||
        typeof c.firebaseUid !== 'string' || !c.firebaseUid || !validEmail(c.email) ||
        c.email !== c.email.toLowerCase() || c.teleponTerverifikasi !== false ||
        (c.pelangganId !== undefined && (typeof c.pelangganId !== 'string' || !c.pelangganId)) ||
        !['menunggu-email', 'menunggu-verifikasi', 'aktif', 'ditangguhkan'].includes(String(c.status)) ||
        typeof c.privacyVersion !== 'string' || !c.privacyVersion ||
        !dateString(c.privacyAcceptedAt) || !dateString(c.createdAt) || !dateString(c.updatedAt) ||
        ids.has(c.id) || uids.has(c.firebaseUid) || emails.has(c.email)) return false;
    ids.add(c.id);
    uids.add(c.firebaseUid);
    emails.add(c.email);
  }
  const hashes = new Set<string>();
  const sessionsValid = value.sessions.every((s: unknown) => {
    if (!record(s) || typeof s.hash !== 'string' || !/^[a-f0-9]{64}$/.test(s.hash) || hashes.has(s.hash) ||
        typeof s.customerId !== 'string' || !ids.has(s.customerId) || !validEmail(s.email) ||
        ![s.authTime, s.issuedAt, s.lastSeenAt, s.expiresAt].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) ||
        Number(s.lastSeenAt) < Number(s.issuedAt) || Number(s.expiresAt) > Number(s.issuedAt) + 7 * DAY ||
        Number(s.expiresAt) <= Number(s.issuedAt)) return false;
    hashes.add(s.hash);
    return true;
  });
  if (!sessionsValid) return false;
  const cartCustomerIds = new Set<string>();
  if (!value.carts.every((entry: unknown) => {
    if (!record(entry) || typeof entry.customerId !== 'string' || !ids.has(entry.customerId) || cartCustomerIds.has(entry.customerId)) return false;
    cartCustomerIds.add(entry.customerId);
    if (!record(entry.cart) || !Number.isSafeInteger(entry.cart.revision) || Number(entry.cart.revision) < 0 ||
        !dateString(entry.cart.updatedAt) || !Array.isArray(entry.cart.items) ||
        !entry.cart.items.every((item: unknown) => record(item) &&
          typeof item.produkId === 'string' && item.produkId.length <= 100 &&
          typeof item.varianId === 'string' && item.varianId.length <= 100 &&
          typeof item.jumlah === 'number' && Number.isSafeInteger(item.jumlah) && item.jumlah >= 1 && item.jumlah <= 1000000)) return false;
    return true;
  })) return false;
  const addressCustomerIds = new Set<string>();
  return value.addresses.every((entry: unknown) => {
    if (!record(entry) || typeof entry.customerId !== 'string' || !ids.has(entry.customerId) || addressCustomerIds.has(entry.customerId) ||
        !Array.isArray(entry.items)) return false;
    addressCustomerIds.add(entry.customerId);
    const addressIds = new Set<string>();
    return entry.items.every((address: unknown) => {
      if (!record(address) || typeof address.id !== 'string' || !address.id || addressIds.has(address.id) ||
          !['label', 'penerima', 'alamat', 'kota', 'provinsi', 'kodePos', 'telepon'].every((key) =>
            typeof address[key] === 'string' && String(address[key]).trim().length > 0) ||
          typeof address.isUtama !== 'boolean' || !dateString(address.updatedAt)) return false;
      addressIds.add(address.id);
      return true;
    });
  });
}

export class ServerCustomerStore {
  private data: CustomerDatabase;
  private readonly file: string;
  private readonly auditFile: string;

  constructor(dataDir: string, private readonly now = Date.now) {
    this.file = path.join(dataDir, 'customer-portal-db.json');
    this.auditFile = path.join(dataDir, 'customer-portal-audit.jsonl');
    const loaded = readJsonFileIfPresent(this.file, 'Database Customer Portal');
    if (loaded !== undefined && record(loaded) && loaded.version === 1 &&
        Array.isArray(loaded.customers) && Array.isArray(loaded.sessions)) {
      const migrated: CustomerDatabase = {
        version: 2,
        revision: Number.isSafeInteger(loaded.revision) && Number(loaded.revision) >= 0 ? Number(loaded.revision) : 0,
        customers: loaded.customers as CustomerRecord[],
        sessions: loaded.sessions as CustomerSession[],
        carts: [],
        addresses: []
      };
      if (!validDatabase(migrated)) {
        throw new Error('Struktur database Customer Portal versi 1 tidak didukung. Berkas tidak diubah; periksa backup.');
      }
      this.data = migrated;
    } else if (loaded !== undefined && !validDatabase(loaded)) {
      throw new Error('Struktur atau versi database Customer Portal tidak didukung. Berkas tidak diubah; periksa backup.');
    } else {
      this.data = loaded === undefined
        ? { version: 2, revision: 0, customers: [], sessions: [], carts: [], addresses: [] }
        : loaded;
    }
  }

  private save(next: CustomerDatabase, action?: string, customerId?: string, actor?: string) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const event = { id: crypto.randomUUID(), at: new Date(this.now()).toISOString(), action, customerId, actor, revision: this.data.revision + 1 };
    const audit = (phase: string) => fs.appendFileSync(this.auditFile, JSON.stringify({ ...event, phase }) + '\n', { mode: 0o600 });
    if (action) audit('attempt');
    next.revision = this.data.revision + 1;
    const temp = `${this.file}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temp, this.file);
    } catch (error) {
      try { fs.unlinkSync(temp); } catch (cleanupError) {
        if (!record(cleanupError) || cleanupError.code !== 'ENOENT') console.error('[customer-store] Gagal membersihkan berkas sementara.', cleanupError);
      }
      throw error;
    }
    this.data = next;
    // An absent committed event means an operation needs reconciliation, not success.
    if (action) audit('committed');
  }

  private publicAccount(customer: CustomerRecord): CustomerAccount {
    const { firebaseUid: _uid, pelangganId: _pelangganId, developerUserId: _developer, privacyVersion: _version, privacyAcceptedAt: _accepted, ...account } = customer;
    return structuredClone(account);
  }

  /** Returns (creating once) the isolated workspace of an ERP developer. */
  developerWorkspace(user: { id: string; username: string; fullName?: string }): CustomerAccount {
    if (!user.id) throw new CustomerError(403, 'DEVELOPER_REQUIRED', 'Akses developer tidak valid.');
    const existing = this.data.customers.find((c) => c.developerUserId === user.id);
    if (existing) {
      if (existing.status === 'ditangguhkan') throw new CustomerError(403, 'ACCOUNT_UNAVAILABLE', 'Ruang kerja developer dinonaktifkan.');
      return this.publicAccount(existing);
    }
    const now = new Date(this.now()).toISOString();
    const suffix = crypto.createHash('sha256').update(user.id).digest('hex').slice(0, 16);
    const customer: CustomerRecord = {
      id: crypto.randomUUID(), firebaseUid: `${DEVELOPER_UID_PREFIX}${user.id}`, developerUserId: user.id, aksesDeveloper: true,
      email: `developer-${suffix}@akses-developer.invalid`,
      nama: (user.fullName?.trim() || user.username).slice(0, 120), telepon: '', perusahaan: 'Akses Developer',
      teleponTerverifikasi: false, status: 'menunggu-verifikasi',
      privacyVersion: 'developer-access', privacyAcceptedAt: now, createdAt: now, updatedAt: now
    };
    const next = structuredClone(this.data);
    next.customers.push(customer);
    this.save(next, 'DEVELOPER_WORKSPACE_CREATED', customer.id, user.username);
    return this.publicAccount(customer);
  }

  listCustomersForStaff(): CustomerStaffSummary[] {
    return this.data.customers.filter((customer) => !customer.developerUserId).map((customer) => ({
      id: customer.id, email: customer.email, nama: customer.nama, telepon: customer.telepon,
      perusahaan: customer.perusahaan, status: customer.status, pelangganId: customer.pelangganId,
      createdAt: customer.createdAt, updatedAt: customer.updatedAt
    }));
  }

  getCustomerForStaff(customerId: string): CustomerStaffSummary | null {
    return this.listCustomersForStaff().find((customer) => customer.id === customerId) ?? null;
  }

  linkCustomerToB2B(customerId: string, pelangganId: string, actor: string): CustomerStaffSummary {
    const next = structuredClone(this.data);
    const customer = next.customers.find((entry) => entry.id === customerId && !entry.developerUserId);
    if (!customer) throw new CustomerError(404, 'NOT_FOUND', 'Akun customer tidak ditemukan.');
    if (customer.status === 'ditangguhkan') throw new CustomerError(409, 'ACCOUNT_SUSPENDED', 'Akun ditangguhkan; tinjau dan aktifkan melalui alur pemulihan staf.');
    if (customer.status === 'menunggu-email') throw new CustomerError(409, 'EMAIL_UNVERIFIED', 'Verifikasi email customer sebelum mengaktifkan akun.');
    const existing = next.customers.find((entry) => entry.id !== customerId && entry.pelangganId === pelangganId);
    if (existing) throw new CustomerError(409, 'B2B_ACCOUNT_LINKED', 'Pelanggan B2B tersebut sudah ditautkan ke akun lain.');
    customer.pelangganId = pelangganId;
    customer.status = 'aktif';
    customer.updatedAt = new Date(this.now()).toISOString();
    this.save(next, 'CUSTOMER_LINKED_TO_B2B', customerId, actor);
    return this.getCustomerForStaff(customerId)!;
  }

  suspendCustomer(customerId: string, actor: string): CustomerStaffSummary {
    const next = structuredClone(this.data);
    const customer = next.customers.find((entry) => entry.id === customerId && !entry.developerUserId);
    if (!customer) throw new CustomerError(404, 'NOT_FOUND', 'Akun customer tidak ditemukan.');
    if (customer.status === 'ditangguhkan') return this.getCustomerForStaff(customerId)!;
    customer.status = 'ditangguhkan';
    customer.updatedAt = new Date(this.now()).toISOString();
    next.sessions = next.sessions.filter((session) => session.customerId !== customerId);
    this.save(next, 'CUSTOMER_SUSPENDED', customerId, actor);
    return this.getCustomerForStaff(customerId)!;
  }

  register(identity: CustomerIdentity, input: CustomerProfileInput, privacyVersion: string): CustomerAccount {
    const error = customerProfileError(input);
    if (error) throw new CustomerError(400, 'INVALID_PROFILE', error);
    if (!validEmail(identity.email) || !identity.uid || identity.uid.startsWith(DEVELOPER_UID_PREFIX)) throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas customer tidak valid.');
    const existing = this.data.customers.find((c) => c.firebaseUid === identity.uid && !c.developerUserId);
    if (existing) {
      if (existing.status === 'ditangguhkan') throw new CustomerError(403, 'ACCOUNT_UNAVAILABLE', 'Akun tidak dapat digunakan. Hubungi tim kami.');
      return this.publicAccount(existing);
    }
    const email = identity.email.toLowerCase();
    if (this.data.customers.some((c) => c.email === email)) throw new CustomerError(409, 'ACCOUNT_EXISTS', 'Akun tidak dapat didaftarkan. Gunakan pemulihan akun.');
    const now = new Date(this.now()).toISOString();
    const customer: CustomerRecord = {
      id: crypto.randomUUID(), firebaseUid: identity.uid, email,
      nama: input.nama.trim(), telepon: input.telepon.trim(), perusahaan: input.perusahaan.trim(),
      teleponTerverifikasi: false, status: identity.emailVerified ? 'menunggu-verifikasi' : 'menunggu-email',
      privacyVersion, privacyAcceptedAt: now, createdAt: now, updatedAt: now
    };
    const next = structuredClone(this.data);
    next.customers.push(customer);
    this.save(next, 'REGISTER', customer.id);
    return this.publicAccount(customer);
  }

  login(identity: CustomerIdentity): { token: string; account: CustomerAccount; expiresAt: number } {
    if (!identity.emailVerified) throw new CustomerError(403, 'EMAIL_UNVERIFIED', 'Verifikasi email Anda sebelum masuk.');
    const next = structuredClone(this.data);
    const customer = next.customers.find((c) => c.firebaseUid === identity.uid && !c.developerUserId);
    if (!customer) throw new CustomerError(409, 'REGISTRATION_REQUIRED', 'Lengkapi pendaftaran customer terlebih dahulu.');
    if (customer.status === 'ditangguhkan') throw new CustomerError(403, 'ACCOUNT_UNAVAILABLE', 'Akun tidak dapat digunakan. Hubungi tim kami.');
    const email = identity.email.toLowerCase();
    if (next.customers.some((c) => c.id !== customer.id && c.email === email)) throw new CustomerError(409, 'ACCOUNT_EXISTS', 'Perubahan email perlu ditinjau tim kami.');
    if (customer.email !== email) next.sessions = next.sessions.filter((s) => s.customerId !== customer.id);
    customer.email = email;
    if (customer.status === 'menunggu-email') customer.status = 'menunggu-verifikasi';
    const now = this.now();
    customer.updatedAt = new Date(now).toISOString();
    next.sessions = next.sessions.filter((s) => s.expiresAt > now && s.lastSeenAt + DAY > now);
    const sessions = next.sessions.filter((s) => s.customerId === customer.id).sort((a, b) => a.issuedAt - b.issuedAt);
    const remove = new Set(sessions.slice(0, Math.max(0, sessions.length - 9)).map((s) => s.hash));
    next.sessions = next.sessions.filter((s) => !remove.has(s.hash));
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now + 7 * DAY;
    next.sessions.push({ hash: tokenHash(token), customerId: customer.id, email, authTime: identity.authTime, issuedAt: now, lastSeenAt: now, expiresAt });
    this.save(next, 'LOGIN', customer.id);
    return { token, account: this.publicAccount(customer), expiresAt };
  }

  resolve(token: string): { session: CustomerSession; account: CustomerAccount; uid: string } | null {
    if (!/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const session = this.data.sessions.find((s) => s.hash === tokenHash(token));
    const customer = session && this.data.customers.find((c) => c.id === session.customerId);
    const now = this.now();
    if (!session || !customer || customer.status === 'ditangguhkan' || customer.status === 'menunggu-email' ||
        session.expiresAt <= now || session.lastSeenAt + DAY <= now || session.email !== customer.email) return null;
    return { session: structuredClone(session), account: this.publicAccount(customer), uid: customer.firebaseUid };
  }

  touch(hash: string) {
    const session = this.data.sessions.find((s) => s.hash === hash);
    if (!session || this.now() - session.lastSeenAt < 60000) return;
    const next = structuredClone(this.data);
    next.sessions.find((s) => s.hash === hash)!.lastSeenAt = this.now();
    this.save(next);
  }

  logout(token: string) {
    const hash = tokenHash(token);
    const session = this.data.sessions.find((s) => s.hash === hash);
    if (!session) return;
    const next = structuredClone(this.data);
    next.sessions = next.sessions.filter((s) => s.hash !== hash);
    this.save(next, 'LOGOUT', session.customerId);
  }

  revokeAll(customerId: string) {
    const next = structuredClone(this.data);
    next.sessions = next.sessions.filter((s) => s.customerId !== customerId);
    this.save(next, 'REVOKE_SESSIONS', customerId);
  }

  getCart(customerId: string): CustomerCart {
    const cart = this.data.carts.find((entry) => entry.customerId === customerId)?.cart;
    return cart ? structuredClone(cart) : { items: [], revision: 0, updatedAt: new Date(this.now()).toISOString() };
  }

  updateCart(customerId: string, items: CustomerCartItem[]): CustomerCart {
    const now = new Date(this.now()).toISOString();
    const next = structuredClone(this.data);
    const previous = next.carts.find((entry) => entry.customerId === customerId);
    const cart: CustomerCart = {
      items: items.map((item) => ({ ...item, jumlah: Math.trunc(item.jumlah), updatedAt: now })),
      revision: (previous?.cart.revision ?? 0) + 1,
      updatedAt: now
    };
    if (previous) previous.cart = cart;
    else next.carts.push({ customerId, cart });
    this.save(next, 'CART_UPDATED', customerId);
    return structuredClone(cart);
  }

  getAddresses(customerId: string): CustomerAddress[] {
    return structuredClone(this.data.addresses.find((entry) => entry.customerId === customerId)?.items ?? []);
  }

  saveAddress(customerId: string, input: Omit<CustomerAddress, 'id' | 'updatedAt'> & { id?: string }): CustomerAddress[] {
    const fields: Array<[string, number, boolean]> = [
      ['label', 60, true], ['penerima', 120, true], ['telepon', 40, true],
      ['alamat', 300, true], ['kota', 100, true], ['provinsi', 100, true], ['kodePos', 10, true]
    ];
    for (const [key, max, required] of fields) {
      const value = (input as unknown as Record<string, unknown>)[key];
      if (typeof value !== 'string' || value.trim().length > max ||
          (required && !value.trim()) || /[\u0000-\u001f\u007f]/.test(value)) {
        throw new CustomerError(400, 'INVALID_ADDRESS', 'Alamat pengiriman tidak valid.');
      }
    }
    const next = structuredClone(this.data);
    let entry = next.addresses.find((row) => row.customerId === customerId);
    if (!entry) {
      entry = { customerId, items: [] };
      next.addresses.push(entry);
    }
    const now = new Date(this.now()).toISOString();
    if (input.isUtama) entry.items = entry.items.map((address) => ({ ...address, isUtama: false }));
    let saved: CustomerAddress;
    if (input.id) {
      const existing = entry.items.find((address) => address.id === input.id);
      if (!existing) throw new CustomerError(404, 'NOT_FOUND', 'Alamat tidak ditemukan.');
      saved = {
        ...existing,
        label: input.label.trim(), penerima: input.penerima.trim(), telepon: input.telepon.trim(),
        alamat: input.alamat.trim(), kota: input.kota.trim(), provinsi: input.provinsi.trim(),
        kodePos: input.kodePos.trim(), isUtama: input.isUtama === true, updatedAt: now
      };
      entry.items = entry.items.map((address) => address.id === saved.id ? saved : address);
    } else {
      saved = {
        id: crypto.randomUUID(),
        label: input.label.trim(), penerima: input.penerima.trim(), telepon: input.telepon.trim(),
        alamat: input.alamat.trim(), kota: input.kota.trim(), provinsi: input.provinsi.trim(),
        kodePos: input.kodePos.trim(), isUtama: input.isUtama === true || entry.items.length === 0,
        updatedAt: now
      };
      entry.items.push(saved);
    }
    if (!entry.items.some((address) => address.isUtama) && entry.items.length) {
      entry.items[0].isUtama = true;
    }
    this.save(next, 'ADDRESS_UPDATED', customerId);
    return structuredClone(entry.items);
  }

  deleteAddress(customerId: string, addressId: string): CustomerAddress[] {
    const next = structuredClone(this.data);
    const entry = next.addresses.find((row) => row.customerId === customerId);
    if (!entry) throw new CustomerError(404, 'NOT_FOUND', 'Alamat tidak ditemukan.');
    const previous = entry.items.find((address) => address.id === addressId);
    if (!previous) throw new CustomerError(404, 'NOT_FOUND', 'Alamat tidak ditemukan.');
    entry.items = entry.items.filter((address) => address.id !== addressId);
    if (previous.isUtama && entry.items.length) entry.items[0].isUtama = true;
    this.save(next, 'ADDRESS_DELETED', customerId);
    return structuredClone(entry.items);
  }

  updateProfile(customerId: string, input: CustomerProfileInput): CustomerAccount {
    const error = customerProfileError(input);
    if (error) throw new CustomerError(400, 'INVALID_PROFILE', error);
    const next = structuredClone(this.data);
    const customer = next.customers.find((c) => c.id === customerId);
    if (!customer) throw new CustomerError(404, 'NOT_FOUND', 'Akun tidak ditemukan.');
    Object.assign(customer, {
      nama: input.nama.trim(), telepon: input.telepon.trim(), perusahaan: input.perusahaan.trim(),
      teleponTerverifikasi: false, updatedAt: new Date(this.now()).toISOString()
    });
    this.save(next, 'PROFILE_UPDATED', customerId);
    return this.publicAccount(customer);
  }
}
