if (typeof (globalThis as any).__dirname !== 'undefined') {
  delete (globalThis as any).__dirname;
}

import http from 'http';
import crypto from 'crypto';
import compression from 'compression';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { getFirebaseBootstrapAdmins, RBAC_RESOURCES, ServerRbacStore } from './server/rbacStore';
import {
  clearSessionCookie,
  createRbacMiddleware,
  getClientIp,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  type AuthContext
} from './server/rbacMiddleware';
import {
  canDeleteMedia,
  canDeleteSyncKey,
  canUploadMedia,
  canReadSyncKey,
  canWriteSyncKey,
  filterSyncValueForRole,
  isHrisPersonalSyncKey,
  isLegacyRbacSyncKey,
  isValidSyncKey,
  mapSyncKeyToResource,
  mergeSelfServiceSyncValue,
  mergeCatalogIntoDraftConfig,
  mergeCatalogIntoPublishedSnapshot,
  PUBLIC_SYNC_KEYS,
  ServerDataSyncStore,
  validateHrisReplacement
} from './server/dataSyncStore';
import { ActiveDbDriver, PocketBaseArchiveConfig, ServerDbDriverManager } from './server/dbDriverManager';
import { resolveFirebaseClientConfig, type FirebaseClientConfig } from './src/services/firebaseConfig';
import { buatIdentitasSinkronisasi, HEADER_IDENTITAS_SYNC } from './src/utils/identitasSinkronisasi';
import { adalahKonfigurasiSitus } from './src/utils/websitePrimitives';
import type { RoleDefinition } from './src/types/index';
import { loadDeploymentEnv, resolveDeploymentEnvironment } from './server/envLoader';
import { buildWindowsDeploymentGuides } from './server/deploymentGuides';
import { WebsiteTranslationError, WebsiteTranslationService } from './server/websiteTranslation';
import { buatProspekWebsite, KUNCI_RFQ_WEBSITE, samaPermintaanWebsite } from './server/websiteRfq';
import type { ProspekAlkes } from './src/types';
import {
  encodeImageDataUrl,
  isValidMediaId,
  ServerMediaStore,
  type MediaVisibility,
  type StoredMediaMeta
} from './server/mediaStore';
import {
  getFirebaseAdminDb,
  getFirebaseAdminStatus,
  initializeFirebaseAdmin,
  isAiStudioPreviewRuntime,
  validateVpsFirebaseConfig,
  verifyFirebaseAdminFirestoreConnection,
  verifyIdTokenViaAdmin,
  type VpsFirebaseValidationResult
} from './server/firebaseAdmin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDeploymentEnv(__dirname);

const DATA_DIR = path.resolve(process.env.AMS_DATA_DIR?.trim() || path.resolve(__dirname, 'data'));
const BERKAS_SNAPSHOT = path.join(DATA_DIR, 'website-published.json');
const BERKAS_SNAPSHOT_STATIS = path.resolve(__dirname, 'public', 'website-published.json');
const BERKAS_INDEKS = path.resolve(__dirname, 'index.html');
const rbacStore = new ServerRbacStore(DATA_DIR);
const dataSyncStore = new ServerDataSyncStore(DATA_DIR);
const SELF_SERVICE_ROLE_IDS = new Set(['karyawan', 'sales_medrep', 'sales_manager']);
const getEmployeeRecord = (employeeId: string): Record<string, unknown> | undefined => {
  const employees = dataSyncStore.getEntry('hris_karyawan')?.value;
  if (!Array.isArray(employees)) return undefined;
  const matches = employees.filter(
    (employee): employee is Record<string, unknown> =>
      Boolean(employee && typeof employee === 'object' &&
        (employee as { id?: unknown }).id === employeeId)
  );
  return matches.length === 1 ? matches[0] : undefined;
};
const employeeRecordExists = (employeeId: string): boolean => {
  const employee = getEmployeeRecord(employeeId);
  return typeof employee?.nama === 'string' && employee.nama.trim().length > 0;
};
const verifiedEmployeeId = (auth: AuthContext): string | undefined => {
  if (!SELF_SERVICE_ROLE_IDS.has(auth.role.id)) return undefined;
  const employeeId = auth.user.employeeId;
  if (!employeeId || !employeeRecordExists(employeeId)) return undefined;
  const linkedUsers = rbacStore.listAllUsersForCloudSync().filter((user) => user.employeeId === employeeId);
  return linkedUsers.length === 1 && linkedUsers[0].id === auth.user.id ? employeeId : undefined;
};
const mediaStore = new ServerMediaStore(DATA_DIR);
mediaStore.migrateLegacyMediaEntries(dataSyncStore.getEntry('website_media_v1')?.value, 'startup-migration');
const dbDriverManager = new ServerDbDriverManager(DATA_DIR, __dirname);
const websiteTranslationService = new WebsiteTranslationService(DATA_DIR);
const { attachAuth, requireAuth, requirePermission } = createRbacMiddleware(rbacStore);

function rejectStaleSyncIdentity(req: express.Request, res: express.Response): boolean {
  const expected = req.get(HEADER_IDENTITAS_SYNC);
  if (!expected) return false;
  const auth = req.auth!;
  const current = buatIdentitasSinkronisasi(
    auth.user.id, auth.role.id, auth.role.permissions, auth.user.employeeId
  );
  if (expected === encodeURIComponent(current)) return false;
  res.status(409).json({
    error: 'SYNC_IDENTITY_CHANGED',
    pesan: 'Identitas atau hak akses telah berubah. Perubahan offline ditahan; hubungi administrator.'
  });
  return true;
}

function readFirebaseClientConfig(): FirebaseClientConfig | null {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Partial<FirebaseClientConfig>;
    const defaultConfig: FirebaseClientConfig = {
      apiKey: parsed.apiKey || '',
      authDomain: parsed.authDomain || '',
      projectId: parsed.projectId || '',
      storageBucket: parsed.storageBucket || '',
      messagingSenderId: parsed.messagingSenderId || '',
      appId: parsed.appId || '',
      firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)'
    };
    const config = resolveFirebaseClientConfig(
      {
        VITE_DEPLOYMENT_ENV: process.env.VITE_DEPLOYMENT_ENV || process.env.DEPLOYMENT_ENV,
        VITE_FORCE_STAGING_IN_PREVIEW: process.env.VITE_FORCE_STAGING_IN_PREVIEW,
        VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_EXPECTED_PROJECT_ID: process.env.VITE_FIREBASE_EXPECTED_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
        VITE_FIRESTORE_DATABASE_ID: process.env.VITE_FIRESTORE_DATABASE_ID
      },
      defaultConfig,
      { isAiStudioPreview: isAiStudioPreviewRuntime(process.env) }
    );
    if (!config.apiKey || !config.projectId) return null;
    return config;
  } catch (error) {
    console.error('[Firebase] Konfigurasi client tidak valid:', error);
    return null;
  }
}

/**
 * Memvalidasi keberadaan FIREBASE_SERVICE_ACCOUNT_JSON (dan sumber kredensial VPS lainnya)
 * serta memuat FIRESTORE_DATABASE_ID secara konsisten ke environment runtime agar koneksi
 * ke database Firestore yang dipilih oleh konfigurasi deployment tetap stabil di VPS.
 */
function validasiDanMuatFirebaseVps(emitLog = false): VpsFirebaseValidationResult {
  const hasil = validateVpsFirebaseConfig({
    rootDir: __dirname
  });

  if (!process.env.FIRESTORE_DATABASE_ID?.trim()) {
    process.env.FIRESTORE_DATABASE_ID = hasil.firestoreDatabaseId;
  }
  if (!process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim()) {
    process.env.FIREBASE_FIRESTORE_DATABASE_ID = hasil.firestoreDatabaseId;
  }

  if (emitLog) {
    console.log(
      `[Firebase VPS Validator] env=${hasil.isVpsRuntime ? 'VPS/Server' : 'AI-Studio-Preview'}, FIREBASE_SERVICE_ACCOUNT_JSON=${hasil.serviceAccountJsonStatus}, sumberKredensial=${hasil.credentialSource}, FIRESTORE_DATABASE_ID=${hasil.firestoreDatabaseId} (${hasil.databaseIdSource}), siapKoneksiStabil=${hasil.readyForStableConnection}`
    );
    for (const warning of hasil.warnings) {
      console.warn(`[Firebase VPS Validator][PERINGATAN] ${warning}`);
    }
    for (const err of hasil.errors) {
      console.error(`[Firebase VPS Validator][GALAT] ${err}`);
    }
  }

  return hasil;
}

async function verifyFirebaseIdToken(idToken: string): Promise<
  | { ok: true; uid: string; email: string; emailVerified: boolean; displayName: string }
  | { ok: false; message: string }
> {
  // Prioritaskan verifikasi lokal/resmi via Firebase Admin SDK jika Service Account aktif di server/VPS
  const adminVerified = await verifyIdTokenViaAdmin(idToken);
  if (adminVerified.ok) {
    return adminVerified;
  }
  if (!adminVerified.fallbackToRest) {
    return { ok: false, message: adminVerified.message };
  }

  const cfg = readFirebaseClientConfig();
  if (!cfg?.apiKey) {
    return { ok: false, message: 'Konfigurasi Firebase belum tersedia di server.' };
  }
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );
    if (!res.ok) {
      return { ok: false, message: 'Token Firebase tidak valid atau sudah kedaluwarsa.' };
    }
    const payload = (await res.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const u = payload.users?.[0];
    if (!u?.localId || !u.email) {
      return { ok: false, message: 'Akun Firebase tidak memiliki alamat email yang sah.' };
    }
    if (!u.emailVerified) {
      return { ok: false, message: 'Email akun Google belum terverifikasi.' };
    }
    return {
      ok: true,
      uid: u.localId,
      email: u.email.trim().toLowerCase(),
      emailVerified: true,
      displayName: u.displayName || u.email
    };
  } catch {
    return { ok: false, message: 'Gagal memverifikasi token Firebase ke layanan identitas Google.' };
  }
}

function bacaSnapshot(): Record<string, any> | null {
  try {
    if (dataSyncStore.hasKey('website_published')) {
      const tersimpan = dataSyncStore.getEntry('website_published')?.value;
      if (adalahKonfigurasiSitus(tersimpan)) return tersimpan;
      console.error('[website] Snapshot pada penyimpanan server tidak valid.');
      return null;
    }
    const target = fs.existsSync(BERKAS_SNAPSHOT)
      ? BERKAS_SNAPSHOT
      : fs.existsSync(BERKAS_SNAPSHOT_STATIS)
        ? BERKAS_SNAPSHOT_STATIS
        : null;
    if (!target) return null;
    const isi = JSON.parse(fs.readFileSync(target, 'utf8')) as unknown;
    if (adalahKonfigurasiSitus(isi)) return isi;
    console.error('[website] Berkas snapshot tidak valid:', target);
    return null;
  } catch (error) {
    console.error('[website] Snapshot tidak dapat dibaca.', error);
    return null;
  }
}

function tulisSalinanSnapshot(snapshot: unknown): boolean {
  try {
    const serialized = JSON.stringify(snapshot, null, 2);
    fs.mkdirSync(path.dirname(BERKAS_SNAPSHOT), { recursive: true });
    fs.writeFileSync(BERKAS_SNAPSHOT, serialized, 'utf8');
    fs.mkdirSync(path.dirname(BERKAS_SNAPSHOT_STATIS), { recursive: true });
    fs.writeFileSync(BERKAS_SNAPSHOT_STATIS, serialized, 'utf8');
    return true;
  } catch (error) {
    console.error('[website] Snapshot tersimpan, tetapi salinan berkas gagal diperbarui.', error);
    return false;
  }
}

const PERINGATAN_SALINAN_SNAPSHOT =
  'Snapshot server tersimpan, tetapi salinan berkas untuk hosting statis gagal diperbarui.';

function serialisasiJsonAmanUntukHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function suntikSnapshotPublik(html: string, snapshot: Record<string, any> | null): string {
  if (!snapshot) return html;
  const payload = serialisasiJsonAmanUntukHtml(snapshot);
  return html.replace(
    '</head>',
    `<script>window.__AMS_PUBLIC_SITE__=${payload};</script>\n</head>`
  );
}

