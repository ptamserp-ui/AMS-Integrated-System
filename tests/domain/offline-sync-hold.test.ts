import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMSDatabaseManager } from '../../src/services/pocketbase';
import type { SesiLogin } from '../../src/utils/autentikasi';
import { HEADER_IDENTITAS_SYNC } from '../../src/utils/identitasSinkronisasi';
import { KUNCI_PENDING_MEDIA } from '../../src/utils/websitePrimitives';

vi.mock('../../src/services/firebase', () => ({
  authFirebase: { currentUser: null },
  attachFirestoreRealtimeSync: vi.fn(),
  deleteSyncEntryFromFirestore: vi.fn(),
  fetchPublicSiteFromFirestore: vi.fn(),
  getFirebaseProjectInfo: vi.fn(() => ({})),
  pullAllCloudStateFromFirestore: vi.fn(),
  pushArchiveConfigToFirestore: vi.fn(),
  pushPublicSiteToFirestore: vi.fn(),
  pushRbacSnapshotToFirestore: vi.fn(),
  pushSyncEntryToFirestore: vi.fn(),
  subscribeFirebaseAuthState: vi.fn()
}));
vi.mock('../../src/utils/mediaUpload', () => ({
  flushPendingMediaUploads: vi.fn().mockResolvedValue(0)
}));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failKey: string | null = null;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('storage full');
    this.values.set(key, String(value));
  }
}

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeSocket.instances.push(this); }
  send() {}
  close() {}
  message(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

const SESSION_KEY = 'ams_alkes_sesi_login_v2';
const QUEUE_KEY = '__ams_pending_sync_v1';
const OWNER_KEY = '__ams_last_sync_user_v1';
const LEAVE_KEY = 'ams_alkes_hris_cuti';
const leave = [{ id: 'CUTI-LOCAL', karyawanId: 'EMP-01', status: 'Menunggu' }];
const session: SesiLogin = {
  userId: 'USR-01',
  namaPengguna: 'staf',
  namaLengkap: 'Staf Uji',
  email: '',
  departemen: '',
  employeeId: 'EMP-01',
  peran: 'karyawan',
  namaPeran: 'Karyawan',
  permissions: { overview: ['view'], 'hrd-pelatihan': ['view'] },
  masukPada: '',
  expiresAt: '2099-01-01T00:00:00.000Z',
  token: 'token-uji'
};

describe('perlindungan antrean offline saat akses berubah', () => {
  let storage: MemoryStorage;
  let browser: EventTarget;
  let manager: AMSDatabaseManager;
  let readable: Set<string> | null;
  let writable: Set<string> | null;
  let deletable: Set<string> | null;
  let putStatus: number;
  let sent: Array<{ url: string; init?: RequestInit }>;

  function setSession(sesi: SesiLogin) {
    storage.setItem(SESSION_KEY, JSON.stringify(sesi));
  }

  function offline() {
    browser.dispatchEvent(new Event('offline'));
  }

  function online() {
    browser.dispatchEvent(new Event('online'));
  }

  function queueLeave() {
    offline();
    manager.setSettingJson('hris_cuti', leave);
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
  }

  beforeEach(async () => {
    storage = new MemoryStorage();
    browser = Object.assign(new EventTarget(), {
      location: { protocol: 'https:', host: 'ams.test', origin: 'https://ams.test' }
    });
    FakeSocket.instances = [];
    readable = null;
    writable = null;
    deletable = null;
    putStatus = 200;
    sent = [];
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', browser);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/system/db-config')) return Response.json({ activeDriver: 'firebase' });
      if (url.startsWith('/api/sync/state')) {
        const query = new URL(url, 'https://ams.test').searchParams;
        const known = JSON.parse(query.get('known') || '[]') as string[];
        return Response.json({
          revision: 1,
          entries: {},
          allowedKeys: known.filter((key) => !readable || readable.has(key)),
          writableKeys: known.filter((key) => !writable || writable.has(key)),
          deletableKeys: known.filter((key) => !deletable || deletable.has(key))
        });
      }
      if (url.startsWith('/api/sync/keys/') || url === '/api/sync/batch') {
        sent.push({ url, init });
        return putStatus === 200
          ? Response.json({ version: 2, revision: 2, versions: {} })
          : Response.json({ pesan: 'Izin atau data ditolak oleh server.' }, { status: putStatus });
      }
      throw new Error(`Permintaan tak terduga: ${url}`);
    }));
    setSession(session);
    manager = new AMSDatabaseManager();
    manager.prepareSessionSync(session);
    await manager.syncFromServer(false);
  });

  afterEach(() => {
    manager.disconnectRealtimeSync();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mengantrekan versi draf tetapi tidak mengirim ulang snapshot yang sudah dikonfirmasi server', () => {
    offline();
    const draf = manager.getWebsiteDraft();
    manager.simpanWebsiteDraft(draf, 'Admin Uji', 'Admin');
    expect(manager.getConnectionStatus().pendingKeys).toContain('website_content_v');

    const snapshot = { ...draf, isPublished: true, lastPublishedAt: Date.now() };
    manager.catatWebsiteTerbit(snapshot, 'Admin Uji', 'Admin', 7);
    expect(manager.getWebsiteTerbit()).toEqual(snapshot);
    expect(manager.getConnectionStatus().pendingKeys).not.toContain('website_published');
  });

  it('mendeteksi draf tertunda dari tab lain dan gagal aman jika antrean tidak dapat dibaca', () => {
    expect(manager.hasPendingWebsiteDraft()).toBe(false);
    storage.setItem(QUEUE_KEY, JSON.stringify(['website_draft']));
    expect(manager.hasPendingWebsiteDraft()).toBe(true);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.setItem(QUEUE_KEY, '{rusak');
    expect(manager.hasPendingWebsiteDraft()).toBe(true);
    expect(storage.getItem(QUEUE_KEY)).toBe('{rusak');
  });

  it('mengambil ulang draf yang gagal disimpan di cache meskipun sinkronisasi berikutnya memakai delta', async () => {
    const fetchMock = vi.mocked(fetch);
    const normalFetch = fetchMock.getMockImplementation()!;
    const entries = {
      website_content_v: { value: 1, version: 2 },
      website_draft: { value: { judul: 'Draf server baru' }, version: 3 }
    };
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (!url.startsWith('/api/sync/state')) return normalFetch(input, init);
      const query = new URL(url, 'https://ams.test').searchParams;
      const versions = JSON.parse(query.get('versions') || '{}') as Record<string, number>;
      return Promise.resolve(Response.json({
        revision: 3,
        entries: Object.fromEntries(Object.entries(entries).filter(([key, entry]) => (versions[key] ?? 0) < entry.version)),
        allowedKeys: Object.keys(entries),
        writableKeys: Object.keys(entries),
        deletableKeys: Object.keys(entries)
      }));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.setItem('ams_alkes_website_draft', JSON.stringify({ judul: 'Draf lama' }));
    storage.failKey = 'ams_alkes_website_draft';
    await manager.syncFromServer(false);
    expect(manager.getConnectionStatus().lastSyncError).toContain('Tidak dapat');
    expect(JSON.parse(storage.getItem('ams_alkes_website_draft')!)).toEqual({ judul: 'Draf lama' });

    storage.failKey = null;
    await manager.syncFromServer(true);
    expect(JSON.parse(storage.getItem('ams_alkes_website_draft')!)).toEqual({ judul: 'Draf server baru' });
  });

  it('melaporkan kegagalan realtime dan dapat menerapkan ulang versi yang sama setelah cache pulih', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    manager.connectRealtimeSync(session.token);
    const socket = FakeSocket.instances.at(-1)!;
    const update = { type: 'sync:update', key: 'website_draft', value: { judul: 'Draf server' }, version: 5 };
    storage.failKey = 'ams_alkes_website_draft';
    socket.message(update);
    expect(manager.getConnectionStatus().lastSyncError).toContain('realtime gagal');
    expect(storage.getItem('ams_alkes_website_draft')).toBeNull();

    storage.failKey = null;
    socket.message(update);
    expect(JSON.parse(storage.getItem('ams_alkes_website_draft')!)).toEqual(update.value);
  });

  it.each([
    ['akun', { userId: 'USR-02' }],
    ['peran', { peran: 'sales_medrep' as const }],
    ['izin', { permissions: { overview: ['view'] as Array<'view'> } }],
    ['ID karyawan', { employeeId: 'EMP-02' }]
  ])('menahan antrean saat %s berubah dan mengirimnya setelah akses lama dipulihkan', async (_label, patch) => {
    queueLeave();
    const owner = storage.getItem(OWNER_KEY);
    const changed: SesiLogin = { ...session, ...patch };
    setSession(changed);
    manager.prepareSessionSync(changed);
    online();
    await manager.syncFromServer(false);

    expect(manager.getSyncHoldReason()).toContain('berubah');
    expect(storage.getItem(OWNER_KEY)).toBe(owner);
    expect(JSON.parse(storage.getItem(LEAVE_KEY)!)).toEqual(leave);
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    expect(sent).toHaveLength(0);

    setSession(session);
    manager.prepareSessionSync(session);
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toBeNull();
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].init?.method).toBe('PUT');
    expect((sent[0].init?.headers as Record<string, string>)[HEADER_IDENTITAS_SYNC]).toBe(encodeURIComponent(owner!));
    expect(JSON.parse(String(sent[0].init?.body)).value).toEqual(leave);
  });

  it('menahan perubahan ketika master tidak lagi terverifikasi walaupun ID sesi tidak berubah', async () => {
    queueLeave();
    writable = new Set();
    readable = new Set();
    online();
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toContain('Hak akses');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    expect(sent).toHaveLength(0);

    writable = null;
    readable = null;
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toBeNull();
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it('mempertahankan antrean ketika server menolak tulisan atau validasi', async () => {
    queueLeave();
    online();
    putStatus = 403;
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toContain('menolak');
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));

    putStatus = 400;
    await manager.syncFromServer(false);
    expect(manager.getConnectionStatus().lastSyncError).toContain('ditolak');
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');

    putStatus = 200;
    await manager.syncFromServer(false);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
    expect(JSON.parse(String(sent.at(-1)?.init?.body)).value).toEqual(leave);
  });

  it('mempertahankan operasi hapus yang tidak diizinkan tanpa membuat ulang seed', async () => {
    offline();
    manager.removeSettingJson('hris_cuti');
    deletable = new Set();
    online();
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toContain('Hak akses');
    expect(storage.getItem(LEAVE_KEY)).toBeNull();
    expect(manager.getCuti()).toEqual([]);
    expect(storage.getItem(LEAVE_KEY)).toBeNull();
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');

    deletable = null;
    await manager.syncFromServer(false);
    expect(sent.at(-1)?.init?.method).toBe('DELETE');
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('mengizinkan antrean audit yang boleh ditulis meskipun tidak boleh dibaca', async () => {
    offline();
    manager.logAudit('HRIS', 'Pengajuan cuti', 'CUTI-LOCAL');
    readable = new Set();
    writable = new Set(['audit_trail']);
    online();
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toBeNull();
    expect(sent.some((item) => item.url.endsWith('/audit_trail'))).toBe(true);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
    expect(storage.getItem('ams_alkes_audit_trail')).toBeNull();
    expect(storage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('menahan antrean media tanpa menghapusnya saat identitas berubah', async () => {
    const media = [{ id: 'img-1', filename: 'uji.png', dataUrl: 'data:image/png;base64,AA==', visibility: 'internal', scope: 'hrd-pelatihan' }];
    storage.setItem(KUNCI_PENDING_MEDIA, JSON.stringify(media));
    const changed = { ...session, employeeId: 'EMP-02' };
    setSession(changed);
    manager.prepareSessionSync(changed);
    await manager.syncFromServer(false);
    expect(manager.getSyncHoldReason()).toContain('berubah');
    expect(JSON.parse(storage.getItem(KUNCI_PENDING_MEDIA)!)).toEqual(media);
    expect(sent).toHaveLength(0);
  });

  it('mengunci antrean lama yang tidak memiliki identitas lengkap tanpa menimpanya', () => {
    storage.setItem(OWNER_KEY, 'USR-01:karyawan:{"hrd-pelatihan":["view"]}');
    storage.setItem(QUEUE_KEY, JSON.stringify(['hris_cuti']));
    storage.setItem(LEAVE_KEY, JSON.stringify(leave));
    const restarted = new AMSDatabaseManager();
    restarted.prepareSessionSync(session);
    expect(restarted.getSyncHoldReason()).toContain('antrean offline lama');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    restarted.disconnectRealtimeSync();
  });

  it('tidak menimpa antrean dari event realtime dan menahan reset untuk rekonsiliasi', () => {
    queueLeave();
    manager.connectRealtimeSync(session.token);
    const socket = FakeSocket.instances.at(-1)!;
    socket.message({ type: 'sync:update', key: 'hris_cuti', value: [], version: 5 });
    socket.message({ type: 'sync:delete', key: 'hris_cuti' });
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));

    socket.message({ type: 'sync:reset', revision: 6 });
    expect(manager.getSyncHoldReason()).toContain('di-reset');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));
    const restarted = new AMSDatabaseManager();
    restarted.prepareSessionSync(session);
    expect(restarted.getSyncHoldReason()).toContain('rekonsiliasi');
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    restarted.disconnectRealtimeSync();
  });

  it('menahan antrean saat menerima pembersihan data dan mencegah reset lokal', async () => {
    queueLeave();
    expect(await manager.purgeDummyData()).toMatchObject({ ok: false, pesan: expect.stringContaining('offline') });
    expect(await manager.pulihkanDataDummy()).toMatchObject({ ok: false, pesan: expect.stringContaining('offline') });
    await expect(manager.resetToDefaults()).rejects.toThrow('offline');
    manager.connectRealtimeSync(session.token);
    FakeSocket.instances.at(-1)!.message({
      type: 'sync:update',
      key: 'sistem_data_manifest',
      value: { dummyDihapus: true },
      version: 3
    });
    expect(manager.getSyncHoldReason()).toContain('dibersihkan');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
  });

  it('tidak menghapus antrean ketika jawaban kiriman tiba setelah identitas berubah', async () => {
    let finishRequest!: (response: Response) => void;
    const fetchMock = vi.mocked(fetch);
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => {
      if (String(input).startsWith('/api/sync/keys/')) {
        sent.push({ url: String(input), init });
        return new Promise<Response>((resolve) => { finishRequest = resolve; });
      }
      return normalFetch(input, init);
    });

    manager.setSettingJson('hris_cuti', leave);
    expect(sent).toHaveLength(1);
    const changed = { ...session, employeeId: 'EMP-02' };
    setSession(changed);
    manager.prepareSessionSync(changed);
    finishRequest(Response.json({ version: 2, revision: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(manager.getSyncHoldReason()).toContain('berubah');
    expect(storage.getItem(QUEUE_KEY)).toContain('hris_cuti');
    expect(storage.getItem(LEAVE_KEY)).toBe(JSON.stringify(leave));
  });
});
