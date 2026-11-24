import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFileIfPresent } from './readJsonFile';
import {
  CUSTOMER_ORDER_NOTE_MAX,
  customerProfileError,
  customerTextError,
  customerUsernameError,
  normalizeCustomerUsername,
  type CustomerAccount,
  type CustomerAddress,
  type CustomerCart,
  type CustomerCartItem,
  type CustomerNotification,
  type CustomerOrder,
  type CustomerOrderEvent,
  type CustomerOrderLine,
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
  username?: string;
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

interface OrderEventRecord extends CustomerOrderEvent {
  /** Staff username; internal only and never returned to customers. */
  aktor?: string;
}

interface OrderRecord extends Omit<CustomerOrder, 'riwayat'> {
  customerId: string;
  requestId: string;
  riwayat: OrderEventRecord[];
}

export interface CustomerOrderStaffView extends Omit<OrderRecord, 'customerId' | 'requestId'> {
  customer: { id: string; username?: string; nama: string; perusahaan: string; status: CustomerAccount['status']; pelangganId?: string };
}

interface CustomerDatabase {
  version: 2;
  revision: number;
  customers: CustomerRecord[];
  sessions: CustomerSession[];
  carts: Array<{ customerId: string; cart: CustomerCart }>;
  addresses: Array<{ customerId: string; items: CustomerAddress[] }>;
  /** Added after the first version-2 release; absent collections load as empty. */
  orders: OrderRecord[];
  notificationReads: Array<{ customerId: string; eventIds: string[] }>;
}

interface CustomerAuditEvent {
  id: string;
  at: string;
  action?: string;
  customerId?: string;
  actor?: string;
  revision: number;
  phase: 'attempt' | 'committed';
}

const ORDER_STATUSES = ['menunggu-penawaran', 'dibatalkan'] as const;
const OPEN_ORDER_LIMIT = 10;
const NOTIFICATION_LIMIT = 50;
const ORDER_LINE_LIMIT = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const usernames = new Set<string>();
  for (const c of value.customers) {
    if (record(c) && c.username !== undefined) {
      if (customerUsernameError(c.username) || c.username !== normalizeCustomerUsername(String(c.username)) || usernames.has(String(c.username))) return false;
      usernames.add(String(c.username));
    }
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
  if (!value.addresses.every((entry: unknown) => {
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
  })) return false;
  return validOrderCollections(value, ids);
}

const shortText = (v: unknown, max: number, required = true) =>
  typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);