/** Ganti judul tab, meta description, dan tautan kanonik halaman /web sesuai konten terbit. */
function suntikSeo(html: string, snapshot: Record<string, any> | null): string {
  if (!snapshot) return html;
  const judul = String(snapshot.identitas.judulSitus || snapshot.identitas.nama).replace(/</g, '&lt;');
  const deskripsi = String(snapshot.identitas.metaDeskripsi || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${judul}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${deskripsi}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${judul}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${deskripsi}$2`)
    .replace(
      '</head>',
      `<link rel="canonical" href="${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/web" />\n</head>`
    );
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(compression({ threshold: 1024 }));
  app.use(attachAuth);
  const httpServer = http.createServer(app);
  // Dev server di AI Studio harus berjalan di port 3000 (PORT=8080 digunakan nginx internal)
  const PORT = process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000;

  // Validasi keberadaan FIREBASE_SERVICE_ACCOUNT_JSON & muat FIRESTORE_DATABASE_ID untuk stabilitas koneksi VPS
  validasiDanMuatFirebaseVps(true);

  // Inisialisasi Firebase Admin SDK untuk koneksi server-to-server aman ke named Firestore database
  const adminInitStatus = initializeFirebaseAdmin({ rootDir: __dirname });
  if (adminInitStatus.initialized) {
    console.log(
      `[Firebase Admin SDK] Terinisialisasi (project=${adminInitStatus.projectId}, databaseId=${adminInitStatus.databaseId}, sumber=${adminInitStatus.credentialSource})`
    );
    void verifyFirebaseAdminFirestoreConnection(8000, 3).then((verified) => {
      if (verified.connected) {
        console.log(
          `[Firebase Admin SDK] Koneksi Firestore "${verified.databaseId}" terverifikasi (${verified.latencyMs} ms, koleksi akar=${verified.collectionCount ?? 0}).`
        );
      } else if (verified.lastError) {
        console.warn(
          `[Firebase Admin SDK] Verifikasi awal Firestore "${verified.databaseId}" gagal: ${verified.lastError}`
        );
      }
    });
  } else {
    console.warn(
      `[Firebase Admin SDK] Mode fallback aktif (databaseId=${adminInitStatus.databaseId}): ${adminInitStatus.lastError || 'kredensial belum diatur'}`
    );
  }

  // Bootstrap website_published ke dataSyncStore jika sudah ada snapshot di disk
  if (!dataSyncStore.hasKey('website_published')) {
    const initialSnapshot = bacaSnapshot();
    if (initialSnapshot) {
      dataSyncStore.setKey('website_published', initialSnapshot, 'system');
    }
  }

  // Real-time WebSocket hub (/api/sync/ws) untuk sinkronisasi lintas user & perangkat
  interface SyncWsClient {
    ws: WebSocket;
    isAuthenticated: boolean;
    token?: string;
    sessionId?: string;
    userId?: string;
    username?: string;
    isAlive: boolean;
  }
  const syncClients = new Set<SyncWsClient>();
  const syncWss = new WebSocketServer({ noServer: true });

  const extractWsToken = (req: http.IncomingMessage): string | null => {
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      const qp = parsed.searchParams.get('token');
      if (qp && qp.trim()) return qp.trim();
    } catch {
      /* ignore */
    }
    const rawCookie = req.headers.cookie || '';
    for (const part of rawCookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      if (part.slice(0, eq).trim() === SESSION_COOKIE_NAME) {
        try {
          return decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
          return part.slice(eq + 1).trim();
        }
      }
    }
    return null;
  };

  syncWss.on('connection', (ws, req) => {
    const token = extractWsToken(req);
    const resolved = token ? rbacStore.resolveToken(token) : null;
    const client: SyncWsClient = {
      ws,
      isAuthenticated: Boolean(resolved),
      token: resolved ? token || undefined : undefined,
      sessionId: resolved?.session.id,
      userId: resolved?.user.id,
      username: resolved?.user.username,
      isAlive: true
    };
    syncClients.add(client);

    ws.on('pong', () => {
      client.isAlive = true;
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg?.type === 'sync:auth' && typeof msg.token === 'string') {
          const auth = msg.token ? rbacStore.resolveToken(msg.token) : null;
          client.isAuthenticated = Boolean(auth);
          client.token = auth ? msg.token : undefined;
          client.sessionId = auth?.session.id;
          client.userId = auth?.user.id;
          client.username = auth?.user.username;
          ws.send(JSON.stringify({
            type: 'sync:hello',
            authenticated: client.isAuthenticated,
            revision: dataSyncStore.getRevision()
          }));
        }
      } catch {
        /* abaikan frame tidak valid */
      }
    });
    ws.on('close', () => {
      syncClients.delete(client);
    });
    ws.on('error', () => {
      syncClients.delete(client);
    });

    ws.send(JSON.stringify({
      type: 'sync:hello',
      authenticated: client.isAuthenticated,
      revision: dataSyncStore.getRevision()
    }));
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of syncClients) {
      if (!client.isAlive) {
        client.ws.terminate();
        syncClients.delete(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        syncClients.delete(client);
      }
    }
  }, 30_000);
  httpServer.on('close', () => clearInterval(heartbeatInterval));

  const broadcastMessage = (payload: Record<string, unknown>, publicAllowed: boolean) => {
    const serialized = JSON.stringify(payload);
    for (const client of syncClients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      if (!publicAllowed && !client.isAuthenticated) continue;
      try {
        client.ws.send(serialized);
      } catch {
        /* abaikan socket gagal kirim */
      }
    }
  };

  const notifySelfServiceScopeChanged = (client: SyncWsClient, auth: AuthContext) => {
    if (!SELF_SERVICE_ROLE_IDS.has(auth.role.id)) return;
    try {
      client.ws.send(JSON.stringify({ type: 'rbac:updated', at: new Date().toISOString() }));
    } catch {
      syncClients.delete(client);
    }
  };

  const broadcastSyncUpdate = (
    key: string,
    entry: { value: unknown; version: number; updatedAt: string; updatedBy: string },
    revision: number,
    sourceClientId?: string
  ) => {
    for (const client of syncClients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      if (PUBLIC_SYNC_KEYS.has(key)) {
        try {
          client.ws.send(JSON.stringify({
            type: 'sync:update',
            key,
            value: entry.value,
            version: entry.version,
            updatedAt: entry.updatedAt,
            updatedBy: entry.updatedBy,
            revision,
            sourceClientId: sourceClientId || null
          }));
        } catch {
          syncClients.delete(client);
        }
        continue;
      }
      const auth = client.token ? rbacStore.resolveToken(client.token) : null;
      if (!auth) {
        client.isAuthenticated = false;
        client.token = undefined;
        continue;
      }
      if (key === 'hris_karyawan') notifySelfServiceScopeChanged(client, auth);
      const employeeId = isHrisPersonalSyncKey(key) ? verifiedEmployeeId(auth) : undefined;
      const value = filterSyncValueForRole(auth.role, key, entry.value, employeeId);
      if (value === undefined) continue;
      try {
        client.ws.send(JSON.stringify({
          type: 'sync:update',
          key,
          value,
          version: entry.version,
          updatedAt: entry.updatedAt,
          updatedBy: entry.updatedBy,
          revision,
          sourceClientId: sourceClientId || null
        }));
      } catch {
        syncClients.delete(client);
      }
    }
  };

  const broadcastSyncDelete = (key: string, revision: number, sourceClientId?: string) => {
    for (const client of syncClients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      if (!PUBLIC_SYNC_KEYS.has(key)) {
        const auth = client.token ? rbacStore.resolveToken(client.token) : null;
        if (!auth) {
          client.isAuthenticated = false;
          client.token = undefined;
          continue;
        }
        if (key === 'hris_karyawan') notifySelfServiceScopeChanged(client, auth);
        const employeeId = isHrisPersonalSyncKey(key) ? verifiedEmployeeId(auth) : undefined;
        if (!canReadSyncKey(auth.role, key, employeeId)) continue;
      }
      try {
        client.ws.send(JSON.stringify({
          type: 'sync:delete',
          key,
          revision,
          sourceClientId: sourceClientId || null
        }));
      } catch {
        syncClients.delete(client);
      }
    }
  };

  const broadcastSyncBatch = (
    updated: Record<string, { value: unknown; version: number; updatedAt: string; updatedBy: string }>,
    deleted: string[],
    revision: number,
    sourceClientId?: string
  ) => {
    const publicUpdated: Record<string, { value: unknown; version: number; updatedAt: string; updatedBy: string }> = {};
    for (const [k, v] of Object.entries(updated)) {
      if (PUBLIC_SYNC_KEYS.has(k)) publicUpdated[k] = v;
    }
    const publicDeleted = deleted.filter((k) => PUBLIC_SYNC_KEYS.has(k));
    const hasPublicChanges = Object.keys(publicUpdated).length > 0 || publicDeleted.length > 0;

    const publicPayload = hasPublicChanges
      ? JSON.stringify({
          type: 'sync:batch-update',
          entries: publicUpdated,
          deleted: publicDeleted,
          revision,
          sourceClientId: sourceClientId || null
        })
      : null;

    for (const client of syncClients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      const auth = client.token ? rbacStore.resolveToken(client.token) : null;
      if (!auth) {
        client.isAuthenticated = false;
        client.token = undefined;
      }
      const permittedEntries: typeof updated = {};
      const permittedDeleted: string[] = [];
      if (auth) {
        if (updated.hris_karyawan || deleted.includes('hris_karyawan')) {
          notifySelfServiceScopeChanged(client, auth);
        }
        const employeeId = verifiedEmployeeId(auth);
        for (const [key, entry] of Object.entries(updated)) {
          if (PUBLIC_SYNC_KEYS.has(key)) {
            permittedEntries[key] = entry;
            continue;
          }
          const value = filterSyncValueForRole(auth.role, key, entry.value, employeeId);
          if (value !== undefined) permittedEntries[key] = { ...entry, value };
        }
        for (const key of deleted) {
          if (PUBLIC_SYNC_KEYS.has(key) || canReadSyncKey(auth.role, key, employeeId)) {
            permittedDeleted.push(key);
          }
        }
      }
      const hasPermittedChanges = Object.keys(permittedEntries).length > 0 || permittedDeleted.length > 0;
      const msg = auth && hasPermittedChanges
        ? JSON.stringify({
            type: 'sync:batch-update',
            entries: permittedEntries,
            deleted: permittedDeleted,
            revision,
            sourceClientId: sourceClientId || null
          })
        : auth
          ? null
          : publicPayload;
      if (!msg) continue;
      try {
        client.ws.send(msg);
      } catch {
        /* abaikan socket gagal kirim */
      }
    }
  };

  const broadcastRbacUpdated = () => {
    const nowIso = new Date().toISOString();
    const updatedPayload = JSON.stringify({ type: 'rbac:updated', at: nowIso });
    const revokedPayload = JSON.stringify({ type: 'rbac:session-revoked', at: nowIso });
    const setupPayload = JSON.stringify({
      type: 'rbac:setup-updated',
      needsSetup: rbacStore.needsInitialSetup(),
      at: nowIso
    });
    for (const client of syncClients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      try {
        if (client.isAuthenticated) {
          if (!client.sessionId || !rbacStore.resolveSessionById(client.sessionId)) {
            client.isAuthenticated = false;
            client.token = undefined;
            client.sessionId = undefined;
            client.userId = undefined;
            client.username = undefined;
            client.ws.send(revokedPayload);
          } else {
            client.ws.send(updatedPayload);
          }
        } else {
          client.ws.send(setupPayload);
        }
      } catch {
        /* abaikan socket gagal kirim */
      }
    }
  };

  const broadcastRbacActivity = () => {
    broadcastMessage({ type: 'rbac:activity', at: new Date().toISOString() }, false);
  };

  const PB_COLLECTION_PATH = /^\/api\/collections\/([A-Za-z0-9_-]+)\/records\/?$/;
  const isHrisMediaScope = (scope: string) => scope === 'hrd-pelatihan' || isHrisPersonalSyncKey(scope);
  const mediaScopeResource = (scope: string) =>
    RBAC_RESOURCES.find((resource) => resource.id === scope)?.id ??
    (mapSyncKeyToResource(scope) === 'overview' ? undefined : mapSyncKeyToResource(scope));
  const canReadInternalMedia = (role: RoleDefinition, scope: string): boolean => {
    if (role.id === 'developer_it_support') return true;
    if (isHrisMediaScope(scope)) {
      return canReadSyncKey(role, 'hris_karyawan');
    }
    const resource = mediaScopeResource(scope);
    return Boolean(resource && role.permissions[resource]?.includes('view'));
  };
  const canWriteMediaScope = (role: RoleDefinition, scope: string, operation: 'upload' | 'delete'): boolean => {
    if (role.id === 'developer_it_support') return true;
    const resource = mediaScopeResource(scope);
    if (!resource) return false;
    if (isHrisMediaScope(scope)) {
      if (!canReadSyncKey(role, 'hris_karyawan')) return false;
    }
    const permissions = role.permissions[resource] || [];
    return operation === 'upload'
      ? permissions.includes('create') || permissions.includes('update') || permissions.includes('publish')
      : permissions.includes('delete') || permissions.includes('update') || permissions.includes('publish');
  };
  const pbProxy = createProxyMiddleware({
    target: dbDriverManager.getPocketBaseUrl(),
    changeOrigin: true,
    pathRewrite: { '^/api/ams-pb': '' }
  });
  app.use('/api/ams-pb', (req, res, next) => {
    if (dbDriverManager.getActiveDriver() !== 'pocketbase') {
      return res.status(503).json({
        mode: dbDriverManager.getActiveDriver(),
        archived: true,
        pesan:
          'Database aktif berada pada mode Firebase Firestore (fase pengembangan). Pengaturan PocketBase aman diarsipkan dan dapat diaktifkan kembali kapan saja.'
      });
    }
    if (req.method !== 'GET') {
      return res.status(403).json({ pesan: 'Penulisan langsung ke PocketBase tidak diizinkan lewat proxy.' });
    }
    if (req.path === '/api/health' || req.path === '/api/health/') return next();
    if (!req.auth) {
      return res.status(401).json({ error: 'UNAUTHORIZED', pesan: 'Autentikasi diperlukan untuk membaca PocketBase.' });
    }
    if (req.path === '/api/realtime' || req.path === '/api/realtime/') {
      return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Realtime PocketBase tidak tersedia karena event tidak dapat dibatasi per peran.' });
    }
    const collectionMatch = PB_COLLECTION_PATH.exec(req.path);
    if (!collectionMatch) {
      return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Jalur PocketBase ini tidak diizinkan lewat proxy.' });
    }
    const collection = collectionMatch[1];
    if (
      isHrisPersonalSyncKey(collection) &&
      !canReadSyncKey(req.auth.role, 'hris_karyawan')
    ) {
      return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Akses HRIS melalui PocketBase dibatasi untuk peran HRD, Payroll, Manajemen, dan Developer.' });
    }
    if (!canReadSyncKey(req.auth.role, collection, req.auth.user.employeeId)) {
      return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Peran Anda tidak memiliki hak baca untuk koleksi PocketBase ini.' });
    }
    return next();
  }, pbProxy);

  app.use(express.json({ limit: '10mb' }));

  // Body-parser menolak JSON rusak/payload terlalu besar sebelum rute manapun —
  // balas 400/413 yang bersih, jangan biarkan error merayap ke atas dan menjatuhkan proses.
  app.use(((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ pesan: 'Isi permintaan bukan JSON valid.' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ pesan: 'Payload terlalu besar (maks 10 MB).' });
    }
    next(err);
  }) as express.ErrorRequestHandler);

  // Status and regulatory compliance info
  app.get('/api/health', (req, res) => {
    const fbCfg = readFirebaseClientConfig();
    const envInfo = resolveDeploymentEnvironment();
    res.json({
      status: 'aktif',
      sistem: 'AMS Integrated System - PT Anugrahmitra Selaras',
      versi: '2.4.0-cdakb',
      deploymentEnv: envInfo.deploymentEnv,
      isStaging: envInfo.isStaging,
      standar: ['CDAKB Permenkes 4/2014', 'CPAKB Permenkes 20/2017', 'SDAK OSS-RBA', 'ISO 13485:2016'],
      basisData:
        dbDriverManager.getActiveDriver() === 'firebase'
          ? 'Firebase Firestore (Staging/Dev) + Server Real-Time Sync'
          : 'PocketBase Server + Persistent JSON Store + WebSocket',
      databaseDriver: dbDriverManager.getActiveDriver(),
      pocketbaseArchived: true,
      firebaseProjectId: fbCfg?.projectId || null,
      firebaseAdmin: getFirebaseAdminStatus(),
      firebaseVpsValidation: validasiDanMuatFirebaseVps(false),
      rbacAktif: true,
      realtimeSyncAktif: true,
      needsInitialSetup: rbacStore.needsInitialSetup(),
      syncRevision: dataSyncStore.getRevision(),
      klienTerhubung: syncClients.size,
      waktuServer: new Date().toISOString()
    });
  });

  // ================= AUTENTIKASI & RBAC SERVER-SIDE =================
  app.get('/api/auth/setup-status', (_req, res) => {
    const devReset = rbacStore.getDeveloperResetInfo();
    res.set('Cache-Control', 'no-store').json({
      needsSetup: rbacStore.needsInitialSetup(),
      requiresSetupToken: Boolean((process.env.INITIAL_SETUP_TOKEN || '').trim()),
      needsDeveloperReset: devReset.required,
      developerResetUser: devReset.required
        ? {
            username: devReset.username || 'dev.admin',
            fullName: devReset.fullName || 'Developer & IT Support',
            roleName: devReset.roleName || 'Developer & IT Support'
          }
        : undefined
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    const { username, password, fullName, email, setupToken } = (req.body || {}) as Record<string, string | undefined>;
    const result = rbacStore.bootstrapFirstDeveloper(
      {
        username: String(username || ''),
        password: String(password || ''),
        fullName: String(fullName || ''),
        email,
        setupToken
      },
      getClientIp(req),
      String(req.headers['user-agent'] || '')
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: 'SETUP_FAILED', pesan: result.message });
    }
    setSessionCookie(req, res, result.token);
    broadcastRbacUpdated();
    res.status(201).json({
      user: result.user,
      role: result.role,
      permissions: result.role.permissions,
      token: result.token,
      expiresAt: result.session.expiresAt
    });
  });

  app.post('/api/auth/reset-developer', (req, res) => {
    const { resetCode, newPassword } = (req.body || {}) as { resetCode?: string; newPassword?: string };
    const result = rbacStore.completeDeveloperPasswordReset(
      {
        resetCode: String(resetCode || ''),
        newPassword: String(newPassword || '')
      },
      getClientIp(req),
      String(req.headers['user-agent'] || '')
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: 'DEV_RESET_FAILED', pesan: result.message });
    }
    setSessionCookie(req, res, result.token);
    broadcastRbacUpdated();
    res.json({
      user: result.user,
      role: result.role,
      permissions: result.role.permissions,
      token: result.token,
      expiresAt: result.session.expiresAt
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = (req.body || {}) as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', pesan: 'Nama pengguna dan kata sandi wajib diisi.' });
    }
    const result = rbacStore.authenticate(
      username,
      password,
      getClientIp(req),
      String(req.headers['user-agent'] || '')
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: 'AUTH_FAILED', pesan: result.message });
    }
    setSessionCookie(req, res, result.token);
    broadcastRbacActivity();
    res.json({
      user: result.user,
      role: result.role,
      permissions: result.role.permissions,
      token: result.token,
      expiresAt: result.session.expiresAt
    });
  });

  app.post('/api/auth/firebase-login', async (req, res) => {
    const { idToken } = (req.body || {}) as { idToken?: string };
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'BAD_REQUEST', pesan: 'Token autentikasi Firebase wajib disertakan.' });
    }
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified.ok) {
      return res.status(401).json({ error: 'FIREBASE_AUTH_FAILED', pesan: verified.message });
    }
    const result = rbacStore.authenticateByVerifiedEmail(
      verified.email,
      verified.uid,
      verified.displayName,
      getClientIp(req),
      String(req.headers['user-agent'] || '')
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: 'AUTH_FAILED', pesan: result.message });
    }
    setSessionCookie(req, res, result.token);
    broadcastRbacActivity();
    res.json({
      user: result.user,
      role: result.role,
      permissions: result.role.permissions,
      token: result.token,
      expiresAt: result.session.expiresAt
    });
  });

  app.get('/api/firebase/rbac-snapshot', requirePermission('rbac-admin', 'view'), (_req, res) => {
    res.set('Cache-Control', 'no-store').json({
      roles: rbacStore.listRoles(),
      users: rbacStore.listAllUsersForCloudSync()
    });
  });

  app.post('/api/firebase/hydrate', async (req, res) => {
    const body = (req.body || {}) as {
      idToken?: string;
      roles?: any[];
      users?: any[];
      entries?: Record<string, { value: unknown; version?: number; updatedAt?: string; updatedBy?: string }>;
      activeDriver?: ActiveDbDriver;
      pocketbaseArchive?: Partial<PocketBaseArchiveConfig>;
    };

    let actorUsername = req.auth?.user.username || '';
    let authorized = false;

    if (req.auth) {
      const permsRbac = req.auth.role.permissions['rbac-admin'] || [];
      const permsIt = req.auth.role.permissions['it-traceability'] || [];
      authorized =
        Boolean(req.auth.user.isHiddenDeveloper) ||
        permsRbac.includes('update') ||
        permsIt.includes('update');
    }

    if (!authorized && typeof body.idToken === 'string' && body.idToken.trim()) {
      const verified = await verifyFirebaseIdToken(body.idToken.trim());
      if (verified.ok) {
        const adminEmailSet = getFirebaseBootstrapAdmins();
        const matchedUser = rbacStore.listAllUsersForCloudSync().find(
          (u) => u.email.trim().toLowerCase() === verified.email
        );
        if (
          adminEmailSet.has(verified.email) ||
          matchedUser?.isHiddenDeveloper ||
          matchedUser?.roleId === 'it_admin' ||
          matchedUser?.roleId === 'developer_it_support'
        ) {
          authorized = true;
          actorUsername = verified.email;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: 'Hanya administrator atau developer terverifikasi Firebase yang dapat memulihkan state cloud.'
      });
    }

    if (body.entries && Object.prototype.hasOwnProperty.call(body.entries, 'website_published') &&
        !adalahKonfigurasiSitus(body.entries.website_published?.value)) {
      return res.status(400).json({
        error: 'INVALID_WEBSITE_SNAPSHOT',
        pesan: 'Snapshot website pada cadangan cloud tidak lengkap atau tidak valid. Pemulihan dibatalkan.'
      });
    }

    let syncRes: ReturnType<typeof dataSyncStore.hydrateFromCloud>;
    try {
      syncRes = body.entries ? dataSyncStore.hydrateFromCloud(body.entries) : { appliedKeys: [], revision: dataSyncStore.getRevision() };
    } catch (error) {
      console.error('[firebase-hydrate] Pemulihan data sinkronisasi gagal.', error);
      return res.status(500).json({
        error: 'CLOUD_HYDRATE_FAILED',
        pesan: 'Pemulihan data cloud gagal. Periksa antrean RFQ dan penyimpanan server bersama administrator.'
      });
    }
    const rbacRes = rbacStore.hydrateFromCloud({ roles: body.roles, users: body.users });

    if (body.activeDriver || body.pocketbaseArchive) {
      dbDriverManager.hydrateArchiveFromCloud(body.activeDriver, body.pocketbaseArchive, actorUsername || 'firebase-sync');
    }

    if (syncRes.appliedKeys.includes('website_media_v1') && body.entries?.website_media_v1?.value) {
      mediaStore.migrateLegacyMediaEntries(body.entries.website_media_v1.value, actorUsername || 'firebase-hydrate');
    }

    const peringatanSnapshot = syncRes.appliedKeys.includes('website_published') &&
      !tulisSalinanSnapshot(dataSyncStore.getEntry('website_published')?.value)
      ? PERINGATAN_SALINAN_SNAPSHOT : undefined;

    if (rbacRes.rolesApplied > 0 || rbacRes.usersApplied > 0) {
      broadcastRbacUpdated();
    }
    if (syncRes.appliedKeys.length > 0) {
      const updatedEntries: Record<string, { value: unknown; version: number; updatedAt: string; updatedBy: string }> = {};
      const all = dataSyncStore.getAllState().entries;
      for (const k of syncRes.appliedKeys) {
        if (all[k]) updatedEntries[k] = all[k];
      }
      broadcastSyncBatch(updatedEntries, [], syncRes.revision);
    }

    res.json({
      ok: true,
      rolesApplied: rbacRes.rolesApplied,
      usersApplied: rbacRes.usersApplied,
      entriesApplied: syncRes.appliedKeys.length,
      revision: syncRes.revision,
      ...(peringatanSnapshot ? { peringatan: peringatanSnapshot } : {})
    });
  });

  app.get('/api/system/db-config', (req, res) => {
    const fbCfg = readFirebaseClientConfig();
    const summary = dbDriverManager.getRuntimeSummary();
    const envInfo = resolveDeploymentEnvironment();
    res.set('Cache-Control', 'no-store').json({
      activeDriver: summary.activeDriver,
      deploymentEnv: envInfo.deploymentEnv,
      isStaging: envInfo.isStaging,
      updatedAt: summary.updatedAt,
      updatedBy: summary.updatedBy,
      pocketbaseArchived: summary.pocketbaseArchived,
      pocketbaseUrl: summary.pocketbaseUrl,
      firebase: fbCfg
        ? {
            configured: true,
            projectId: fbCfg.projectId,
            firestoreDatabaseId: fbCfg.firestoreDatabaseId,
            authDomain: fbCfg.authDomain
          }
        : { configured: false },
      firebaseAdmin: getFirebaseAdminStatus(),
      firebaseVpsValidation: validasiDanMuatFirebaseVps(false),
      ...(req.auth ? { pocketbaseArchive: summary.pocketbaseArchive } : {})
    });
  });

  app.post('/api/system/firebase-admin-verify', requirePermission('it-traceability', 'view'), async (_req, res) => {
    const validation = validasiDanMuatFirebaseVps(false);
    initializeFirebaseAdmin({ rootDir: __dirname });
    const status = await verifyFirebaseAdminFirestoreConnection(8000, 3);
    res.set('Cache-Control', 'no-store').json({
      ok: status.connected,
      status,
      validation
    });
  });

  app.post('/api/system/db-driver', requireAuth, (req, res) => {
    const permsIt = req.auth!.role.permissions['it-traceability'] || [];
    const permsRbac = req.auth!.role.permissions['rbac-admin'] || [];
    const boleh =
      Boolean(req.auth!.user.isHiddenDeveloper) ||
      permsRbac.includes('update') ||
      permsIt.includes('update');
    if (!boleh) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: 'Anda tidak memiliki otoritas mengubah driver database sistem.'
      });
    }
    const { driver, pocketbaseUrl } = (req.body || {}) as { driver?: string; pocketbaseUrl?: string };
    if (driver !== 'firebase' && driver !== 'pocketbase') {
      return res.status(400).json({ error: 'BAD_REQUEST', pesan: 'Driver harus bernilai "firebase" atau "pocketbase".' });
    }
    const next = dbDriverManager.switchDriver(driver, req.auth!.user.username, pocketbaseUrl);
    rbacStore.recordAudit({
      actorUsername: req.auth!.user.username,
      actorRole: req.auth!.role.id,
      action: 'DB_DRIVER_SWITCHED',
      resource: 'it-traceability',
      status: 'ALLOWED',
      ip: getClientIp(req),
      detail: `Mode database aktif diubah ke "${driver}". Arsip konfigurasi PocketBase tetap dipertahankan.`
    });
    broadcastMessage({ type: 'system:db-driver', activeDriver: next.activeDriver }, true);
    res.json({ ok: true, ...next });
  });

  app.get('/api/system/migration-bundle', requirePermission('rbac-admin', 'view'), (_req, res) => {
    const appState = dataSyncStore.getAllState();
    const employeeId = verifiedEmployeeId(_req.auth!);
    for (const [key, entry] of Object.entries(appState.entries)) {
      const value = filterSyncValueForRole(
        _req.auth!.role,
        key,
        entry.value,
        employeeId
      );
      if (value === undefined) {
        delete appState.entries[key];
      } else {
        appState.entries[key] = { ...entry, value };
      }
    }
    res.set('Cache-Control', 'no-store').json({
      exportedAt: new Date().toISOString(),
      activeDriver: dbDriverManager.getActiveDriver(),
      pocketbaseArchive: dbDriverManager.getPocketBaseArchive(),
      rbac: {
        roles: rbacStore.listRoles(),
        users: rbacStore.listAllUsersForCloudSync()
      },
      appState
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.auth) {
      const loggedOutSessionId = req.auth.session.id;
      if (!rbacStore.endOwnSession(loggedOutSessionId, req.auth.user.id, getClientIp(req))) {
        return res.status(409).json({ error: 'LOGOUT_FAILED', pesan: 'Sesi tidak dapat dicabut. Silakan coba lagi.' });
      }
      for (const client of syncClients) {
        if (client.sessionId === loggedOutSessionId) {
          client.isAuthenticated = false;
          client.sessionId = undefined;
          client.userId = undefined;
          client.username = undefined;
        }
      }
      broadcastRbacActivity();
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      user: req.auth!.user,
      role: req.auth!.role,
      permissions: req.auth!.role.permissions,
      expiresAt: req.auth!.session.expiresAt
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = (req.body || {}) as { currentPassword?: string; newPassword?: string };
    const result = rbacStore.changeOwnPassword(
      req.auth!.user.id,
      String(currentPassword || ''),
      String(newPassword || ''),
      getClientIp(req)
    );
    if (!result.ok) {
      return res.status(result.status).json({ error: 'CHANGE_PASSWORD_FAILED', pesan: result.message });
    }
    broadcastRbacActivity();
    res.json({ ok: true, pesan: 'Kata sandi berhasil diperbarui di server.' });
  });

  app.get('/api/rbac/metadata', requirePermission('rbac-admin', 'view'), (_req, res) => {
    res.json({
      resources: RBAC_RESOURCES,
      actions: [
        { id: 'view', label: 'Lihat Modul' },
        { id: 'create', label: 'Tambah' },
        { id: 'update', label: 'Ubah' },
        { id: 'delete', label: 'Hapus' },
        { id: 'approve', label: 'Setujui / Rilis' },
        { id: 'publish', label: 'Terbitkan' },
        { id: 'export', label: 'Ekspor' }
      ]
    });
  });

  app.get('/api/rbac/roles', requirePermission('rbac-admin', 'view'), (_req, res) => {
    res.json({ roles: rbacStore.listRoles() });
  });

  app.post('/api/rbac/roles', requirePermission('rbac-admin', 'create'), (req, res) => {
    const { id, name, description, permissions } = (req.body || {}) as Record<string, any>;
    const result = rbacStore.createRole(
      { id: String(id || ''), name: String(name || ''), description: String(description || ''), permissions: permissions || {} },
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!result.ok) return res.status(result.status).json({ error: 'ROLE_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.status(201).json({ role: result.role });
  });

  app.put('/api/rbac/roles/:roleId', requirePermission('rbac-admin', 'update'), (req, res) => {
    const { name, description, permissions } = (req.body || {}) as Record<string, any>;
    const result = rbacStore.updateRole(
      req.params.roleId,
      { name, description, permissions },
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!result.ok) return res.status(result.status).json({ error: 'ROLE_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.json({ role: result.role });
  });

  app.delete('/api/rbac/roles/:roleId', requirePermission('rbac-admin', 'delete'), (req, res) => {
    const result = rbacStore.deleteRole(
      req.params.roleId,
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!result.ok) return res.status(result.status).json({ error: 'ROLE_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.json({ ok: true });
  });

  app.get('/api/rbac/users', requirePermission('rbac-admin', 'view'), (_req, res) => {
    res.json({ users: rbacStore.listUsers() });
  });

  app.post('/api/rbac/users', requirePermission('rbac-admin', 'create'), (req, res) => {
    const { username, fullName, email, employeeId, roleId, department, password, isActive } = (req.body || {}) as Record<string, unknown>;
    const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';
    if (cleanEmployeeId && !employeeRecordExists(cleanEmployeeId)) {
      return res.status(400).json({ error: 'INVALID_EMPLOYEE_LINK', pesan: 'ID karyawan tidak ditemukan di data HRIS.' });
    }
    let result: ReturnType<typeof rbacStore.createUser>;
    try {
      result = rbacStore.createUser(
        {
          username: String(username || ''),
          fullName: String(fullName || ''),
          email: String(email || ''),
          employeeId: cleanEmployeeId,
          roleId: String(roleId || ''),
          department: String(department || ''),
          password: String(password || ''),
          isActive: isActive !== false
        },
        req.auth!.user.username,
        req.auth!.role.id,
        getClientIp(req)
      );
    } catch (error) {
      console.error('[RBAC] Gagal menyimpan akun pengguna di server.', error);
      return res.status(500).json({
        error: 'USER_PERSISTENCE_FAILED',
        pesan: 'Server gagal menyimpan akun ke penyimpanan RBAC. Periksa log layanan server.'
      });
    }
    if (!result.ok) return res.status(result.status).json({ error: 'USER_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.status(201).json({ user: result.user });
  });

  app.put('/api/rbac/users/:userId', requirePermission('rbac-admin', 'update'), (req, res) => {
    const { fullName, email, roleId, department, isActive, newPassword } = (req.body || {}) as Record<string, any>;
    const employeeId = (req.body || {}).employeeId;
    const cleanEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : undefined;
    if (cleanEmployeeId && !employeeRecordExists(cleanEmployeeId)) {
      return res.status(400).json({ error: 'INVALID_EMPLOYEE_LINK', pesan: 'ID karyawan tidak ditemukan di data HRIS.' });
    }
    const result = rbacStore.updateUser(
      req.params.userId,
      { fullName, email, employeeId: cleanEmployeeId, roleId, department, isActive, newPassword },
      req.auth!.user.id,
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!result.ok) return res.status(result.status).json({ error: 'USER_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.json({ user: result.user });
  });

  app.delete('/api/rbac/users/:userId', requirePermission('rbac-admin', 'delete'), (req, res) => {
    const result = rbacStore.deleteUser(
      req.params.userId,
      req.auth!.user.id,
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!result.ok) return res.status(result.status).json({ error: 'USER_ERROR', pesan: result.message });
    broadcastRbacUpdated();
    res.json({ ok: true });
  });

  app.get('/api/rbac/sessions', requirePermission('rbac-admin', 'view'), (req, res) => {
    res.json({ sessions: rbacStore.listActiveSessions(req.auth?.session.id) });
  });

  app.delete('/api/rbac/sessions/:sessionId', requirePermission('rbac-admin', 'delete'), (req, res) => {
    const ok = rbacStore.revokeSession(
      req.params.sessionId,
      req.auth!.user.username,
      req.auth!.role.id,
      getClientIp(req)
    );
    if (!ok) return res.status(404).json({ error: 'SESSION_ERROR', pesan: 'Sesi tidak ditemukan.' });
    broadcastRbacUpdated();
    res.json({ ok: true });
  });

  app.get('/api/rbac/audit', requirePermission('audit-trail', 'view'), (_req, res) => {
    res.json({ logs: rbacStore.getAuditLogs(200) });
  });

  app.post('/api/search/log', requireAuth, (req, res) => {
    const body = (req.body || {}) as {
      query?: unknown;
      allowedCount?: unknown;
      restrictedCount?: unknown;
      activeModule?: unknown;
    };
    const rawQuery = typeof body.query === 'string' ? body.query.replace(/\s+/g, ' ').trim() : '';
    if (!rawQuery || rawQuery.length > 200) {
      return res.status(400).json({ error: 'BAD_REQUEST', pesan: 'Kata kunci pencarian tidak valid.' });
    }
    const allowedCount =
      typeof body.allowedCount === 'number' && Number.isFinite(body.allowedCount) && body.allowedCount >= 0
        ? Math.floor(body.allowedCount)
        : 0;
    const restrictedCount =
      typeof body.restrictedCount === 'number' && Number.isFinite(body.restrictedCount) && body.restrictedCount >= 0
        ? Math.floor(body.restrictedCount)
        : 0;
    const activeModule =
      typeof body.activeModule === 'string' && body.activeModule.trim()
        ? body.activeModule.trim().slice(0, 80)
        : '-';

    const action =
      restrictedCount > 0 && allowedCount === 0
        ? 'GLOBAL_SEARCH_DENIED'
        : restrictedCount > 0
          ? 'GLOBAL_SEARCH_PARTIAL_DENIED'
          : 'GLOBAL_SEARCH';
    const status = restrictedCount > 0 ? 'DENIED' : 'ALLOWED';
    const detail =
      restrictedCount > 0
        ? `Pencarian keyword "${rawQuery}" dari modul ${activeModule}: ${allowedCount} hasil diizinkan, ${restrictedCount} data di modul terbatas (akses ditolak).`
        : `Pencarian keyword "${rawQuery}" dari modul ${activeModule}: ${allowedCount} hasil diizinkan.`;

    const entry = rbacStore.recordAudit({
      actorUsername: req.auth!.user.username,
      actorRole: req.auth!.role.id,
      action,
      resource: 'global-search',
      status,
      ip: getClientIp(req),
      detail
    });

    res.json({ ok: true, id: entry.id, timestamp: entry.timestamp });
  });

  // ================= REAL-TIME SERVER DATA & SETTINGS SYNC =================
  app.get('/api/sync/public-settings', (_req, res) => {
    const publicState = dataSyncStore.getPublicState();
    if (!publicState.entries.website_published) {
      const diskSnapshot = bacaSnapshot();
      if (diskSnapshot) {
        publicState.entries.website_published = {
          value: diskSnapshot,
          version: 1,
          updatedAt: new Date(diskSnapshot.lastPublishedAt || diskSnapshot.lastModifiedAt || Date.now()).toISOString(),
          updatedBy: String(diskSnapshot.lastModifiedBy || 'server')
        };
      }
    }
    res.set('Cache-Control', 'no-store').json(publicState);
  });

  app.get('/api/sync/state', requireAuth, (req, res) => {
    if (rejectStaleSyncIdentity(req, res)) return;
    let sinceMap: Record<string, number> | undefined;
    let knownKeys: string[] = [];
    const rawVersions = req.query.versions;
    const rawKnownKeys = req.query.known;
    if (typeof rawKnownKeys === 'string' && rawKnownKeys.length <= 16_384) {
      try {
        const parsed = JSON.parse(rawKnownKeys) as unknown;
        if (Array.isArray(parsed)) {
          knownKeys = parsed.filter(
            (key): key is string => typeof key === 'string' && isValidSyncKey(key)
          );
        }
      } catch {
        knownKeys = [];
      }
    }
    if (typeof rawVersions === 'string' && rawVersions.trim()) {
      try {
        const parsed = JSON.parse(rawVersions) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          sinceMap = {};
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === 'number' && Number.isFinite(v)) {
              sinceMap[k] = v;
            }
          }
        }
      } catch {
        /* abaikan parameter versions tidak valid dan kembalikan snapshot penuh */
      }
    }
    const state = dataSyncStore.getAllState(sinceMap);
    const employeeId = verifiedEmployeeId(req.auth!);
    for (const [key, entry] of Object.entries(state.entries)) {
      const value = filterSyncValueForRole(req.auth!.role, key, entry.value, employeeId);
      if (value === undefined) {
        delete state.entries[key];
      } else {
        state.entries[key] = { ...entry, value };
      }
    }
    if (
      !sinceMap &&
      employeeId &&
      SELF_SERVICE_ROLE_IDS.has(req.auth!.role.id)
    ) {
      const personalKeys = req.auth!.role.id === 'karyawan'
        ? [
            'hris_karyawan',
            'hris_absensi',
            'hris_cuti',
            'hris_skill_matrix',
            'hris_kpi',
            'hris_umpan_balik_360',
            'hris_apd',
            'hris_mutasi'
          ]
        : ['hris_karyawan', 'hris_absensi', 'hris_cuti'];
      for (const key of personalKeys) {
        if (canReadSyncKey(req.auth!.role, key, employeeId) && !Object.prototype.hasOwnProperty.call(state.entries, key)) {
          state.entries[key] = {
            value: [],
            version: 0,
            updatedAt: new Date(0).toISOString(),
            updatedBy: 'server'
          };
        }
      }
    }
    const relevantKeys = [...new Set([...knownKeys, ...Object.keys(state.entries)])];
    const allowedKeys = relevantKeys.filter((key) => canReadSyncKey(req.auth!.role, key, employeeId));
    const writableKeys = relevantKeys.filter((key) =>
      canWriteSyncKey(req.auth!.role, key) &&
      (!SELF_SERVICE_ROLE_IDS.has(req.auth!.role.id) || !isHrisPersonalSyncKey(key) || Boolean(employeeId))
    );
    const deletableKeys = relevantKeys.filter((key) => canDeleteSyncKey(req.auth!.role, key));
    res.set('Cache-Control', 'no-store').json({ ...state, allowedKeys, writableKeys, deletableKeys });
  });

  app.put('/api/sync/keys/:key', requireAuth, (req, res) => {
    if (rejectStaleSyncIdentity(req, res)) return;
    const { key } = req.params;
    if (isLegacyRbacSyncKey(key)) {
      return res.status(410).json({
        error: 'LEGACY_RBAC_REMOVED',
        pesan: 'Koleksi RBAC lama sudah dihapus. Gunakan manajemen RBAC server.'
      });
    }
    if (!isValidSyncKey(key)) {
      return res.status(400).json({ error: 'INVALID_KEY', pesan: 'Kunci sinkronisasi tidak valid.' });
    }
    if (!canWriteSyncKey(req.auth!.role, key)) {
      const resource = mapSyncKeyToResource(key);
      rbacStore.recordAudit({
        actorUsername: req.auth!.user.username,
        actorRole: req.auth!.role.id,
        action: 'PERMISSION_DENIED',
        resource: `${resource}:${key}`,
        status: 'DENIED',
        ip: getClientIp(req),
        detail: `Permintaan PUT /api/sync/keys/${key} ditolak oleh RBAC server.`
      });
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin menulis data "${key}".`
      });
    }

    const body = (req.body || {}) as { value?: unknown; clientId?: string };
    if (!('value' in body) || body.value === undefined) {
      return res.status(400).json({ error: 'BAD_REQUEST', pesan: 'Field "value" wajib disertakan.' });
    }
    if (key === 'website_published' && !adalahKonfigurasiSitus(body.value)) {
      return res.status(400).json({
        error: 'INVALID_WEBSITE_SNAPSHOT',
        pesan: 'Snapshot website tidak lengkap atau tidak valid; perubahan tidak disimpan.'
      });
    }
    let valueToSave = body.value;
    if (
      SELF_SERVICE_ROLE_IDS.has(req.auth!.role.id) &&
      key.startsWith('hris_')
    ) {
      const employeeId = verifiedEmployeeId(req.auth!);
      if (!employeeId) {
        return res.status(403).json({ error: 'EMPLOYEE_LINK_REQUIRED', pesan: 'Tautan ID karyawan tidak ditemukan atau tidak unik; hubungi admin.' });
      }
      const employeeName = String(getEmployeeRecord(employeeId)?.nama || '');
      const merged = mergeSelfServiceSyncValue(
        key,
        dataSyncStore.getEntry(key)?.value,
        body.value,
        employeeId,
        employeeName
      );
      if (!merged.ok) {
        return res.status(403).json({ error: 'SELF_SERVICE_SCOPE_DENIED', pesan: merged.message });
      }
      valueToSave = merged.value;
    }

    const replacementError = validateHrisReplacement(
      req.auth!.role, key, dataSyncStore.getEntry(key)?.value, valueToSave
    );
    if (replacementError) {
      return res.status(403).json({ error: 'HRIS_REPLACEMENT_DENIED', pesan: replacementError });
    }

    if (key === 'website_media_v1') {
      mediaStore.migrateLegacyMediaEntries(valueToSave, req.auth!.user.username);
    }

    let synced: ReturnType<typeof dataSyncStore.setKey>;
    try {
      synced = dataSyncStore.setKey(key, valueToSave, req.auth!.user.username);
    } catch (error) {
      console.error('[sync] Penyimpanan perubahan gagal.', error);
      return res.status(500).json({ error: 'SYNC_WRITE_FAILED', pesan: 'Perubahan gagal disimpan di server.' });
    }
    const peringatan: string[] = [];
    if (key === 'website_published' && !tulisSalinanSnapshot(valueToSave)) {
      peringatan.push(PERINGATAN_SALINAN_SNAPSHOT);
    }
    let latestRevision = synced.revision;
    const sourceClientId =
      typeof body.clientId === 'string' && body.clientId
        ? body.clientId
        : typeof req.headers['x-sync-client-id'] === 'string'
          ? req.headers['x-sync-client-id']
          : undefined;
    broadcastSyncUpdate(key, synced.entry, synced.revision, sourceClientId);

    // Selaraskan foto/detail produk terbaru dari Product Catalog ke draf & snapshot website terbit secara real-time
    if (key === 'product_catalog') {
      const currentDraft = dataSyncStore.getEntry('website_draft')?.value as Record<string, unknown> | undefined;
      if (currentDraft && adalahKonfigurasiSitus(currentDraft)) {
        const mergedDraft = mergeCatalogIntoDraftConfig(currentDraft, valueToSave, req.auth!.user.fullName);
        if (mergedDraft) {
          const syncedDraft = dataSyncStore.setKey('website_draft', mergedDraft, req.auth!.user.username);
          latestRevision = Math.max(latestRevision, syncedDraft.revision);
          broadcastSyncUpdate('website_draft', syncedDraft.entry, syncedDraft.revision);
        }
      }

      const currentSnapshot =
        (dataSyncStore.getEntry('website_published')?.value as Record<string, unknown> | undefined) ||
        bacaSnapshot();
      if (currentSnapshot && adalahKonfigurasiSitus(currentSnapshot)) {
        const merged = mergeCatalogIntoPublishedSnapshot(currentSnapshot, valueToSave, req.auth!.user.fullName);
        if (merged) {
          const syncedPub = dataSyncStore.setKey('website_published', merged, req.auth!.user.username);
          if (!tulisSalinanSnapshot(merged)) peringatan.push(PERINGATAN_SALINAN_SNAPSHOT);
          latestRevision = Math.max(latestRevision, syncedPub.revision);
          broadcastSyncUpdate('website_published', syncedPub.entry, syncedPub.revision);
        }
      }
    }

    res.json({
      ok: true,
      key,
      version: synced.entry.version,
      revision: latestRevision,
      updatedAt: synced.entry.updatedAt,
      updatedBy: synced.entry.updatedBy,
      ...(peringatan.length ? { peringatan: peringatan.join(' ') } : {})
    });
  });

  app.delete('/api/sync/keys/:key', requireAuth, (req, res) => {
    if (rejectStaleSyncIdentity(req, res)) return;
    const { key } = req.params;
    if (isLegacyRbacSyncKey(key)) {
      return res.status(410).json({
        error: 'LEGACY_RBAC_REMOVED',
        pesan: 'Koleksi RBAC lama sudah dihapus. Gunakan manajemen RBAC server.'
      });
    }
    if (!isValidSyncKey(key)) {
      return res.status(400).json({ error: 'INVALID_KEY', pesan: 'Kunci sinkronisasi tidak valid.' });
    }
    if (!canDeleteSyncKey(req.auth!.role, key)) {
      const resource = mapSyncKeyToResource(key);
      rbacStore.recordAudit({
        actorUsername: req.auth!.user.username,
        actorRole: req.auth!.role.id,
        action: 'PERMISSION_DENIED',
        resource: `${resource}:${key}`,
        status: 'DENIED',
        ip: getClientIp(req),
        detail: `Permintaan DELETE /api/sync/keys/${key} ditolak oleh RBAC server.`
      });
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin menghapus data "${key}".`
      });
    }
    const result = dataSyncStore.deleteKey(key);
    const sourceClientId = typeof req.headers['x-sync-client-id'] === 'string' ? req.headers['x-sync-client-id'] : undefined;
    if (result.deleted) {
      broadcastSyncDelete(key, result.revision, sourceClientId);
    }
    res.json({ ok: true, key, deleted: result.deleted, revision: result.revision });
  });

  app.post('/api/sync/batch', requireAuth, (req, res) => {
    if (rejectStaleSyncIdentity(req, res)) return;
    const body = (req.body || {}) as {
      updates?: Record<string, unknown>;
      deletes?: string[];
      clientId?: string;
    };
    const updates = body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates) ? body.updates : {};
    const sanitizedUpdates: Record<string, unknown> = { ...updates };
    const deletes = Array.isArray(body.deletes) ? body.deletes : [];

    for (const key of Object.keys(updates)) {
      if (isLegacyRbacSyncKey(key)) {
        return res.status(410).json({
          error: 'LEGACY_RBAC_REMOVED',
          pesan: 'Koleksi RBAC lama sudah dihapus. Gunakan manajemen RBAC server.'
        });
      }
      if (!isValidSyncKey(key)) {
        return res.status(400).json({ error: 'INVALID_KEY', pesan: `Kunci sinkronisasi tidak valid: ${key}` });
      }
      if (!canWriteSyncKey(req.auth!.role, key)) {
        const resource = mapSyncKeyToResource(key);
        rbacStore.recordAudit({
          actorUsername: req.auth!.user.username,
          actorRole: req.auth!.role.id,
          action: 'PERMISSION_DENIED',
          resource: `${resource}:${key}`,
          status: 'DENIED',
          ip: getClientIp(req),
          detail: `Permintaan batch write "${key}" ditolak oleh RBAC server.`
        });
        return res.status(403).json({
          error: 'FORBIDDEN',
          pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin menulis "${key}".`
        });
      }
    }

    for (const key of deletes) {
      if (isLegacyRbacSyncKey(key)) {
        return res.status(410).json({
          error: 'LEGACY_RBAC_REMOVED',
          pesan: 'Koleksi RBAC lama sudah dihapus. Gunakan manajemen RBAC server.'
        });
      }
      if (!isValidSyncKey(key)) {
        return res.status(400).json({ error: 'INVALID_KEY', pesan: `Kunci hapus tidak valid: ${key}` });
      }
      if (!canDeleteSyncKey(req.auth!.role, key)) {
        const resource = mapSyncKeyToResource(key);
        return res.status(403).json({
          error: 'FORBIDDEN',
          pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin menghapus "${key}".`
        });
      }
    }

    const selfServiceKeys = Object.keys(sanitizedUpdates).filter((key) => key.startsWith('hris_'));
    if (
      selfServiceKeys.length > 0 &&
      SELF_SERVICE_ROLE_IDS.has(req.auth!.role.id)
    ) {
      const employeeId = verifiedEmployeeId(req.auth!);
      if (!employeeId) {
        return res.status(403).json({ error: 'EMPLOYEE_LINK_REQUIRED', pesan: 'Tautan ID karyawan tidak ditemukan atau tidak unik; hubungi admin.' });
      }
      const employeeName = String(getEmployeeRecord(employeeId)?.nama || '');
      for (const key of selfServiceKeys) {
        const merged = mergeSelfServiceSyncValue(
          key,
          dataSyncStore.getEntry(key)?.value,
          sanitizedUpdates[key],
          employeeId,
          employeeName
        );
        if (!merged.ok) {
          return res.status(403).json({ error: 'SELF_SERVICE_SCOPE_DENIED', pesan: merged.message });
        }
        sanitizedUpdates[key] = merged.value;
      }
    }

    for (const [key, value] of Object.entries(sanitizedUpdates)) {
      if (key === 'website_published' && !adalahKonfigurasiSitus(value)) {
        return res.status(400).json({
          error: 'INVALID_WEBSITE_SNAPSHOT',
          pesan: 'Snapshot website tidak lengkap atau tidak valid; batch tidak disimpan.'
        });
      }
      const replacementError = validateHrisReplacement(req.auth!.role, key, dataSyncStore.getEntry(key)?.value, value);
      if (replacementError) {
        return res.status(403).json({ error: 'HRIS_REPLACEMENT_DENIED', pesan: replacementError });
      }
    }

    if (sanitizedUpdates.website_media_v1) {
      mediaStore.migrateLegacyMediaEntries(sanitizedUpdates.website_media_v1, req.auth!.user.username);
    }

    let result: ReturnType<typeof dataSyncStore.setBatch>;
    try {
      result = dataSyncStore.setBatch(sanitizedUpdates, deletes, req.auth!.user.username);
    } catch (error) {
      console.error('[sync] Penyimpanan batch gagal.', error);
      return res.status(500).json({ error: 'SYNC_WRITE_FAILED', pesan: 'Batch gagal disimpan di server.' });
    }
    const peringatan: string[] = [];
    if (result.updated.website_published && !result.deleted.includes('website_published') &&
        !tulisSalinanSnapshot(result.updated.website_published.value)) {
      peringatan.push(PERINGATAN_SALINAN_SNAPSHOT);
    }
    let latestRevision = result.revision;
    const sourceClientId =
      typeof body.clientId === 'string' && body.clientId
        ? body.clientId
        : typeof req.headers['x-sync-client-id'] === 'string'
          ? req.headers['x-sync-client-id']
          : undefined;
    if (Object.keys(result.updated).length > 0 || result.deleted.length > 0) {
      broadcastSyncBatch(result.updated, result.deleted, result.revision, sourceClientId);
    }

    if (sanitizedUpdates.product_catalog && !sanitizedUpdates.website_draft) {
      const currentDraft = dataSyncStore.getEntry('website_draft')?.value as Record<string, unknown> | undefined;
      if (currentDraft && adalahKonfigurasiSitus(currentDraft)) {
        const mergedDraft = mergeCatalogIntoDraftConfig(
          currentDraft,
          sanitizedUpdates.product_catalog,
          req.auth!.user.fullName
        );
        if (mergedDraft) {
          const syncedDraft = dataSyncStore.setKey('website_draft', mergedDraft, req.auth!.user.username);
          latestRevision = Math.max(latestRevision, syncedDraft.revision);
          broadcastSyncUpdate('website_draft', syncedDraft.entry, syncedDraft.revision);
        }
      }
    }

    if (sanitizedUpdates.product_catalog && !sanitizedUpdates.website_published) {
      const currentSnapshot =
        (dataSyncStore.getEntry('website_published')?.value as Record<string, unknown> | undefined) ||
        bacaSnapshot();
      if (currentSnapshot && adalahKonfigurasiSitus(currentSnapshot)) {
        const merged = mergeCatalogIntoPublishedSnapshot(
          currentSnapshot,
          sanitizedUpdates.product_catalog,
          req.auth!.user.fullName
        );
        if (merged) {
          const syncedPub = dataSyncStore.setKey('website_published', merged, req.auth!.user.username);
          if (!tulisSalinanSnapshot(merged)) peringatan.push(PERINGATAN_SALINAN_SNAPSHOT);
          latestRevision = Math.max(latestRevision, syncedPub.revision);
          broadcastSyncUpdate('website_published', syncedPub.entry, syncedPub.revision);
        }
      }
    }

    const versions: Record<string, number> = {};
    for (const [k, entry] of Object.entries(result.updated)) {
      versions[k] = entry.version;
    }

    res.json({
      ok: true,
      revision: latestRevision,
      versions,
      deleted: result.deleted,
      ...(peringatan.length ? { peringatan: peringatan.join(' ') } : {})
    });
  });

  app.post('/api/sync/purge-dummy', requireAuth, (req, res) => {
    const permsIt = req.auth!.role.permissions['it-traceability'] || [];
    const permsRbac = req.auth!.role.permissions['rbac-admin'] || [];
    const bolehPurge =
      req.auth!.role.id === 'developer' ||
      req.auth!.role.id === 'it_admin' ||
      permsRbac.includes('delete') ||
      permsRbac.includes('update') ||
      permsIt.includes('delete') ||
      permsIt.includes('update');

    if (!bolehPurge) {
      rbacStore.recordAudit({
        actorUsername: req.auth!.user.username,
        actorRole: req.auth!.role.id,
        action: 'PERMISSION_DENIED',
        resource: 'it-traceability:purge-dummy',
        status: 'DENIED',
        ip: getClientIp(req),
        detail: 'Percobaan purge/pemulihan data dummy ditolak oleh RBAC server.'
      });
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki otoritas mengelola purge data dummy.`
      });
    }

    const body = (req.body || {}) as {
      updates?: Record<string, unknown>;
      deletes?: string[];
      mode?: 'purge' | 'restore';
      ringkasan?: string;
      clientId?: string;
    };
    const updates = body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates) ? body.updates : {};
    const deletes = Array.isArray(body.deletes) ? body.deletes : [];

    for (const key of [...Object.keys(updates), ...deletes]) {
      if (typeof key !== 'string') {
        return res.status(400).json({ error: 'INVALID_KEY', pesan: 'Kunci sinkronisasi harus berupa teks.' });
      }
      if (isLegacyRbacSyncKey(key)) {
        return res.status(410).json({
          error: 'LEGACY_RBAC_REMOVED',
          pesan: 'Koleksi RBAC lama sudah dihapus. Gunakan manajemen RBAC server.'
        });
      }
      if (!isValidSyncKey(key)) {
        return res.status(400).json({ error: 'INVALID_KEY', pesan: `Kunci sinkronisasi tidak valid: ${key}` });
      }
      if (key === KUNCI_RFQ_WEBSITE) {
        return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Antrean RFQ website tidak dapat diubah melalui pemulihan data contoh.' });
      }
    }

    for (const key of Object.keys(updates)) {
      if (
        isHrisPersonalSyncKey(key) &&
        (!canReadSyncKey(req.auth!.role, 'hris_karyawan') || !canWriteSyncKey(req.auth!.role, key))
      ) {
        return res.status(403).json({ error: 'FORBIDDEN', pesan: `Peran Anda tidak dapat memulihkan atau mengubah data HRIS "${key}".` });
      }
    }
    for (const key of deletes) {
      if (isHrisPersonalSyncKey(key) && !canDeleteSyncKey(req.auth!.role, key)) {
        return res.status(403).json({ error: 'FORBIDDEN', pesan: `Peran Anda tidak dapat menghapus data HRIS "${key}".` });
      }
    }
    for (const [key, value] of Object.entries(updates)) {
      const replacementError = validateHrisReplacement(req.auth!.role, key, dataSyncStore.getEntry(key)?.value, value);
      if (replacementError) {
        return res.status(403).json({ error: 'HRIS_REPLACEMENT_DENIED', pesan: replacementError });
      }
    }

    const result = dataSyncStore.setBatch(updates, deletes, req.auth!.user.username);
    const sourceClientId =
      typeof body.clientId === 'string' && body.clientId
        ? body.clientId
        : typeof req.headers['x-sync-client-id'] === 'string'
          ? req.headers['x-sync-client-id']
          : undefined;
    if (Object.keys(result.updated).length > 0 || result.deleted.length > 0) {
      broadcastSyncBatch(result.updated, result.deleted, result.revision, sourceClientId);
    }

    const versions: Record<string, number> = {};
    for (const [k, entry] of Object.entries(result.updated)) {
      versions[k] = entry.version;
    }

    const mode = body.mode === 'restore' ? 'restore' : 'purge';
    rbacStore.recordAudit({
      actorUsername: req.auth!.user.username,
      actorRole: req.auth!.role.id,
      action: mode === 'restore' ? 'DUMMY_DATA_RESTORED' : 'DUMMY_DATA_PURGED',
      resource: 'sync',
      status: 'ALLOWED',
      ip: getClientIp(req),
      detail:
        body.ringkasan ||
        (mode === 'restore'
          ? 'Pemulihan data simulasi/dummy bawaan dilakukan melalui server sync.'
          : 'Pembersihan (purge) selektif data dummy dilakukan; data pengguna, RBAC, CoA, pajak, dan pengaturan situs dipertahankan.')
    });

    res.json({
      ok: true,
      mode,
      revision: result.revision,
      versions,
      deleted: result.deleted
    });
  });

  app.post('/api/sync/reset', requirePermission('rbac-admin', 'delete'), (req, res) => {
    const restrictedHrisKey = Object.keys(dataSyncStore.getAllState().entries)
      .find((key) => isHrisPersonalSyncKey(key) && !canDeleteSyncKey(req.auth!.role, key));
    if (restrictedHrisKey) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: 'Reset seluruh data ditolak karena peran Anda tidak memiliki izin menghapus seluruh data HRIS.'
      });
    }
    const revision = dataSyncStore.resetAll();
    const sourceClientId =
      typeof (req.body as { clientId?: string } | undefined)?.clientId === 'string'
        ? (req.body as { clientId?: string }).clientId
        : undefined;
    broadcastMessage({ type: 'sync:reset', revision, sourceClientId: sourceClientId || null }, true);
    rbacStore.recordAudit({
      actorUsername: req.auth!.user.username,
      actorRole: req.auth!.role.id,
      action: 'SYNC_RESET',
      resource: 'sync',
      status: 'ALLOWED',
      ip: getClientIp(req),
      detail: 'Reset seluruh state sinkronisasi server ke bawaan awal.'
    });
    res.json({ ok: true, revision });
  });

  // IT & DevOps Deployment Guide & Config for Caddy + NSSM Windows Server
  app.get('/api/system/deployment-guides', requirePermission('it-traceability', 'view'), (_req, res) => {
    const envInfo = resolveDeploymentEnvironment();
    let domainFromEnv = '';
    try {
      domainFromEnv = envInfo.appUrl.startsWith('http') ? new URL(envInfo.appUrl).hostname : '';
    } catch {
      domainFromEnv = '';
    }
    const domain =
      domainFromEnv && domainFromEnv !== 'localhost' && domainFromEnv !== '127.0.0.1'
        ? domainFromEnv
        : 'ams.bejodigitalprint.com';

    res.json(
      buildWindowsDeploymentGuides({
        domain,
        deploymentEnv: envInfo.deploymentEnv === 'production' ? 'production' : 'staging',
        activeDriver: dbDriverManager.getActiveDriver(),
        port: PORT
      })
    );
  });

  // Kemenkes NIE format verification helper
  app.post('/api/kemenkes/validasi-nie', requireAuth, (req, res) => {
    const { nomorIzinEdar } = req.body;
    if (!nomorIzinEdar || typeof nomorIzinEdar !== 'string') {
      return res.status(400).json({ valid: false, pesan: 'Nomor izin edar harus diisi' });
    }
    const clean = nomorIzinEdar.trim().toUpperCase();
    const regex = /^KEMENKES RI (AKL|AKD) \d{11}$/;
    const valid = regex.test(clean);
    
    const tipe = clean.includes('AKL') ? 'Alkes Luar Negeri (Impor)' : clean.includes('AKD') ? 'Alkes Dalam Negeri (Produksi Lokal)' : 'Format Belum Sesuai';
    
    res.json({
      valid,
      nomor: clean,
      tipeAlkes: tipe,
      formatResmi: 'KEMENKES RI AKL/AKD + 11 digit angka (Contoh: KEMENKES RI AKD 20501910234)',
      keterangan: valid ? 'Format izin edar sesuai standar penomoran Kemenkes RI' : 'Format belum sesuai aturan Kemenkes RI'
    });
  });

  // ================= PENYIMPANAN & STREAMING MEDIA SERVER REAL-TIME =================
  const uploadHits = new Map<string, { count: number; reset: number }>();
  const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
  const UPLOAD_MAX_HITS = 120;
  const dapatUnggahMedia = (kunci: string): boolean => {
    const now = Date.now();
    const cur = uploadHits.get(kunci);
    if (!cur || now > cur.reset) {
      uploadHits.set(kunci, { count: 1, reset: now + UPLOAD_WINDOW_MS });
      return true;
    }
    if (cur.count >= UPLOAD_MAX_HITS) return false;
    cur.count += 1;
    return true;
  };

  const mirrorMediaToFirebaseAdmin = async (meta: StoredMediaMeta, bytes: Buffer) => {
    try {
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) return;
      if (bytes.length > 650_000) {
        console.warn('[media] File terlalu besar untuk dicadangkan ke Firebase Admin:', meta.id);
        return;
      }
      const dataUrl = encodeImageDataUrl(meta.contentType, bytes);
      if (dataUrl.length > 980_000) {
        console.warn('[media] File terlalu besar untuk dicadangkan ke Firebase Admin:', meta.id);
        return;
      }
      const now = new Date();
      await adminDb.collection('ams_media_assets').doc(meta.id).set({
        id: meta.id,
        filename: meta.filename,
        contentType: meta.contentType,
        dataUrl,
        size: meta.size,
        visibility: meta.visibility,
        scope: meta.scope,
        sha256: meta.sha256,
        uploadedBy: meta.uploadedBy,
        createdAt: now,
        updatedAt: now,
        ownerUid: 'server-admin'
      });
    } catch (error) {
      console.error('[media] File tersimpan di server, tetapi pencadangan Firebase Admin gagal:', meta.id, error);
    }
  };

  const serveMediaById = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    if (!isValidMediaId(id)) {
      return res.status(400).json({ error: 'INVALID_MEDIA_ID', pesan: 'ID media tidak valid.' });
    }

    // 1. Prioritas utama: file gambar biner langsung di disk server (${DATA_DIR}/uploads/)
    let stored = mediaStore.getMedia(id);

    // 2. Fallback: entri media lama di dataSyncStore (materialisasi langsung ke file disk)
    if (!stored) {
      const legacyEntries = dataSyncStore.getEntry('website_media_v1')?.value;
      const snapshot = bacaSnapshot();
      const bolehAksesLegacy =
        Boolean(req.auth && canReadInternalMedia(req.auth.role, 'website')) ||
        Boolean(dataSyncStore.getPublicWebsiteMedia(id, snapshot));

      if (bolehAksesLegacy && Array.isArray(legacyEntries)) {
        const match = legacyEntries.find(
          (item) => item && typeof item === 'object' && (item as { id?: unknown }).id === id
        ) as { nama?: unknown; dataUrl?: unknown } | undefined;
        if (typeof match?.dataUrl === 'string') {
          try {
            mediaStore.saveFromDataUrl({
              id,
              dataUrl: match.dataUrl,
              filename: typeof match.nama === 'string' ? match.nama : undefined,
              visibility: 'public',
              scope: 'website',
              uploadedBy: 'legacy-fallback'
            });
            stored = mediaStore.getMedia(id);
          } catch {
            /* abaikan jika korup */
          }
        }
      }
    }

    // 3. Fallback cloud: tarik dari Firestore Admin (jika container baru restart) & tulis ulang ke disk
    if (!stored) {
      try {
        const adminDb = getFirebaseAdminDb();
        if (adminDb) {
          const docSnap = await adminDb.collection('ams_media_assets').doc(id).get();
          if (docSnap.exists) {
            const docData = docSnap.data() as {
              dataUrl?: unknown;
              filename?: unknown;
              visibility?: unknown;
              scope?: unknown;
              uploadedBy?: unknown;
            };
            const vis: MediaVisibility = docData?.visibility === 'internal' ? 'internal' : 'public';
            const scope = typeof docData.scope === 'string' ? docData.scope : 'website';
            const internalAllowed = Boolean(
              req.auth && canReadInternalMedia(req.auth.role, scope)
            );
            if ((vis === 'public' || internalAllowed) && typeof docData?.dataUrl === 'string') {
              mediaStore.saveFromDataUrl({
                id,
                dataUrl: docData.dataUrl,
                filename: typeof docData.filename === 'string' ? docData.filename : undefined,
                visibility: vis,
                scope,
                uploadedBy: typeof docData.uploadedBy === 'string' ? docData.uploadedBy : 'firestore-hydrate'
              });
              stored = mediaStore.getMedia(id);
            }
          }
        }
      } catch {
        /* abaikan jika Firestore belum terhubung */
      }
    }

    if (!stored) {
      return res.status(404).json({ error: 'MEDIA_NOT_FOUND', pesan: 'File foto tidak ditemukan di server.' });
    }

    if (stored.meta.visibility === 'internal') {
      if (!req.auth) {
        return res.status(401).json({ error: 'UNAUTHORIZED', pesan: 'Autentikasi diperlukan untuk melihat lampiran internal.' });
      }
      if (!canReadInternalMedia(req.auth.role, stored.meta.scope)) {
        return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Peran Anda tidak memiliki hak baca untuk lampiran ini.' });
      }
    }

    const etag = `"${stored.meta.sha256}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res
      .set({
        ETag: etag,
        'Cache-Control':
          stored.meta.visibility === 'internal'
            ? 'no-store'
            : 'public, max-age=3600, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${stored.meta.filename}"`
      })
      .type(stored.meta.contentType)
      .send(stored.bytes);
  };

  app.post(
    '/api/media/upload',
    requireAuth,
    express.raw({ limit: '8mb', type: ['image/png', 'image/jpeg', 'image/webp'] }),
    (req, res) => {
      if (rejectStaleSyncIdentity(req, res)) return;
      if (!canUploadMedia(req.auth!.role)) {
        rbacStore.recordAudit({
          actorUsername: req.auth!.user.username,
          actorRole: req.auth!.role.id,
          action: 'PERMISSION_DENIED',
          resource: 'media:upload',
          status: 'DENIED',
          ip: getClientIp(req),
          detail: 'Percobaan upload file foto ke server ditolak oleh RBAC.'
        });
        return res.status(403).json({
          error: 'FORBIDDEN',
          pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin mengunggah foto ke server.`
        });
      }

      const rateKey = `${req.auth!.user.id}:${getClientIp(req)}`;
      if (!dapatUnggahMedia(rateKey)) {
        return res.status(429).json({
          error: 'RATE_LIMITED',
          pesan: 'Terlalu banyak unggahan foto dalam waktu singkat. Coba lagi beberapa menit.'
        });
      }

      try {
        let meta: StoredMediaMeta;
        let savedBytes: Buffer;
        if (Buffer.isBuffer(req.body)) {
          const rawHeaderId = typeof req.headers['x-media-id'] === 'string' ? req.headers['x-media-id'] : undefined;
          const rawFilename =
            typeof req.headers['x-media-filename'] === 'string'
              ? decodeURIComponent(req.headers['x-media-filename'])
              : undefined;
          const rawVis = req.headers['x-media-visibility'] === 'internal' ? 'internal' : 'public';
          const rawScope = typeof req.headers['x-media-scope'] === 'string' ? req.headers['x-media-scope'] : 'website';
          if (!canWriteMediaScope(req.auth!.role, rawScope, 'upload')) {
            return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Peran Anda tidak boleh mengunggah media untuk modul ini.' });
          }
          savedBytes = req.body;
          meta = mediaStore.saveFromBuffer({
            id: rawHeaderId,
            bytes: savedBytes,
            filename: rawFilename,
            visibility: rawVis,
            scope: rawScope,
            uploadedBy: req.auth!.user.username
          });
        } else {
          const body = (req.body || {}) as {
            id?: string;
            filename?: string;
            dataUrl?: string;
            visibility?: MediaVisibility;
            scope?: string;
          };
          if (typeof body.dataUrl !== 'string' || !body.dataUrl.trim()) {
            return res.status(400).json({
              error: 'BAD_REQUEST',
              pesan: 'Kirim file biner (image/png, image/jpeg, image/webp) atau field dataUrl.'
            });
          }
          const scope = body.scope || 'website';
          if (!canWriteMediaScope(req.auth!.role, scope, 'upload')) {
            return res.status(403).json({ error: 'FORBIDDEN', pesan: 'Peran Anda tidak boleh mengunggah media untuk modul ini.' });
          }
          meta = mediaStore.saveFromDataUrl({
            id: body.id,
            dataUrl: body.dataUrl,
            filename: body.filename,
            visibility: body.visibility === 'internal' ? 'internal' : 'public',
            scope,
            uploadedBy: req.auth!.user.username
          });
          savedBytes = mediaStore.getMedia(meta.id)?.bytes ?? Buffer.alloc(0);
        }

        const sourceClientId =
          typeof req.headers['x-sync-client-id'] === 'string' ? req.headers['x-sync-client-id'] : undefined;

        const peringatan: string[] = [];
        try {
          broadcastMessage(
            {
              type: 'media:uploaded',
              media: meta,
              url: `/api/website/media/${encodeURIComponent(meta.id)}`,
              revision: dataSyncStore.getRevision(),
              sourceClientId: sourceClientId || null
            },
            meta.visibility === 'public'
          );
        } catch (error) {
          console.error('[media] File tersimpan, tetapi siaran realtime gagal:', meta.id, error);
          peringatan.push('Foto tersimpan di server, tetapi siaran realtime gagal. Pengunjung mungkin perlu memuat ulang.');
        }

        try {
          rbacStore.recordAudit({
            actorUsername: req.auth!.user.username,
            actorRole: req.auth!.role.id,
            action: 'MEDIA_UPLOADED',
            resource: `media:${meta.scope}`,
            status: 'ALLOWED',
            ip: getClientIp(req),
            detail: `Foto "${meta.filename}" (${meta.contentType}, ${meta.size} byte) disimpan sebagai file server ID ${meta.id}.`
          });
        } catch (error) {
          console.error('[media] File tersimpan, tetapi audit server gagal:', meta.id, error);
          peringatan.push('Foto tersimpan di server, tetapi audit server gagal. Hubungi administrator.');
        }

        void mirrorMediaToFirebaseAdmin(meta, savedBytes);

        return res.status(201).json({
          ok: true,
          id: meta.id,
          url: `/api/website/media/${encodeURIComponent(meta.id)}`,
          fileUrl: `/api/media/${encodeURIComponent(meta.id)}`,
          media: meta,
          ...(peringatan.length ? { peringatan: peringatan.join(' ') } : {})
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan file gambar di server.';
        return res.status(400).json({ error: 'INVALID_MEDIA', pesan: msg });
      }
    }
  );

  app.get('/api/media', requireAuth, (req, res) => {
    const scope = typeof req.query.scope === 'string' && req.query.scope.trim() ? req.query.scope.trim() : undefined;
    const items = mediaStore.listMeta({ scope }).filter(
      (item) => item.visibility !== 'internal' || canReadInternalMedia(req.auth!.role, item.scope)
    );
    res.set('Cache-Control', 'no-store').json({ ok: true, items });
  });

  app.delete('/api/media/:id', requireAuth, (req, res) => {
    if (!canDeleteMedia(req.auth!.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: `Akses ditolak: peran "${req.auth!.role.name}" tidak memiliki izin menghapus file media.`
      });
    }
    const { id } = req.params;
    if (!isValidMediaId(id)) {
      return res.status(400).json({ error: 'INVALID_MEDIA_ID', pesan: 'ID media tidak valid.' });
    }
    const existingMeta = mediaStore.getMeta(id);
    if (existingMeta && !canWriteMediaScope(req.auth!.role, existingMeta.scope, 'delete')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        pesan: 'Peran Anda tidak memiliki izin menghapus media pada modul ini.'
      });
    }
    const deleted = mediaStore.deleteMedia(id);
    const sourceClientId =
      typeof req.headers['x-sync-client-id'] === 'string' ? req.headers['x-sync-client-id'] : undefined;
    if (deleted) {
      broadcastMessage(
        {
          type: 'media:deleted',
          id,
          revision: dataSyncStore.getRevision(),
          sourceClientId: sourceClientId || null
        },
        existingMeta?.visibility !== 'internal'
      );
      rbacStore.recordAudit({
        actorUsername: req.auth!.user.username,
        actorRole: req.auth!.role.id,
        action: 'MEDIA_DELETED',
        resource: `media:${id}`,
        status: 'ALLOWED',
        ip: getClientIp(req),
        detail: `File media "${id}" dihapus dari disk server.`
      });
    }
    res.json({ ok: true, id, deleted });
  });

  app.get('/api/media/:id', serveMediaById);

  // ================= SITUS PUBLIK (konten diatur dari menu Website di dashboard) =================
  // Snapshot terbit dibaca halaman /web lintas perangkat; hanya konfigurasi valid yang diterima.
  app.get('/api/website/media/:id', serveMediaById);

  app.get('/api/website/published', (req, res) => {
    const snapshot = bacaSnapshot();
    if (!snapshot) {
      return res.status(404).set('Cache-Control', 'no-store').json({
        error: 'WEBSITE_NOT_PUBLISHED',
        pesan: 'Belum ada konten situs yang diterbitkan.'
      });
    }
    res.set('Cache-Control', 'no-store').json({ config: snapshot });
  });

  const rfqHits = new Map<string, { count: number; reset: number }>();
  app.post('/api/website/rfq', (req, res) => {
    const sekarang = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'tidak-diketahui';
    let hit = rfqHits.get(ip);
    if (!hit || hit.reset <= sekarang) {
      for (const [kunci, entri] of rfqHits) {
        if (entri.reset <= sekarang) rfqHits.delete(kunci);
      }
      if (rfqHits.size >= 10000) {
        return res.status(503).json({ pesan: 'Layanan permintaan sedang sibuk. Coba lagi nanti.' });
      }
      hit = { count: 0, reset: sekarang + 15 * 60 * 1000 };
      rfqHits.set(ip, hit);
    }
    if (hit.count >= 20) {
      return res.status(429).json({ pesan: 'Terlalu banyak permintaan. Coba lagi beberapa menit.' });
    }
    hit.count += 1;

    const snapshot = bacaSnapshot();
    if (!snapshot || snapshot.isPublished !== true) {
      return res.status(503).json({ pesan: 'Formulir permintaan belum tersedia. Hubungi tim penjualan melalui surel atau WhatsApp.' });
    }
    const hasil = buatProspekWebsite(req.body);
    if (!hasil.ok) return res.status(400).json({ pesan: hasil.pesan });

    const tersimpan = dataSyncStore.getEntry(KUNCI_RFQ_WEBSITE)?.value;
    if (tersimpan !== undefined && !Array.isArray(tersimpan)) {
      console.error('[website-rfq] Antrean RFQ server tidak berbentuk daftar.');
      return res.status(503).json({ pesan: 'Penyimpanan permintaan tidak tersedia. Hubungi tim penjualan melalui surel atau WhatsApp.' });
    }
    const daftar: ProspekAlkes[] = tersimpan ?? [];
    const sebelumnya = daftar.find((item) => item?.id === hasil.prospek.id);
    if (sebelumnya) {
      if (!samaPermintaanWebsite(sebelumnya, hasil.prospek)) {
        return res.status(409).json({ pesan: 'ID permintaan sudah digunakan untuk isian lain. Muat ulang formulir sebelum mencoba lagi.' });
      }
      return res.set('Cache-Control', 'no-store').json({ ok: true, nomorProspek: sebelumnya.nomorProspek });
    }
    let synced: ReturnType<typeof dataSyncStore.setKey>;
    try {
      synced = dataSyncStore.setKey(KUNCI_RFQ_WEBSITE, [hasil.prospek, ...daftar], 'website-public');
    } catch (error) {
      console.error('[website-rfq] Permintaan gagal disimpan.', error);
      return res.status(500).json({ pesan: 'Permintaan belum dapat disimpan. Coba lagi atau gunakan surel/WhatsApp.' });
    }
    try {
      broadcastSyncUpdate(KUNCI_RFQ_WEBSITE, synced.entry, synced.revision);
    } catch (error) {
      console.error('[website-rfq] Permintaan tersimpan, tetapi siaran realtime gagal.', error);
    }
    return res.status(201).set('Cache-Control', 'no-store').json({ ok: true, nomorProspek: hasil.prospek.nomorProspek });
  });

  const translationHits = new Map<string, { count: number; reset: number }>();
  const TRANSLATION_WINDOW_MS = 15 * 60 * 1000;
  const TRANSLATION_MAX_HITS = 20;
  app.get('/api/website/translation/en', async (req, res) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const current = translationHits.get(ip);
    if (!current || current.reset <= now) {
      translationHits.set(ip, { count: 1, reset: now + TRANSLATION_WINDOW_MS });
    } else if (current.count >= TRANSLATION_MAX_HITS) {
      return res.status(429).json({
        error: 'WEBSITE_TRANSLATION_RATE_LIMITED',
        message: 'Terlalu banyak permintaan terjemahan. Coba lagi beberapa menit.'
      });
    } else {
      current.count += 1;
    }

    const snapshot = bacaSnapshot();
    if (!snapshot) return res.status(404).json({ error: 'WEBSITE_NOT_PUBLISHED', message: 'Belum ada konten situs yang diterbitkan.' });
    try {
      const translated = await websiteTranslationService.translate(snapshot);
      return res.set('Cache-Control', 'no-store').json({
        config: translated.config,
        sourceHash: translated.sourceHash,
        sourceVersion: snapshot.lastModifiedAt
      });
    } catch (error) {
      if (error instanceof WebsiteTranslationError) {
        return res.status(error.statusCode).json({ error: error.code, message: error.message });
      }
      console.error('[website-translation] Gagal menerjemahkan snapshot situs.', error);
      return res.status(500).json({
        error: 'WEBSITE_TRANSLATION_FAILED',
        message: 'Terjadi kesalahan saat menyiapkan terjemahan situs.'
      });
    }
  });

  // Salinan statis untuk hosting tanpa Node (jalur cadangan pada PublicWebsiteApp).
  app.get('/website-published.json', (req, res) => {
    const snapshot = bacaSnapshot();
    if (!snapshot) return res.status(404).json({ pesan: 'Belum ada konten situs yang diterbitkan.' });
    res.set('Cache-Control', 'no-store').json(snapshot);
  });

  // Token publikasi server diset lewat environment (AMS_ADMIN_TOKEN). Tanpa token,
  // publikasi situs dinonaktifkan (fail-closed) — UI menampilkan fallback unduh JSON.
  const AMS_ADMIN_TOKEN = (process.env.AMS_ADMIN_TOKEN || '').trim();
  // Rate limit sederhana per IP untuk rute tulis situs (30 percobaan / 15 menit).
  const putHits = new Map<string, { count: number; reset: number }>();
  const PUT_WINDOW_MS = 15 * 60 * 1000;
  const PUT_MAX_HITS = 30;
  const dapatPosting = (kunci: string): boolean => {
    const now = Date.now();
    const cur = putHits.get(kunci);
    if (!cur || now > cur.reset) {
      putHits.set(kunci, { count: 1, reset: now + PUT_WINDOW_MS });
      return true;
    }
    if (cur.count >= PUT_MAX_HITS) return false;
    cur.count += 1;
    return true;
  };

  app.put('/api/website/published', (req, res) => {
    const token = String(req.headers['x-ams-admin-token'] || '');
    const viaAdminToken =
      Boolean(AMS_ADMIN_TOKEN) &&
      token.length === AMS_ADMIN_TOKEN.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(AMS_ADMIN_TOKEN));

    if (!viaAdminToken) {
      if (!req.auth) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          pesan: 'Sesi login atau token admin diperlukan untuk menerbitkan situs.'
        });
      }
      const perms = req.auth.role.permissions.website;
      if (!Array.isArray(perms) || !perms.includes('publish')) {
        rbacStore.recordAudit({
          actorUsername: req.auth.user.username,
          actorRole: req.auth.role.id,
          action: 'PERMISSION_DENIED',
          resource: 'website:publish',
          status: 'DENIED',
          ip: getClientIp(req),
          detail: `Permintaan PUT /api/website/published ditolak oleh RBAC server.`
        });
        return res.status(403).json({
          error: 'FORBIDDEN',
          pesan: `Akses ditolak: peran "${req.auth.role.name}" tidak memiliki izin "publish" pada modul website.`
        });
      }
      if (rejectStaleSyncIdentity(req, res)) return;
    }
    if (!dapatPosting(req.ip ?? 'tidak-diketahui')) {
      return res.status(429).json({ pesan: 'Terlalu banyak percobaan publikasi. Coba lagi 15 menit.' });
    }
    const kandidat = ((req.body as Record<string, any> | undefined)?.config ?? req.body) as unknown;
    if (!adalahKonfigurasiSitus(kandidat)) {
      return res.status(400).json({ error: 'INVALID_WEBSITE_SNAPSHOT', pesan: 'Konfigurasi situs tidak lengkap atau tidak valid.' });
    }
    const pelaku = req.auth ? req.auth.user.fullName : 'Admin Token API';
    const terautentikasi: Record<string, unknown> = { ...kandidat, lastModifiedBy: pelaku };
    const isian = JSON.stringify(terautentikasi, null, 2);
    let synced: ReturnType<typeof dataSyncStore.setKey>;
    try {
      synced = dataSyncStore.setKey(
        'website_published',
        terautentikasi,
        req.auth ? req.auth.user.username : 'admin-token'
      );
    } catch (error) {
      console.error('[website] Gagal menyimpan snapshot.', error);
      return res.status(500).json({ pesan: 'Snapshot gagal ditulis ke penyimpanan server.' });
    }
    const peringatan: string[] = [];
    if (!tulisSalinanSnapshot(terautentikasi)) peringatan.push(PERINGATAN_SALINAN_SNAPSHOT);
    try {
      broadcastSyncUpdate(
        'website_published',
        synced.entry,
        synced.revision,
        typeof req.headers['x-sync-client-id'] === 'string' ? req.headers['x-sync-client-id'] : undefined
      );
    } catch (error) {
      console.error('[website] Snapshot tersimpan, tetapi siaran realtime gagal.', error);
      peringatan.push('Siaran realtime gagal; pengunjung mungkin perlu memuat ulang halaman.');
    }
    try {
      rbacStore.recordAudit({
        actorUsername: req.auth ? req.auth.user.username : 'admin-token',
        actorRole: req.auth ? req.auth.role.id : 'system',
        action: terautentikasi.isPublished ? 'WEBSITE_PUBLISHED' : 'WEBSITE_HELD',
        resource: 'website',
        status: 'ALLOWED',
        ip: getClientIp(req),
        detail: terautentikasi.isPublished
          ? 'Snapshot situs publik diterbitkan ke server.'
          : 'Penayangan situs publik ditahan di server.'
      });
    } catch (error) {
      console.error('[website] Snapshot tersimpan, tetapi audit server gagal disimpan.', error);
      peringatan.push('Audit server gagal disimpan; hubungi administrator.');
    }
    return res.json({
      ok: true,
      disimpanPada: new Date().toISOString(),
      oleh: pelaku,
      revision: synced.revision,
      version: synced.entry.version,
      config: terautentikasi,
      ...(peringatan.length ? { peringatan: peringatan.join(' ') } : {}),
      byte: Buffer.byteLength(isian)
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/site', express.static(path.join(distDir, 'site'), { maxAge: '7d' }));
    app.use('/brand', express.static(path.join(distDir, 'brand'), { maxAge: '7d' }));
    app.use('/fonts', express.static(path.join(distDir, 'fonts'), { maxAge: '30d' }));
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));

    app.get('/', (_req, res) => {
      const html = fs.readFileSync(distIndex, 'utf8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).type('html').send(suntikSnapshotPublik(html, bacaSnapshot()));
    });
    app.get('/web', (_req, res) => {
      const snapshot = bacaSnapshot();
      const html = fs.readFileSync(distIndex, 'utf8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).type('html').send(suntikSnapshotPublik(suntikSeo(html, snapshot), snapshot));
    });
    app.get(['/mobile', '/mobile/*'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(distIndex);
    });
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).type('html').send(suntikSnapshotPublik(fs.readFileSync(distIndex, 'utf8'), bacaSnapshot()));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.get(['/', '/index.html'], async (req, res, next) => {
      try {
        const mentah = fs.readFileSync(BERKAS_INDEKS, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, mentah);
        res
          .status(200)
          .set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
          .end(suntikSnapshotPublik(html, bacaSnapshot()));
      } catch (e) {
        next(e);
      }
    });
    app.get('/web', async (req, res, next) => {
      try {
        const snapshot = bacaSnapshot();
        const mentah = fs.readFileSync(BERKAS_INDEKS, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, mentah);
        res
          .status(200)
          .set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
          .end(suntikSnapshotPublik(suntikSeo(html, snapshot), snapshot));
      } catch (e) {
        next(e);
      }
    });
    app.get(['/mobile', '/mobile/*'], async (req, res, next) => {
      try {
        const mentah = fs.readFileSync(BERKAS_INDEKS, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, mentah);
        res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }).end(html);
      } catch (e) {
        next(e);
      }
    });
    app.use(vite.middlewares);
  }

  // Isolasi WebSocket /api/sync/ws agar tidak bentrok dengan listener upgrade Vite HMR
  const existingUpgradeListeners = httpServer.listeners('upgrade').slice();
  httpServer.removeAllListeners('upgrade');
  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/api/sync/ws') {
      syncWss.handleUpgrade(req, socket, head, (ws) => {
        syncWss.emit('connection', ws, req);
      });
      return;
    }
    for (const fn of existingUpgradeListeners) {
      (fn as (...args: unknown[]) => void).call(httpServer, req, socket, head);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AMS Integrated System Backend aktif di port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
