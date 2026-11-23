import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatProspekWebsite } from '../../server/websiteRfq';
import { AMSDatabaseManager } from '../../src/services/pocketbase';
import { VERSI_KONTEN_WEBSITE } from '../../src/utils/website';

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

describe('persistensi draf website', () => {
  let storage: MemoryStorage;
  let manager: AMSDatabaseManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    manager = new AMSDatabaseManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mempertahankan identitas, hero, judul dan urutan item saat metadata versi tidak tersedia', () => {
    const awal = manager.getWebsiteDraft();
    const item = awal.faq.item.slice(0, 2).reverse().map((entry) => ({ ...entry, dikunci: false }));
    const lama = {
      ...awal,
      identitas: { ...awal.identitas, nama: 'Nama hasil suntingan' },
      hero: { ...awal.hero, judul: 'Judul hasil suntingan' },
      faq: { ...awal.faq, kepala: { ...awal.faq.kepala, judul: 'FAQ khusus' }, item }
    };
    storage.setItem('ams_alkes_website_draft', JSON.stringify(lama));
    storage.removeItem('ams_alkes_website_content_v');

    const dipulihkan = manager.getWebsiteDraft();
    expect(dipulihkan.identitas.nama).toBe('Nama hasil suntingan');
    expect(dipulihkan.hero.judul).toBe('Judul hasil suntingan');
    expect(dipulihkan.faq.kepala.judul).toBe('FAQ khusus');
    expect(dipulihkan.faq.item).toEqual(item);
    expect(JSON.parse(storage.getItem('ams_alkes_website_content_v')!)).toBe(VERSI_KONTEN_WEBSITE);
  });

  it('menyinkronkan data aplikasi dari draf aktif, bukan mengganti suntingan dengan draf tersimpan lama', () => {
    const awal = manager.getWebsiteDraft();
    const disunting = {
      ...awal,
      identitas: { ...awal.identitas, nama: 'Nama belum disimpan' },
      hero: { ...awal.hero, judul: 'Hero belum disimpan' }
    };
    const { baru } = manager.sinkronkanWebsiteDraft('Admin Uji', 'Admin', disunting);

    expect(baru.identitas.nama).toBe('Nama belum disimpan');
    expect(manager.getWebsiteDraft().hero.judul).toBe('Hero belum disimpan');
  });

  it('melaporkan kegagalan penyimpanan draf alih-alih mengaku berhasil', () => {
    const draf = manager.getWebsiteDraft();
    storage.failKey = 'ams_alkes_website_draft';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => manager.simpanWebsiteDraft(
      { ...draf, identitas: { ...draf.identitas, nama: 'Tidak tersimpan' } },
      'Admin Uji',
      'Admin'
    )).toThrow(/tidak dapat disimpan/i);
    expect(manager.getWebsiteDraft().identitas.nama).not.toBe('Tidak tersimpan');
  });

  it('tidak menimpa publikasi yang lebih baru dengan respons server yang terlambat', () => {
    const draf = manager.getWebsiteDraft();
    const baru = { ...draf, isPublished: true, hero: { ...draf.hero, judul: 'Versi terbaru' } };
    const lama = { ...draf, isPublished: true, hero: { ...draf.hero, judul: 'Respons lama' } };
    manager.catatWebsiteTerbit(baru, 'Admin Uji', 'Admin', 2);

    expect(() => manager.catatWebsiteTerbit(lama, 'Admin Uji', 'Admin', 1)).toThrow(/publikasi server yang lebih baru/i);
    expect(manager.getWebsiteTerbit()).toEqual(baru);
  });

  it('menampilkan RFQ server di CRM dan mempertahankan tahap yang sudah diproses', () => {
    const hasil = buatProspekWebsite({
      requestId: 'aa115a5a-8a88-4a55-9a77-012345678901',
      namaInstansi: 'Klinik Sintetis',
      tipeInstansi: 'Klinik',
      namaPemohon: 'Petugas Uji',
      kontakPemohon: 'uji@example.invalid',
      jalurPengadaan: 'Permintaan Penawaran Reguler (RFQ)',
      subjek: '',
      pesan: 'Kebutuhan sintetis',
      produk: []
    });
    if (!hasil.ok) throw new Error(hasil.pesan);
    storage.setItem('ams_alkes_sales_website_rfq', JSON.stringify([hasil.prospek]));

    expect(manager.getProspek().find((item) => item.id === hasil.prospek.id)?.tahap).toBe('Penawaran Resmi');
    manager.majukanTahapProspek(hasil.prospek.id, 'Pemenang');
    const diproses = manager.getProspek().filter((item) => item.id === hasil.prospek.id);
    expect(diproses).toHaveLength(1);
    expect(diproses[0].tahap).toBe('Pemenang');
  });
});