function validOrderCollections(value: Record<string, unknown>, customerIds: Set<string>): boolean {
  if (value.orders !== undefined && !Array.isArray(value.orders)) return false;
  if (value.notificationReads !== undefined && !Array.isArray(value.notificationReads)) return false;
  const orderIds = new Set<string>();
  const numbers = new Set<string>();
  const requests = new Set<string>();
  const ordersValid = ((value.orders ?? []) as unknown[]).every((order) => {
    if (!record(order) || typeof order.id !== 'string' || !order.id || orderIds.has(order.id) ||
        typeof order.customerId !== 'string' || !customerIds.has(order.customerId) ||
        typeof order.requestId !== 'string' || !UUID.test(order.requestId) || requests.has(`${order.customerId}:${order.requestId}`) ||
        typeof order.nomor !== 'string' || !/^PRT-\d{6}-[A-F0-9]{6}$/.test(order.nomor) || numbers.has(order.nomor) ||
        !ORDER_STATUSES.includes(order.status as typeof ORDER_STATUSES[number]) ||
        customerTextError(order.catatan, 'Catatan', CUSTOMER_ORDER_NOTE_MAX) !== null ||
        (order.uji !== undefined && order.uji !== true) ||
        !dateString(order.createdAt) || !dateString(order.updatedAt) ||
        !record(order.alamat) || !['label', 'penerima', 'telepon', 'alamat', 'kota', 'provinsi', 'kodePos'].every((key) => shortText((order.alamat as Record<string, unknown>)[key], 300)) ||
        !Array.isArray(order.baris) || order.baris.length < 1 || order.baris.length > ORDER_LINE_LIMIT ||
        !Array.isArray(order.riwayat) || order.riwayat.length < 1) return false;
    const lineIds = new Set<string>();
    const linesValid = order.baris.every((line: unknown) => {
      if (!record(line) || typeof line.id !== 'string' || !line.id || lineIds.has(line.id) ||
          !shortText(line.produkId, 100) || !shortText(line.varianId, 100) || !shortText(line.nama, 200) ||
          !['tipeModel', 'kodeSKU', 'nomorIzinEdar', 'satuan'].every((key) => shortText(line[key], 160, false)) ||
          typeof line.jumlah !== 'number' || !Number.isSafeInteger(line.jumlah) || line.jumlah < 1 || line.jumlah > 1000000) return false;
      lineIds.add(line.id);
      return true;
    });
    const eventsValid = order.riwayat.every((event: unknown) => record(event) && typeof event.id === 'string' && Boolean(event.id) &&
      ORDER_STATUSES.includes(event.status as typeof ORDER_STATUSES[number]) && ['customer', 'staf'].includes(String(event.oleh)) &&
      (event.catatan === undefined || customerTextError(event.catatan, 'Catatan', 500) === null) &&
      (event.aktor === undefined || shortText(event.aktor, 120)) && dateString(event.at));
    if (!linesValid || !eventsValid || (order.riwayat.at(-1) as Record<string, unknown>).status !== order.status) return false;
    orderIds.add(order.id);
    numbers.add(order.nomor);
    requests.add(`${order.customerId}:${order.requestId}`);
    return true;
  });
  if (!ordersValid) return false;
  const readers = new Set<string>();
  return ((value.notificationReads ?? []) as unknown[]).every((entry) => {
    if (!record(entry) || typeof entry.customerId !== 'string' || !customerIds.has(entry.customerId) ||
        readers.has(entry.customerId) || !Array.isArray(entry.eventIds) || entry.eventIds.length > NOTIFICATION_LIMIT ||
        !entry.eventIds.every((id) => typeof id === 'string' && UUID.test(id))) return false;
    readers.add(entry.customerId);
    return true;
  });
}

