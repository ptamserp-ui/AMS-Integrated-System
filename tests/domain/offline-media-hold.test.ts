import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/services/pocketbase';
import { authFirebase, pushMediaAssetToFirestore } from '../../src/services/firebase';
import { flushPendingMediaUploads, unggahFotoKeServer } from '../../src/utils/mediaUpload';
import { kompresGambarWebsite } from '../../src/utils/website';
import { HEADER_IDENTITAS_SYNC } from '../../src/utils/identitasSinkronisasi';
import { KUNCI_PENDING_MEDIA, simpanMediaWebsite } from '../../src/utils/websitePrimitives';

vi.mock('../../src/services/pocketbase', () => ({
  db: {
    identitasSyncSiap: vi.fn(),
    isIdentitasSyncSiap: vi.fn(),
    tahanSinkronisasi: vi.fn()
  }
}));
vi.mock('../../src/services/firebase', () => ({
  authFirebase: { currentUser: null },
  pushMediaAssetToFirestore: vi.fn()
}));
vi.mock('../../src/utils/website', () => ({ kompresGambarWebsite: vi.fn() }));
vi.mock('../../src/utils/websitePrimitives', () => ({
  KUNCI_PENDING_MEDIA: 'ams_alkes_pending_media_uploads_v1',
  daftarMediaWebsite: vi.fn(() => []),
  hapusMediaWebsite: vi.fn(),
  setPratinjauMemori: vi.fn(),
  simpanMediaWebsite: vi.fn()
}));

const item = {
  id: 'media-1',
  filename: 'foto.png',
  dataUrl: 'data:image/png;base64,AA==',
  visibility: 'internal',
  scope: 'hrd-pelatihan'
};

const konfirmasi = {
  ok: true,
  id: item.id,
  url: `/api/website/media/${item.id}`,
  media: { sha256: 'a'.repeat(64), uploadedBy: 'staf', size: 1 }
};

describe('antrean media offline saat akses berubah', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map([
      ['ams_alkes_sesi_login_v2', JSON.stringify({ token: 'token-uji' })],
      [KUNCI_PENDING_MEDIA, JSON.stringify([item])]
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(konfirmasi)));
    vi.mocked(db.identitasSyncSiap).mockReset().mockReturnValue('scope-asal');
    vi.mocked(db.isIdentitasSyncSiap).mockReset().mockReturnValue(true);
    vi.mocked(db.tahanSinkronisasi).mockReset();
    Object.assign(authFirebase, { currentUser: null });
    vi.mocked(pushMediaAssetToFirestore).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tidak mengirim media ketika identitas belum diverifikasi', async () => {
    vi.mocked(db.identitasSyncSiap).mockReturnValue(null);
    expect(await flushPendingMediaUploads()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toEqual([item]);
  });

  it('mempertahankan media dan menahan akses ketika server menolak unggahan', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ pesan: 'Izin dicabut.' }, { status: 403 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await flushPendingMediaUploads()).toBe(0);
    expect(db.tahanSinkronisasi).toHaveBeenCalledWith(expect.stringContaining('Izin dicabut'));
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toEqual([item]);
    expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)[HEADER_IDENTITAS_SYNC])
      .toBe(encodeURIComponent('scope-asal'));
  });

  it('tidak menghapus media jika identitas berganti saat unggahan berlangsung', async () => {
    vi.mocked(db.isIdentitasSyncSiap).mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(await flushPendingMediaUploads()).toBe(0);
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toEqual([item]);
  });

  it('menghapus hanya media yang berhasil, termasuk jika antrean bertambah saat unggahan', async () => {
    const baru = { ...item, id: 'media-2' };
    vi.mocked(fetch).mockImplementation(async () => {
      values.set(KUNCI_PENDING_MEDIA, JSON.stringify([item, baru]));
      return Response.json(konfirmasi);
    });
    expect(await flushPendingMediaUploads()).toBe(1);
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toEqual([baru]);
  });

  it('tidak menjalankan dua pengiriman media yang sama secara bersamaan', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pertama = flushPendingMediaUploads();
    expect(await flushPendingMediaUploads()).toBe(0);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    finish(Response.json(konfirmasi));
    expect(await pertama).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    ['konfirmasi tidak lengkap', { ok: true, id: item.id }],
    ['ID media berbeda', { ...konfirmasi, id: 'media-lain' }],
    ['ukuran media berbeda', { ...konfirmasi, media: { ...konfirmasi.media, size: 2 } }]
  ])('mempertahankan antrean ketika %s', async (_kasus, respons) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(respons));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await flushPendingMediaUploads()).toBe(0);
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toEqual([item]);
    expect(pushMediaAssetToFirestore).not.toHaveBeenCalled();
  });

  it('menyimpan unggahan baru dalam antrean jika respons sukses tidak dapat dikonfirmasi', async () => {
    vi.mocked(kompresGambarWebsite).mockResolvedValue(item.dataUrl);
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hasil = await unggahFotoKeServer(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(hasil.storedOnServer).toBe(false);
    expect(simpanMediaWebsite).toHaveBeenCalledWith(expect.objectContaining({ id: hasil.id, dataUrl: item.dataUrl }));
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toContainEqual(expect.objectContaining({ id: hasil.id }));
  });

  it('menyimpan unggahan baru dalam antrean ketika penyimpanan server gagal', async () => {
    vi.mocked(kompresGambarWebsite).mockResolvedValue(item.dataUrl);
    vi.mocked(fetch).mockResolvedValue(Response.json({ pesan: 'Gagal menyimpan media di server.' }, { status: 500 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hasil = await unggahFotoKeServer(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(hasil.storedOnServer).toBe(false);
    expect(JSON.parse(values.get(KUNCI_PENDING_MEDIA)!)).toContainEqual(expect.objectContaining({ id: hasil.id }));
  });

  it('meneruskan peringatan server saat unggahan baru berhasil', async () => {
    vi.mocked(kompresGambarWebsite).mockResolvedValue(item.dataUrl);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const id = (init?.headers as Record<string, string>)['X-Media-Id'];
      return Response.json({
        ...konfirmasi,
        id,
        url: `/api/website/media/${id}`,
        peringatan: 'Foto tersimpan, tetapi audit server gagal.'
      });
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hasil = await unggahFotoKeServer(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(hasil.storedOnServer).toBe(true);
    expect(hasil.peringatan).toMatch(/audit server gagal/i);
  });

  it.each([false, new Error('Firebase tidak tersedia')])(
    'melaporkan kegagalan cadangan Firebase (%s) setelah media tersimpan di server', async (hasil) => {
      Object.assign(authFirebase, { currentUser: { emailVerified: true } });
      if (hasil instanceof Error) {
        vi.mocked(pushMediaAssetToFirestore).mockRejectedValue(hasil);
      } else {
        vi.mocked(pushMediaAssetToFirestore).mockResolvedValue(hasil);
      }
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await flushPendingMediaUploads()).toBe(1);
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith(
        expect.stringContaining('pencadangan Firebase gagal'),
        expect.any(Error)
      ));
      expect(values.has(KUNCI_PENDING_MEDIA)).toBe(false);
    }
  );

  it('menahan antrean media yang rusak tanpa menimpanya', async () => {
    values.set(KUNCI_PENDING_MEDIA, '{"rusak":true}');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await flushPendingMediaUploads()).toBe(0);
    expect(db.tahanSinkronisasi).toHaveBeenCalledWith(expect.stringContaining('tidak dapat dibaca'));
    expect(values.get(KUNCI_PENDING_MEDIA)).toBe('{"rusak":true}');
    expect(fetch).not.toHaveBeenCalled();
  });
});
