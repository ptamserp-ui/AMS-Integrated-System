import express, { type Request, type RequestHandler, type Response, type NextFunction } from 'express';
import { CustomerError, ServerCustomerStore } from './customerStore';
import { requireCustomerOrigin } from './customerRoutes';

export interface B2BCustomerReference {
  id: string;
  nama: string;
  status: 'Aktif' | 'Non-aktif';
  /** Optional portal email recorded on the B2B master; used only to suggest a link for staff confirmation. */
  email?: string;
}

function fields(body: unknown, allowed: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new CustomerError(400, 'INVALID_FIELDS', 'Kolom permintaan tidak diizinkan.');
  }
  return body as Record<string, unknown>;
}

export function createCustomerErpRouter(options: {
  store: ServerCustomerStore | null;
  origin?: string;
  requireView: RequestHandler;
  requireUpdate: RequestHandler;
  findB2BCustomers: (id: string) => B2BCustomerReference[];
  listB2BCustomers?: () => B2BCustomerReference[];
}) {
  const router = express.Router();
  const sameOrigin = requireCustomerOrigin(options.origin);
  const parseBody = express.json({ limit: '16kb' });
  const store = () => {
    if (!options.store) throw new CustomerError(404, 'PORTAL_NONAKTIF', 'Customer Portal belum diaktifkan.');
    return options.store;
  };
  const handle = (handler: (req: Request, res: Response) => unknown) =>
    (req: Request, res: Response, next: NextFunction) => {
      try { handler(req, res); } catch (error) { next(error); }
    };

  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/customers', options.requireView, (_req, res) => {
    const items = store().listCustomersForStaff();
    const linked = new Set(items.map((customer) => customer.pelangganId).filter(Boolean));
    const byEmail = new Map<string, B2BCustomerReference[]>();
    for (const b2b of options.listB2BCustomers?.() ?? []) {
      const email = b2b.email?.trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, [...(byEmail.get(email) ?? []), b2b]);
    }
    res.json({
      items: items.map((customer) => {
        if (customer.pelangganId || customer.status === 'ditangguhkan') return customer;
        const matches = byEmail.get(customer.email.toLowerCase()) ?? [];
        // Suggest only an unambiguous, active, unlinked match; staff must confirm through /tautkan.
        const match = matches.length === 1 && matches[0].status === 'Aktif' && !linked.has(matches[0].id) ? matches[0] : null;
        return match ? { ...customer, saranB2B: { id: match.id, nama: match.nama } } : customer;
      })
    });
  });
  router.post('/customers/:id/tautkan', options.requireUpdate, sameOrigin, parseBody, handle((req, res) => {
    const body = fields(req.body, ['pelangganId']);
    if (typeof body.pelangganId !== 'string' || !body.pelangganId.trim() || body.pelangganId.length > 100) {
      throw new CustomerError(400, 'INVALID_B2B_ID', 'Pelanggan B2B wajib dipilih.');
    }
    const matches = options.findB2BCustomers(body.pelangganId);
    if (matches.length !== 1) throw new CustomerError(404, 'B2B_CUSTOMER_NOT_FOUND', 'Master pelanggan B2B tidak ditemukan atau tidak unik.');
    if (matches[0].status !== 'Aktif') throw new CustomerError(409, 'B2B_CUSTOMER_INACTIVE', 'Akun hanya dapat ditautkan ke pelanggan B2B berstatus Aktif.');
    const actor = req.auth?.user.username;
    if (!actor) throw new CustomerError(401, 'UNAUTHORIZED', 'Sesi staf tidak valid.');
    res.json({ customer: store().linkCustomerToB2B(req.params.id, matches[0].id, actor) });
  }));
  router.post('/customers/:id/tangguhkan', options.requireUpdate, sameOrigin, parseBody, handle((req, res) => {
    fields(req.body, []);
    const actor = req.auth?.user.username;
    if (!actor) throw new CustomerError(401, 'UNAUTHORIZED', 'Sesi staf tidak valid.');
    res.json({ customer: store().suspendCustomer(req.params.id, actor) });
  }));
  router.get('/pesanan', options.requireView, (_req, res) => {
    res.json({ items: store().listOrdersForStaff() });
  });
  router.post('/pesanan/:id/batalkan', options.requireUpdate, sameOrigin, parseBody, handle((req, res) => {
    const body = fields(req.body, ['alasan']);
    const actor = req.auth?.user.username;
    if (!actor) throw new CustomerError(401, 'UNAUTHORIZED', 'Sesi staf tidak valid.');
    res.json({ order: store().cancelOrderByStaff(req.params.id, body.alasan, actor) });
  }));
  router.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', pesan: 'Endpoint ERP Portal tidak ditemukan.' }));
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof CustomerError) return res.status(error.status).json({ error: error.code, pesan: error.message });
    const parserType = error && typeof error === 'object' && 'type' in error ? error.type : undefined;
    if (parserType === 'entity.parse.failed') return res.status(400).json({ error: 'INVALID_JSON', pesan: 'Isi permintaan bukan JSON valid.' });
    if (parserType === 'entity.too.large') return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', pesan: 'Payload terlalu besar.' });
    console.error('[customer-erp-portal] Operasi staf gagal.', error);
    return res.status(503).json({ error: 'PORTAL_UNAVAILABLE', pesan: 'Perubahan belum dapat dipastikan tersimpan.' });
  });
  return router;
}
