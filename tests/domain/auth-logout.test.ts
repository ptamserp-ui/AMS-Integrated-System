import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bacaSesi, keluarDariServer, simpanSesi, type SesiLogin } from '../../src/utils/autentikasi';
import { signOutFirebase } from '../../src/services/firebase';
import { db } from '../../src/services/pocketbase';

vi.mock('../../src/services/firebase', () => ({ signOutFirebase: vi.fn() }));
vi.mock('../../src/services/pocketbase', () => ({
  db: {
    flushPendingSync: vi.fn().mockResolvedValue({ synced: 0, remaining: 0 }),
    resetSessionSyncState: vi.fn()
  }
}));
vi.mock('../../src/utils/mediaUpload', () => ({ flushPendingMediaUploads: vi.fn().mockResolvedValue(0) }));

describe('logout', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
    simpanSesi({
      userId: 'test', namaPengguna: 'test', namaLengkap: 'Test', email: '', departemen: '',
      peran: 'sales_medrep', namaPeran: 'Sales', permissions: {}, masukPada: '', expiresAt: '', token: 'test-token'
    } satisfies SesiLogin);
    vi.mocked(signOutFirebase).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mencabut sesi server dan Firebase lalu menghapus sesi lokal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await keluarDariServer()).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token');
    expect(signOutFirebase).toHaveBeenCalledOnce();
    expect(bacaSesi()).toBeNull();
  });

  it('memperingatkan kegagalan server sambil tetap menghapus sesi lokal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await keluarDariServer()).toMatchObject({ ok: false, pesan: expect.stringContaining('server AMS') });
    expect(signOutFirebase).toHaveBeenCalledOnce();
    expect(bacaSesi()).toBeNull();
  });

  it('memperingatkan ketika jaringan gagal dan tetap mencoba logout Firebase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await keluarDariServer()).toMatchObject({ ok: false, pesan: expect.stringContaining('server AMS') });
    expect(signOutFirebase).toHaveBeenCalledOnce();
    expect(bacaSesi()).toBeNull();
  });

  it('memperingatkan ketika logout Firebase gagal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.mocked(signOutFirebase).mockRejectedValue(new Error('Firebase unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await keluarDariServer()).toMatchObject({ ok: false, pesan: expect.stringContaining('Firebase') });
    expect(bacaSesi()).toBeNull();
  });

  it('tetap mencabut sesi server jika pembersihan sinkronisasi gagal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(db.resetSessionSyncState).mockImplementationOnce(() => { throw new Error('Sync unavailable'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await keluarDariServer()).toMatchObject({ ok: false, pesan: expect.stringContaining('sinkronisasi') });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-token');
    expect(signOutFirebase).toHaveBeenCalledOnce();
    expect(bacaSesi()).toBeNull();
  });
});
