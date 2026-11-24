import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { bangunKontenDefault } from '../../src/utils/website';
import { adalahKonfigurasiSitus, muatSnapshot } from '../../src/utils/websitePrimitives';
import { tampilanEfektif } from '../../src/utils/tampilan';

function snapshot() {
  return bangunKontenDefault({
    izinEdar: [], sertifikat: [], pemasok: [], pelanggan: [], kampanye: [], teritorial: [],
    stok: [], pengetahuanProduk: [], skemaHarga: [], rebate: [], garansi: [], produkKatalog: []
  });
}

describe('sumber snapshot situs publik', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('menerima snapshot bawaan dan snapshot lama tanpa tampilan atau varian SKU', () => {
    const bawaan = JSON.parse(readFileSync('public/website-published.json', 'utf8')) as unknown;
    expect(adalahKonfigurasiSitus(bawaan)).toBe(true);
    const lama = snapshot();
    delete lama.tampilan;
    expect(adalahKonfigurasiSitus(lama)).toBe(true);
  });

  it.each([
    undefined,
    { warnaUtama: ' #0D9488 ', warnaAksen: '#0F766E' },
    { warnaUtama: 'invalid', warnaAksen: '' }
  ])('menampilkan merek biru pada snapshot lama atau warna tidak valid (%j)', async (tampilan) => {
    const cfg = snapshot();
    cfg.tampilan = tampilan ? { ...tampilanEfektif({}), ...tampilan } : undefined;
    const sebelum = structuredClone(cfg);
    const storage = { getItem: () => null };
    vi.stubGlobal('window', { location: { search: '' }, localStorage: storage });
    vi.stubGlobal('sessionStorage', storage);
    const { default: PublicWebsite } = await import('../../src/components/modules/website/site/PublicWebsite');
    const html = renderToString(createElement(PublicWebsite, { konfigurasi: cfg }));
    expect(html).toContain('--brand:#2a6199;--brand-aksen:#245382');
    expect(cfg).toEqual(sebelum);
  });

  it('mempertahankan warna kustom selain tosca lama serta pilihan tata letak', () => {
    const tampilan = {
      warnaUtama: '#4338CA',
      warnaAksen: '#9f1239',
      templateId: 'remedi-gelap' as const,
      fontId: 'open-sans' as const
    };
    expect(tampilanEfektif({ tampilan })).toMatchObject({
      ...tampilan,
      warnaUtama: '#4338ca'
    });
  });

  it('menolak snapshot tidak lengkap atau struktur yang akan merusak renderer', () => {
    const lengkap = snapshot();
    expect(adalahKonfigurasiSitus({ identitas: lengkap.identitas, hero: lengkap.hero })).toBe(false);
    expect(adalahKonfigurasiSitus({ ...lengkap, produk: { ...lengkap.produk, item: null } })).toBe(false);
    expect(adalahKonfigurasiSitus({ ...lengkap, tentang: { ...lengkap.tentang, paragraf: [null] } })).toBe(false);
    expect(adalahKonfigurasiSitus({ ...lengkap, footerKolom: [{ id: 'footer', judul: 'Footer', tautan: {} }] })).toBe(false);
    expect(adalahKonfigurasiSitus({
      ...lengkap,
      produk: { ...lengkap.produk, item: [{ id: 'p', isActive: true, nama: 'Produk', kategori: 2, produsen: '', nomorIzinEdar: '' }] }
    })).toBe(false);
  });

  it('mengutamakan status server meskipun jam cache lokal lebih baru', async () => {
    const lokal = { ...snapshot(), isPublished: true, lastModifiedAt: 9999999999999 };
    const server = { ...snapshot(), isPublished: false, lastModifiedAt: 1 };
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'ams_alkes_website_published' ? JSON.stringify(lokal) : null
    });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ config: server }));
    vi.stubGlobal('fetch', fetchMock);

    const { tentukanKontenTayang } = await import('../../src/components/modules/website/site/PublicWebsiteApp');
    expect(await tentukanKontenTayang()).toEqual({ konfigurasi: server, status: 'tahan' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('menggunakan cache lokal ketika kedua snapshot jaringan tidak tersedia', async () => {
    const lokal = { ...snapshot(), isPublished: true };
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'ams_alkes_website_published' ? JSON.stringify(lokal) : null
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));

    const { tentukanKontenTayang } = await import('../../src/components/modules/website/site/PublicWebsiteApp');
    expect(await tentukanKontenTayang()).toEqual({ konfigurasi: lokal, status: 'tayang' });
  });

  it('tidak menayangkan cache usang ketika server menyatakan belum ada publikasi', async () => {
    const lokal = { ...snapshot(), isPublished: true };
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'ams_alkes_website_published' ? JSON.stringify(lokal) : null
    });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'WEBSITE_NOT_PUBLISHED' }, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { tentukanKontenTayang } = await import('../../src/components/modules/website/site/PublicWebsiteApp');
    expect(await tentukanKontenTayang()).toEqual({ konfigurasi: null, status: 'belum' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('menunggu server sebelum merender cache lokal pada halaman awal dan /web', async () => {
    const lokal = { ...snapshot(), isPublished: true };
    lokal.hero.judul = 'Konten cache lama';
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'ams_alkes_website_published' ? JSON.stringify(lokal) : null
    });

    const { default: PublicWebsiteApp } = await import('../../src/components/modules/website/site/PublicWebsiteApp');
    const { default: HalamanDepan } = await import('../../src/components/modules/website/site/HalamanDepan');
    const web = renderToString(createElement(PublicWebsiteApp));
    const beranda = renderToString(createElement(HalamanDepan, { onMasuk: () => {} }));
    expect(web).toContain('Memuat konten situs');
    expect(beranda).toContain('Memuat halaman');
    expect(web).not.toContain('Konten cache lama');
    expect(beranda).not.toContain('Konten cache lama');
  });

  it('mempertahankan satu formulir RFQ yang tersembunyi di halaman tanpa kontak', async () => {
    const storage = { getItem: () => null };
    vi.stubGlobal('sessionStorage', storage);
    const { default: PublicWebsite } = await import('../../src/components/modules/website/site/PublicWebsite');
    for (const halaman of ['kontak', 'layanan', 'produk', 'sumber-daya', 'beranda']) {
      vi.stubGlobal('window', { location: { search: `?halaman=${halaman}` }, localStorage: storage });
      const html = renderToString(createElement(PublicWebsite, { konfigurasi: snapshot() }));
      expect(html.match(/id="formulir-rfq-publik"/g)).toHaveLength(1);
      expect(html).toMatch(halaman === 'kontak' || halaman === 'layanan'
        ? /<div><section[^>]*id="formulir-rfq-publik"/
        : /<div hidden=""><section[^>]*id="formulir-rfq-publik"/);
    }
  });

  it('menghentikan permintaan snapshot yang tidak merespons', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    const janji = muatSnapshot('/api/website/published');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(janji).resolves.toBeNull();
  });

  it('memulai cadangan lebih awal agar dua permintaan macet tidak menunda cache selama sepuluh detik', async () => {
    vi.useFakeTimers();
    const lokal = { ...snapshot(), isPublished: true };
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'ams_alkes_website_published' ? JSON.stringify(lokal) : null
    });
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { tentukanKontenTayang } = await import('../../src/components/modules/website/site/PublicWebsiteApp');
    const hasil = tentukanKontenTayang();
    await vi.advanceTimersByTimeAsync(5300);
    await expect(hasil).resolves.toEqual({ konfigurasi: lokal, status: 'tayang' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
