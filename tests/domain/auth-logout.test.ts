import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bacaSesi, keluarDariServer, simpanSesi, type SesiLogin } from '../../src/utils/autentikasi';
import { signOutFirebase } from '../../src/services/firebase';

vi.mock('../../src/services/firebase', () => ({ signOutFirebase: vi.fn() }));

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
});