function validCustomerAuditEvent(value: unknown): value is CustomerAuditEvent {
  if (!record(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.at !== 'string' || !Number.isSafeInteger(value.revision) ||
      !['attempt', 'committed'].includes(String(value.phase)) ||
      (value.action !== undefined && typeof value.action !== 'string') ||
      (value.customerId !== undefined && typeof value.customerId !== 'string') ||
      (value.actor !== undefined && typeof value.actor !== 'string')) return false;
  const date = new Date(value.at);
  return Number.isFinite(date.getTime()) && date.toISOString() === value.at;
}

export class ServerCustomerStore {
  private data: CustomerDatabase;
  private readonly file: string;
  private readonly auditFile: string;
  private readonly auditArchiveDir: string;
  private readonly archivedAuditEvents = new Set<string>();
  private readonly pendingAuditArchive = new Map<string, CustomerAuditEvent>();

  constructor(dataDir: string, private readonly now = Date.now) {
    this.file = path.join(dataDir, 'customer-portal-db.json');
    this.auditFile = path.join(dataDir, 'customer-portal-audit.jsonl');
    this.auditArchiveDir = path.join(dataDir, 'customer-portal-audit-archive');
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const loaded = readJsonFileIfPresent(this.file, 'Database Customer Portal');
    if (loaded !== undefined && record(loaded) && loaded.version === 1 &&
        Array.isArray(loaded.customers) && Array.isArray(loaded.sessions)) {
      const migrated: CustomerDatabase = {
        version: 2,
        revision: Number.isSafeInteger(loaded.revision) && Number(loaded.revision) >= 0 ? Number(loaded.revision) : 0,
        customers: loaded.customers as CustomerRecord[],
        sessions: loaded.sessions as CustomerSession[],
        carts: [],
        addresses: [],
        orders: [],
        notificationReads: []
      };
      if (!validDatabase(migrated)) {
        throw new Error('Struktur database Customer Portal versi 1 tidak didukung. Berkas tidak diubah; periksa backup.');
      }
      this.data = migrated;
    } else if (loaded !== undefined && !validDatabase(loaded)) {
      throw new Error('Struktur atau versi database Customer Portal tidak didukung. Berkas tidak diubah; periksa backup.');
    } else {
      this.data = loaded === undefined
        ? { version: 2, revision: 0, customers: [], sessions: [], carts: [], addresses: [], orders: [], notificationReads: [] }
        : { ...loaded, orders: loaded.orders ?? [], notificationReads: loaded.notificationReads ?? [] };
    }
    this.loadAuditArchiveIndex();
    this.archiveLegacyAuditEvents();
    this.flushAuditArchive();
  }

  private loadAuditArchiveIndex(): void {
    fs.mkdirSync(this.auditArchiveDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.auditArchiveDir, 0o700);
    for (const filename of fs.readdirSync(this.auditArchiveDir)) {
      const month = /^(\d{4}-(?:0[1-9]|1[0-2]))\.jsonl$/.exec(filename)?.[1];
      if (!month) continue;
      const archivePath = path.join(this.auditArchiveDir, filename);
      if (!fs.lstatSync(archivePath).isFile()) {
        throw new Error(`Arsip audit customer "${archivePath}" bukan file reguler; file tidak diubah.`);
      }
      const content = fs.readFileSync(archivePath, 'utf8');
      for (const [index, line] of content.split(/\r?\n/).entries()) {
        if (!line) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch (error) {
          throw new Error(`Arsip audit customer "${archivePath}" rusak pada baris ${index + 1}; file tidak diubah.`, { cause: error });
        }
        if (!validCustomerAuditEvent(parsed) || parsed.at.slice(0, 7) !== month) {
          throw new Error(`Entri arsip audit customer "${archivePath}" tidak valid pada baris ${index + 1}; file tidak diubah.`);
        }
        const key = `${parsed.id}:${parsed.phase}`;
        if (this.archivedAuditEvents.has(key)) {
          throw new Error(`Entri audit customer "${key}" duplikat pada arsip; file tidak diubah.`);
        }
        this.archivedAuditEvents.add(key);
      }
    }
  }

  private archiveLegacyAuditEvents(): void {
    if (!fs.existsSync(this.auditFile)) return;
    const content = fs.readFileSync(this.auditFile, 'utf8');
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new Error(`Riwayat audit customer "${this.auditFile}" rusak pada baris ${index + 1}; file tidak diubah.`, { cause: error });
      }
      if (!validCustomerAuditEvent(parsed)) {
        throw new Error(`Entri riwayat audit customer "${this.auditFile}" tidak valid pada baris ${index + 1}; file tidak diubah.`);
      }
      const key = `${parsed.id}:${parsed.phase}`;
      if (!this.archivedAuditEvents.has(key)) this.pendingAuditArchive.set(key, parsed);
    }
  }

  private flushAuditArchive(): void {
    for (const [key, event] of this.pendingAuditArchive) {
      const month = event.at.slice(0, 7);
      if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || !validCustomerAuditEvent(event)) {
        throw new Error(`Entri audit customer "${key}" tidak valid untuk arsip bulanan.`);
      }
      const archivePath = path.join(this.auditArchiveDir, `${month}.jsonl`);
      if (fs.existsSync(archivePath) && !fs.lstatSync(archivePath).isFile()) {
        throw new Error(`Arsip audit customer "${archivePath}" bukan file reguler.`);
      }
      fs.appendFileSync(archivePath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(archivePath, 0o600);
      this.archivedAuditEvents.add(key);
      this.pendingAuditArchive.delete(key);
    }
  }

  private save(next: CustomerDatabase, action?: string, customerId?: string, actor?: string) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const event = { id: crypto.randomUUID(), at: new Date(this.now()).toISOString(), action, customerId, actor, revision: this.data.revision + 1 };
    const audit = (phase: CustomerAuditEvent['phase']) => {
      const record = { ...event, phase };
      this.pendingAuditArchive.set(`${record.id}:${phase}`, record);
      this.flushAuditArchive();
    };
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

  isUsernameAvailable(rawUsername: string): boolean {
    const username = normalizeCustomerUsername(rawUsername);
    return !customerUsernameError(username) && !this.data.customers.some((c) => c.username === username);
  }

  /** Server-only lookup used to sign in by username; never return the email to the client. */
  loginEmailForUsername(rawUsername: string): string | null {
    const username = normalizeCustomerUsername(rawUsername);
    const customer = this.data.customers.find((c) => c.username === username && !c.developerUserId);
    return customer && customer.status !== 'ditangguhkan' ? customer.email : null;
  }

  listCustomersForStaff(): CustomerStaffSummary[] {
    return this.data.customers.filter((customer) => !customer.developerUserId).map((customer) => ({
      id: customer.id, username: customer.username, email: customer.email, nama: customer.nama, telepon: customer.telepon,
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

  register(identity: CustomerIdentity, input: CustomerProfileInput, privacyVersion: string, rawUsername?: string): CustomerAccount {
    const error = customerProfileError(input);
    if (error) throw new CustomerError(400, 'INVALID_PROFILE', error);
    if (!validEmail(identity.email) || !identity.uid || identity.uid.startsWith(DEVELOPER_UID_PREFIX)) throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas customer tidak valid.');
    const existing = this.data.customers.find((c) => c.firebaseUid === identity.uid && !c.developerUserId);
    if (existing) {
      if (existing.status === 'ditangguhkan') throw new CustomerError(403, 'ACCOUNT_UNAVAILABLE', 'Akun tidak dapat digunakan. Hubungi tim kami.');
      return this.publicAccount(existing);
    }
    const usernameError = customerUsernameError(rawUsername);
    if (usernameError) throw new CustomerError(400, 'INVALID_USERNAME', usernameError);
    const username = normalizeCustomerUsername(rawUsername!);
    if (!this.isUsernameAvailable(username)) throw new CustomerError(409, 'USERNAME_TAKEN', 'Username sudah digunakan. Pilih username lain.');
    const email = identity.email.toLowerCase();
    if (this.data.customers.some((c) => c.email === email)) throw new CustomerError(409, 'ACCOUNT_EXISTS', 'Akun tidak dapat didaftarkan. Gunakan pemulihan akun.');
    const now = new Date(this.now()).toISOString();
    const customer: CustomerRecord = {
      id: crypto.randomUUID(), firebaseUid: identity.uid, username, email,
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

  private customerOrder(order: OrderRecord): CustomerOrder {
    const { customerId: _customer, requestId: _request, riwayat, ...rest } = order;
    return structuredClone({ ...rest, riwayat: riwayat.map(({ aktor: _actor, ...event }) => event) });
  }

  /**
   * Snapshots the cart into a quotation request and empties the cart in the same write.
   * A repeated requestId returns the original order so client retries never duplicate it.
   */
  createOrder(
    customerId: string,
    input: { requestId: unknown; cartRevision: unknown; alamatId: unknown; catatan: unknown },
    describe: (item: CustomerCartItem) => Omit<CustomerOrderLine, 'id' | 'jumlah'> | null
  ): { order: CustomerOrder; created: boolean } {
    const customer = this.data.customers.find((c) => c.id === customerId);
    if (!customer) throw new CustomerError(404, 'NOT_FOUND', 'Akun tidak ditemukan.');
    if (!customer.developerUserId && (customer.status !== 'aktif' || !customer.pelangganId)) {
      throw new CustomerError(403, 'ACCOUNT_NOT_ACTIVE', 'Pengajuan pesanan tersedia setelah tim kami menautkan akun Anda ke data pelanggan bisnis.');
    }
    if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) throw new CustomerError(400, 'INVALID_REQUEST_ID', 'ID permintaan tidak valid.');
    const requestId = input.requestId.toLowerCase();
    const existing = this.data.orders.find((o) => o.customerId === customerId && o.requestId === requestId);
    if (existing) return { order: this.customerOrder(existing), created: false };
    const noteError = customerTextError(input.catatan ?? '', 'Catatan', CUSTOMER_ORDER_NOTE_MAX);
    if (noteError) throw new CustomerError(400, 'INVALID_NOTE', noteError);
    const cart = this.getCart(customerId);
    if (!cart.items.length) throw new CustomerError(400, 'CART_EMPTY', 'Keranjang masih kosong.');
    if (input.cartRevision !== cart.revision) throw new CustomerError(409, 'CART_CHANGED', 'Keranjang berubah di perangkat lain. Periksa kembali sebelum mengajukan.');
    const address = this.getAddresses(customerId).find((a) => a.id === input.alamatId);
    if (!address) throw new CustomerError(404, 'ADDRESS_NOT_FOUND', 'Pilih alamat pengiriman yang tersimpan.');
    if (this.data.orders.filter((o) => o.customerId === customerId && o.status === 'menunggu-penawaran').length >= OPEN_ORDER_LIMIT) {
      throw new CustomerError(409, 'TOO_MANY_OPEN_ORDERS', `Maksimal ${OPEN_ORDER_LIMIT} permintaan menunggu penawaran. Tunggu tanggapan sales atau batalkan permintaan lama.`);
    }
    const baris = cart.items.map((item) => {
      const described = describe(item);
      if (!described) throw new CustomerError(409, 'CART_PRODUCT_UNAVAILABLE', 'Sebagian produk di keranjang tidak lagi tersedia. Perbarui keranjang Anda.');
      return { id: crypto.randomUUID(), ...described, produkId: item.produkId, varianId: item.varianId, jumlah: item.jumlah };
    });
    const nowDate = new Date(this.now());
    const now = nowDate.toISOString();
    const day = now.slice(2, 10).replace(/-/g, '');
    let nomor: string;
    do { nomor = `PRT-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; } while (this.data.orders.some((o) => o.nomor === nomor));
    const { id: _id, isUtama: _main, updatedAt: _updated, ...alamat } = address;
    const order: OrderRecord = {
      id: crypto.randomUUID(), nomor, customerId, requestId, status: 'menunggu-penawaran', baris, alamat,
      catatan: typeof input.catatan === 'string' ? input.catatan.trim() : '',
      riwayat: [{ id: crypto.randomUUID(), status: 'menunggu-penawaran', oleh: 'customer', at: now }],
      ...(customer.developerUserId ? { uji: true as const } : {}),
      createdAt: now, updatedAt: now
    };
    const next = structuredClone(this.data);
    next.orders.push(order);
    next.carts.find((entry) => entry.customerId === customerId)!.cart = { items: [], revision: cart.revision + 1, updatedAt: now };
    this.save(next, 'ORDER_REQUESTED', customerId);
    return { order: this.customerOrder(order), created: true };
  }

  listOrders(customerId: string): CustomerOrder[] {
    return this.data.orders.filter((o) => o.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => this.customerOrder(o));
  }

  getOrder(customerId: string, orderId: string): CustomerOrder {
    const order = this.data.orders.find((o) => o.id === orderId && o.customerId === customerId);
    if (!order) throw new CustomerError(404, 'NOT_FOUND', 'Pesanan tidak ditemukan.');
    return this.customerOrder(order);
  }

  private cancelOrder(match: (o: OrderRecord) => boolean, event: Omit<OrderEventRecord, 'id' | 'status' | 'at'>, action: string): OrderRecord {
    const next = structuredClone(this.data);
    const order = next.orders.find(match);
    if (!order) throw new CustomerError(404, 'NOT_FOUND', 'Pesanan tidak ditemukan.');
    if (order.status === 'dibatalkan') return order;
    if (order.status !== 'menunggu-penawaran') throw new CustomerError(409, 'ORDER_NOT_CANCELLABLE', 'Pesanan pada status ini tidak dapat dibatalkan.');
    const now = new Date(this.now()).toISOString();
    order.status = 'dibatalkan';
    order.updatedAt = now;
    order.riwayat.push({ id: crypto.randomUUID(), status: 'dibatalkan', at: now, ...event });
    this.save(next, action, order.customerId, event.aktor);
    return order;
  }

  cancelOrderByCustomer(customerId: string, orderId: string, reason: unknown): CustomerOrder {
    const error = customerTextError(reason ?? '', 'Alasan', 500);
    if (error) throw new CustomerError(400, 'INVALID_REASON', error);
    const catatan = typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
    const order = this.cancelOrder((o) => o.id === orderId && o.customerId === customerId,
      { oleh: 'customer', ...(catatan ? { catatan } : {}) }, 'ORDER_CANCELLED_BY_CUSTOMER');
    return this.customerOrder(order);
  }

  cancelOrderByStaff(orderId: string, reason: unknown, actor: string): CustomerOrderStaffView {
    const error = customerTextError(reason, 'Alasan pembatalan', 500, true);
    if (error) throw new CustomerError(400, 'INVALID_REASON', error);
    const order = this.cancelOrder((o) => o.id === orderId, { oleh: 'staf', catatan: String(reason).trim(), aktor: actor }, 'ORDER_CANCELLED_BY_STAFF');
    return this.staffOrder(order);
  }

  private staffOrder(order: OrderRecord): CustomerOrderStaffView {
    const customer = this.data.customers.find((c) => c.id === order.customerId)!;
    const { customerId: _customer, requestId: _request, ...rest } = order;
    return structuredClone({
      ...rest,
      customer: {
        id: customer.id, username: customer.username, nama: customer.nama, perusahaan: customer.perusahaan,
        status: customer.status, pelangganId: customer.pelangganId
      }
    });
  }

  listOrdersForStaff(): CustomerOrderStaffView[] {
    return [...this.data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => this.staffOrder(o));
  }

  notifications(customerId: string): CustomerNotification[] {
    // Read state is tracked per event id so an event written in the same millisecond as "mark read" stays unread.
    const read = new Set(this.data.notificationReads.find((entry) => entry.customerId === customerId)?.eventIds ?? []);
    return this.data.orders.filter((o) => o.customerId === customerId).flatMap((order) => order.riwayat.map((event) => {
      const [judul, pesan] = event.status === 'menunggu-penawaran'
        ? ['Permintaan penawaran diterima', `Pesanan ${order.nomor} (${order.baris.length} produk) menunggu penawaran dari tim sales.`]
        : event.oleh === 'staf'
          ? ['Pesanan dibatalkan oleh tim kami', `Pesanan ${order.nomor} dibatalkan. Alasan: ${event.catatan}`]
          : ['Pesanan dibatalkan', `Anda membatalkan pesanan ${order.nomor}.`];
      return { id: event.id, judul, pesan, pesananId: order.id, dibaca: read.has(event.id), createdAt: event.at };
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, NOTIFICATION_LIMIT);
  }

  markNotificationsRead(customerId: string): CustomerNotification[] {
    const next = structuredClone(this.data);
    const eventIds = this.notifications(customerId).map((item) => item.id);
    const entry = next.notificationReads.find((row) => row.customerId === customerId);
    if (entry) entry.eventIds = eventIds;
    else next.notificationReads.push({ customerId, eventIds });
    this.save(next);
    return this.notifications(customerId);
  }
}
