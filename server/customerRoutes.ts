import express, { type Request, type Response, type NextFunction } from 'express';
import type {
  CustomerAddress,
  CustomerPortalStatus,
  CustomerProfileInput
} from '../src/types/customerPortal';
import { customerProfileError, customerUsernameError, normalizeCustomerUsername } from '../src/types/customerPortal';
import { CustomerError, ServerCustomerStore } from './customerStore';
import type { CustomerIdentityService, CustomerIdentityState } from './customerAuth';

export const CUSTOMER_COOKIE = 'ams_customer_session';
type ResolvedCustomer = Omit<NonNullable<ReturnType<ServerCustomerStore['resolve']>>, 'session'> & {
  session?: NonNullable<ReturnType<ServerCustomerStore['resolve']>>['session'];
  developer?: true;
};

declare global {
  namespace Express {
    interface Request {
      customerAuth?: ResolvedCustomer;
    }
  }
}

export function requireCustomerOrigin(origin?: string) {
  const configured = origin ? new URL(origin).origin : null;
  return (req: Request, res: Response, next: NextFunction) => {
    const expected = configured ?? `${req.protocol}://${req.get('host')}`;
    if (req.get('origin') !== expected || req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ error: 'ORIGIN_DENIED', pesan: 'Permintaan harus berasal dari situs yang sama.' });
    }
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'JSON_REQUIRED', pesan: 'Permintaan harus berupa JSON.' });
    }
    next();
  };
}

const sessionToken = (req: Request): string => {
  const cookie = req.headers.cookie?.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${CUSTOMER_COOKIE}=`));
  return cookie?.slice(CUSTOMER_COOKIE.length + 1) ?? '';
};

function customerCookie(req: Request, res: Response, token: string, origin?: string) {
  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true, secure: origin ? new URL(origin).protocol === 'https:' : req.secure,
    sameSite: 'lax', path: '/api/customer', maxAge: token ? 7 * 86400000 : 0
  });
}

function fields(body: unknown, allowed: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new CustomerError(400, 'INVALID_FIELDS', 'Kolom permintaan tidak diizinkan.');
  }
  return body as Record<string, unknown>;
}

function objectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function catalogItems(snapshot: unknown): Array<Record<string, unknown>> {
  if (!objectRecord(snapshot)) return [];
  const root = snapshot;
  if (root.isPublished !== true) return [];
  const products = objectRecord(root.produk)
    ? root.produk.item
    : undefined;
  return Array.isArray(products)
    ? products.filter((item): item is Record<string, unknown> => objectRecord(item) && item.isActive === true)
    : [];
}

function sanitizeCatalogItem(item: Record<string, unknown>) {
  const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const rawImages = [
    ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
    ...(typeof item.imageUrl === 'string' ? [item.imageUrl] : [])
  ];
  const images = [...new Set([
    ...rawImages.flatMap((value): string[] => {
      if (typeof value !== 'string') return [];
      if (/^https?:\/\//.test(value)) return [value];
      if (/^media:[A-Za-z0-9_-]{1,80}$/.test(value)) {
        return [`/api/website/media/${encodeURIComponent(value.slice('media:'.length))}`];
      }
      return [];
    }).slice(0, 8)
  ])];
  const variants = Array.isArray(item.varianSku) ? item.varianSku.slice(0, 50).filter(objectRecord).map((variant) => ({
    id: text(variant.id, 100),
    kodeSKU: text(variant.kodeSKU, 100),
    tipeModel: text(variant.tipeModel, 160),
    nomorIzinEdar: text(variant.nomorIzinEdar, 100),
    satuan: text(variant.satuan, 40) || text(item.satuan, 40) || 'unit'
  })).filter((variant) => variant.id) : [];
  return {
    id: text(item.id, 100),
    nama: text(item.nama, 200),
    tipeModel: text(item.tipeModel, 160),
    kategori: text(item.kategori, 100),
    kategoriRegulasi: text(item.kategoriRegulasi, 100) || undefined,
    produsen: text(item.produsen, 160),
    spesifikasi: text(item.spesifikasi, 3000),
    nomorIzinEdar: text(item.nomorIzinEdar, 100),
    statusIzinEdar: text(item.statusIzinEdar, 100),
    satuan: text(item.satuan, 40) || 'unit',
    hargaTayang: text(item.hargaTayang, 100) || undefined,
    referensiHarga: text(item.referensiHarga, 300) || undefined,
    stokLabel: 'perlu-konfirmasi' as const,
    imageUrls: images,
    varian: variants
  };
}

function profile(body: Record<string, unknown>): CustomerProfileInput {
  const error = customerProfileError(body);
  if (error) throw new CustomerError(400, 'INVALID_PROFILE', error);
  return { nama: String(body.nama), telepon: String(body.telepon), perusahaan: String(body.perusahaan) };
}

function rateLimit(max: number, windowMs: number, keyOf: (req: Request) => string = (req) => req.ip || req.socket.remoteAddress || 'unknown') {
  const entries = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.reset <= now) entries.delete(key);
    const key = keyOf(req);
    const entry = entries.get(key) ?? { count: 0, reset: now + windowMs };
    if (entry.count >= max || (!entries.has(key) && entries.size >= 10000)) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'RATE_LIMIT', pesan: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    }
    entry.count += 1;
    entries.set(key, entry);
    next();
  };
}

export function createCustomerRouter(options: {
  store: ServerCustomerStore | null;
  identity: CustomerIdentityService;
  status: () => CustomerPortalStatus;
  origin?: string;
  catalog?: () => unknown;
}) {
  const router = express.Router();
  const { store, identity, origin } = options;
  const handle = (handler: (req: Request, res: Response) => Promise<unknown> | unknown) =>
    (req: Request, res: Response, next: NextFunction) => { Promise.resolve().then(() => handler(req, res)).catch(next); };
  const sameOrigin = requireCustomerOrigin(origin);

  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/status', (_req, res) => res.json(options.status()));
  router.use((_req, res, next) => {
    if (!store || !options.status().enabled) return res.status(404).json({ error: 'PORTAL_NONAKTIF', pesan: 'Customer Portal belum diaktifkan.' });
    next();
  });
  router.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return sameOrigin(req, res, next);
    next();
  });
  router.use(express.json({ limit: '32kb' }));

  const verifyIdentity = async (body: Record<string, unknown>) => {
    if (!options.status().authAvailable || !identity.available()) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Konfigurasi autentikasi customer belum siap.');
    if (typeof body.idToken !== 'string' || body.idToken.length > 16384 || !body.idToken) {
      throw new CustomerError(400, 'TOKEN_REQUIRED', 'Token Firebase wajib disertakan.');
    }
    const verified = await identity.verify(body.idToken);
    const current = await identity.read(verified.uid);
    if (current.disabled || current.email !== verified.email || verified.authTime < current.validAfter) {
      throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas berubah. Silakan masuk kembali.');
    }
    return { ...verified, emailVerified: verified.emailVerified && current.emailVerified };
  };

  router.post('/auth/daftar', rateLimit(5, 3600000), handle(async (req, res) => {
    const status = options.status();
    if (!status.registrationAvailable || !status.privacyVersion) throw new CustomerError(503, 'REGISTRATION_UNAVAILABLE', 'Pendaftaran belum tersedia. Kebijakan privasi atau Firebase belum dikonfigurasi.');
    const body = fields(req.body, ['idToken', 'username', 'nama', 'telepon', 'perusahaan', 'privacyAccepted', 'privacyVersion']);
    if (body.privacyAccepted !== true || body.privacyVersion !== status.privacyVersion) {
      throw new CustomerError(400, 'PRIVACY_REQUIRED', 'Setujui kebijakan privasi dan syarat layanan yang berlaku.');
    }
    const input = profile(body);
    const verified = await verifyIdentity(body);
    res.status(201).json({ account: store!.register(verified, input, status.privacyVersion, typeof body.username === 'string' ? body.username : undefined) });
  }));

  router.post('/auth/cek-username', rateLimit(30, 900000), handle((req, res) => {
    const body = fields(req.body, ['username']);
    const error = customerUsernameError(body.username);
    if (error) return res.json({ available: false, pesan: error });
    const available = store!.isUsernameAvailable(String(body.username));
    res.json({ available, pesan: available ? 'Username tersedia.' : 'Username sudah digunakan.' });
  }));

  const usernameFailures = new Map<string, { count: number; reset: number }>();
  const verificationSentAt = new Map<string, number>();
  router.post('/auth/masuk', rateLimit(20, 900000), handle(async (req, res) => {
    if (!options.status().authAvailable || !identity.available()) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Konfigurasi autentikasi customer belum siap.');
    const body = fields(req.body, ['username', 'password']);
    if (typeof body.username !== 'string' || typeof body.password !== 'string' || !body.password ||
        body.username.length > 64 || body.password.length > 128) throw new CustomerError(400, 'INVALID_CREDENTIALS', 'Username dan kata sandi wajib diisi.');
    const username = normalizeCustomerUsername(body.username);
    const now = Date.now();
    for (const [key, entry] of usernameFailures) if (entry.reset <= now) usernameFailures.delete(key);
    // Per-username throttle limits distributed guessing that the per-IP limiter cannot see.
    const failures = usernameFailures.get(username);
    if (failures && failures.count >= 10) {
      res.set('Retry-After', String(Math.ceil((failures.reset - now) / 1000)));
      throw new CustomerError(429, 'RATE_LIMIT', 'Terlalu banyak percobaan. Coba lagi nanti.');
    }
    const fail = () => {
      const entry = usernameFailures.get(username) ?? { count: 0, reset: now + 900000 };
      entry.count += 1;
      if (usernameFailures.size < 10000 || usernameFailures.has(username)) usernameFailures.set(username, entry);
    };
    const email = store!.loginEmailForUsername(username);
    if (!email) { fail(); throw new CustomerError(401, 'INVALID_CREDENTIALS', 'Username atau kata sandi salah.'); }
    let idToken: string;
    try { idToken = await identity.signIn(email, body.password); } catch (error) {
      if (error instanceof CustomerError && error.code === 'INVALID_CREDENTIALS') fail();
      throw error;
    }
    usernameFailures.delete(username);
    const verified = await verifyIdentity({ idToken });
    if (!verified.emailVerified) {
      const last = verificationSentAt.get(verified.uid) ?? 0;
      if (now - last > 600000) {
        verificationSentAt.set(verified.uid, now);
        if (verificationSentAt.size > 10000) verificationSentAt.delete(verificationSentAt.keys().next().value!);
        await identity.sendVerification(idToken, origin ? `${new URL(origin).origin}/akun/masuk` : undefined).catch(() => undefined);
      }
      throw new CustomerError(403, 'EMAIL_UNVERIFIED', 'Email belum terverifikasi. Tautan verifikasi telah dikirim ke email terdaftar.');
    }
    const result = store!.login(verified);
    customerCookie(req, res, result.token, origin);
    res.json({ account: result.account, expiresAt: result.expiresAt });
  }));

  router.post('/auth/sesi', rateLimit(20, 900000), handle(async (req, res) => {
    const body = fields(req.body, ['idToken']);
    const verified = await verifyIdentity(body);
    const result = store!.login(verified);
    customerCookie(req, res, result.token, origin);
    res.json({ account: result.account, expiresAt: result.expiresAt });
  }));

  // Logout must remain available when Firebase is unreachable or the session has expired.
  router.post('/auth/keluar', handle((req, res) => {
    store!.logout(sessionToken(req));
    customerCookie(req, res, '', origin);
    res.json({ ok: true });
  }));

  const attachCustomer = async (req: Request, res: Response) => {
    const resolved = store!.resolve(sessionToken(req));
    if (!resolved && req.auth?.user.isHiddenDeveloper === true) {
      // The single hidden developer is not an employee; its ERP session grants an isolated portal workspace.
      req.customerAuth = { account: store!.developerWorkspace(req.auth.user), uid: '', developer: true };
      return;
    }
    if (!resolved) throw new CustomerError(401, 'CUSTOMER_UNAUTHORIZED', 'Sesi customer berakhir. Silakan masuk kembali.');
    let current: CustomerIdentityState;
    try { current = await identity.read(resolved.uid); } catch (error) {
      if (error instanceof CustomerError && error.status === 401) {
        store!.revokeAll(resolved.account.id);
        customerCookie(req, res, '', origin);
      }
      throw error;
    }
    if (current.disabled || !current.emailVerified || current.email !== resolved.session.email ||
        resolved.session.authTime < current.validAfter) {
      store!.revokeAll(resolved.account.id);
      customerCookie(req, res, '', origin);
      throw new CustomerError(401, 'CUSTOMER_UNAUTHORIZED', 'Identitas berubah. Silakan masuk kembali.');
    }
    // Re-resolve after I/O: a parallel logout must not resurrect the session.
    const latest = store!.resolve(sessionToken(req));
    if (!latest) throw new CustomerError(401, 'CUSTOMER_UNAUTHORIZED', 'Sesi customer telah dicabut.');
    store!.touch(latest.session.hash);
    req.customerAuth = latest;
  };
  router.use((req, res, next) => { attachCustomer(req, res).then(() => next()).catch(next); });

  router.get(['/auth/saya', '/profil'], (req, res) => res.json({ account: req.customerAuth!.account }));
  router.get('/katalog', (req, res) => {
    const items = catalogItems(options.catalog?.()).map(sanitizeCatalogItem).filter((item) => item.id && item.nama);
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.kategori === 'string' ? req.query.kategori.trim().toLowerCase() : '';
    const filtered = items.filter((item) => {
      const matchesQuery = !query || [
        item.nama, item.tipeModel, item.produsen, item.nomorIzinEdar, item.kategori,
        ...item.varian.flatMap((variant: { kodeSKU: string; tipeModel: string; nomorIzinEdar: string }) =>
          [variant.kodeSKU, variant.tipeModel, variant.nomorIzinEdar])
      ]
        .some((value) => value.toLowerCase().includes(query));
      const matchesCategory = !category || [item.kategori, item.kategoriRegulasi]
        .some((value) => value?.toLowerCase() === category);
      return matchesQuery && matchesCategory;
    });
    const categories = [...new Set(items.map((item) => item.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    res.json({ items: filtered, categories });
  });
  router.get('/katalog/:id', (req, res) => {
    const items = catalogItems(options.catalog?.()).map(sanitizeCatalogItem);
    const item = items.find((candidate) => candidate.id === req.params.id);
    if (!item) throw new CustomerError(404, 'NOT_FOUND', 'Produk tidak ditemukan.');
    res.json({ item });
  });
  router.get('/keranjang', (req, res) => {
    res.json({ cart: store!.getCart(req.customerAuth!.account.id) });
  });
  router.put('/keranjang', handle((req, res) => {
    const body = fields(req.body, ['items']);
    if (!Array.isArray(body.items) || body.items.length > 30) {
      throw new CustomerError(400, 'INVALID_CART', 'Keranjang maksimal 30 baris.');
    }
    const items = catalogItems(options.catalog?.()).map(sanitizeCatalogItem);
    const normalized = body.items.map((row: unknown) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new CustomerError(400, 'INVALID_CART', 'Baris keranjang tidak valid.');
      const value = row as Record<string, unknown>;
      if (Object.keys(value).some((key) => !['produkId', 'varianId', 'jumlah'].includes(key))) {
        throw new CustomerError(400, 'INVALID_CART', 'Kolom keranjang tidak diizinkan.');
      }
      if (typeof value.produkId !== 'string' || typeof value.varianId !== 'string' ||
          typeof value.jumlah !== 'number' || !Number.isSafeInteger(value.jumlah) ||
          value.jumlah < 1 || value.jumlah > 1000000) {
        throw new CustomerError(400, 'INVALID_CART', 'Produk atau jumlah keranjang tidak valid.');
      }
      const product = items.find((item) => item.id === value.produkId);
      const variant = product?.varian.find((candidate) => candidate.id === value.varianId);
      if (!product || !variant) throw new CustomerError(404, 'CART_PRODUCT_NOT_FOUND', 'Produk atau varian tidak tersedia.');
      return { produkId: value.produkId, varianId: value.varianId, jumlah: value.jumlah };
    });
    const unique = new Set(normalized.map((item) => `${item.produkId}:${item.varianId}`));
    if (unique.size !== normalized.length) throw new CustomerError(400, 'INVALID_CART', 'Produk dan varian yang sama tidak boleh berulang.');
    res.json({ cart: store!.updateCart(req.customerAuth!.account.id, normalized) });
  }));
  router.get('/alamat', (req, res) => {
    res.json({ items: store!.getAddresses(req.customerAuth!.account.id) });
  });
  router.post('/alamat', handle((req, res) => {
    const body = fields(req.body, ['label', 'penerima', 'telepon', 'alamat', 'kota', 'provinsi', 'kodePos', 'isUtama']);
    const input = body as unknown as Omit<CustomerAddress, 'id' | 'updatedAt'>;
    res.status(201).json({ items: store!.saveAddress(req.customerAuth!.account.id, input) });
  }));
  router.patch('/alamat/:id', handle((req, res) => {
    const body = fields(req.body, ['label', 'penerima', 'telepon', 'alamat', 'kota', 'provinsi', 'kodePos', 'isUtama']);
    const input = { ...(body as unknown as Omit<CustomerAddress, 'id' | 'updatedAt'>), id: req.params.id };
    res.json({ items: store!.saveAddress(req.customerAuth!.account.id, input) });
  }));
  router.delete('/alamat/:id', handle((req, res) => {
    res.json({ items: store!.deleteAddress(req.customerAuth!.account.id, req.params.id) });
  }));
  router.get('/notifikasi', (req, res) => {
    res.json({ items: store!.notifications(req.customerAuth!.account.id) });
  });
  router.post('/notifikasi/baca', handle((req, res) => {
    fields(req.body, []);
    res.json({ items: store!.markNotificationsRead(req.customerAuth!.account.id) });
  }));
  router.get('/pesanan', (req, res) => {
    res.json({ items: store!.listOrders(req.customerAuth!.account.id) });
  });
  router.get('/pesanan/:id', (req, res) => {
    res.json({ order: store!.getOrder(req.customerAuth!.account.id, req.params.id) });
  });
  // Per account (not per IP) so customers behind one hospital NAT do not share a quota; idempotent retries count too.
  router.post('/pesanan', rateLimit(20, 3600000, (req) => `pesanan:${req.customerAuth!.account.id}`), handle((req, res) => {
    const body = fields(req.body, ['requestId', 'cartRevision', 'alamatId', 'catatan']);
    // Lines are re-resolved against the published catalog at submission; the browser only sends the cart revision.
    const items = catalogItems(options.catalog?.()).map(sanitizeCatalogItem);
    const result = store!.createOrder(req.customerAuth!.account.id, {
      requestId: body.requestId, cartRevision: body.cartRevision, alamatId: body.alamatId, catatan: body.catatan
    }, (row) => {
      const product = items.find((item) => item.id === row.produkId);
      const variant = product?.varian.find((candidate) => candidate.id === row.varianId);
      if (!product || !variant) return null;
      return {
        produkId: row.produkId, varianId: row.varianId, nama: product.nama,
        tipeModel: variant.tipeModel || product.tipeModel, kodeSKU: variant.kodeSKU,
        nomorIzinEdar: variant.nomorIzinEdar || product.nomorIzinEdar, satuan: variant.satuan
      };
    });
    res.status(result.created ? 201 : 200).json({ order: result.order, cart: store!.getCart(req.customerAuth!.account.id) });
  }));
  router.post('/pesanan/:id/batal', handle((req, res) => {
    const body = fields(req.body, ['alasan']);
    res.json({ order: store!.cancelOrderByCustomer(req.customerAuth!.account.id, req.params.id, body.alasan) });
  }));
  router.patch('/profil', handle((req, res) => {
    const input = profile(fields(req.body, ['nama', 'telepon', 'perusahaan']));
    res.json({ account: store!.updateProfile(req.customerAuth!.account.id, input) });
  }));
  router.post('/auth/keluar-semua', handle(async (req, res) => {
    const customer = req.customerAuth!;
    if (customer.developer) throw new CustomerError(409, 'DEVELOPER_SESSION', 'Akses developer mengikuti sesi ERP. Keluar melalui ERP.');
    store!.revokeAll(customer.account.id);
    customerCookie(req, res, '', origin);
    await identity.revoke(customer.uid);
    res.json({ ok: true });
  }));
  router.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', pesan: 'Fitur customer tidak ditemukan.' }));
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof CustomerError) return res.status(error.status).json({ error: error.code, pesan: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'INVALID_JSON', pesan: 'JSON tidak valid.' });
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', pesan: 'Permintaan terlalu besar.' });
    }
    console.error('[customer-portal] Operasi gagal; periksa penyimpanan server.', error);
    return res.status(503).json({ error: 'PORTAL_UNAVAILABLE', pesan: 'Perubahan belum dapat dipastikan tersimpan. Coba lagi atau hubungi tim kami.' });
  });
  return router;
}
