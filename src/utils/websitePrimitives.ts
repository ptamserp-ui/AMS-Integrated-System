import type { IzinEdarAlkes, KonfigurasiSitus, ProdukWebsite, TautanWebsite } from '../types';

export const WEBSITE_MEDIA_KEY = 'ams_alkes_website_media_v1';
export const KUNCI_PENDING_MEDIA = 'ams_alkes_pending_media_uploads_v1';
export const STORAGE_PREFIX_PUBLIK = 'ams_alkes_';
export const TAUTAN_KATALOG_RUJUKAN = 'https://remediams.com/product/';
export const TAUTAN_KATALOG_PDF_RUJUKAN = 'https://drive.google.com/file/d/1w2ATfJkJczNrtZn5Ajk4jpl9NGINB7fT/view?usp=drive_link';
export const TAUTAN_DAFTAR_HARGA_RUJUKAN =
  'https://docs.google.com/spreadsheets/d/1cuo6d39fjD2-_b5plNgpyzInaSog3hpV/edit?usp=sharing&ouid=101573847339096922841&rtpof=true&sd=true';

export const KOLEKSI_OPERASIONAL_SITUS_LIST = [
  'stok_gudang',
  'gudang_pengaturan',
  'sales_unit_serial',
  'sales_skema_harga',
  'sales_kontrak',
  'sales_rebate',
  'izin_edar',
  'penarikan_produk',
  'sales_pengetahuan_produk',
  'product_catalog'
] as const;

/** Kunci kategori izin edar untuk tautan filter katalog produk. */
export const KUNCI_KATEGORI: Record<IzinEdarAlkes['kategori'], string> = {
  'Elektromedik Radiasi': 'elektromedik-radiasi',
  'Elektromedik Non Radiasi': 'elektromedik-non-radiasi',
  'Non Elektromedik Steril': 'non-elektromedik-steril',
  'Non Elektromedik Non Steril': 'non-elektromedik-non-steril',
  'Diagnostik In Vitro': 'diagnostik-in-vitro'
};

export function slugifyWebsite(nilai: string): string {
  return String(nilai || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Cocokkan filter kategori baik berupa nama grup katalog REMEDI, kategori regulasi Kemenkes, maupun slug URL. */
export function cocokKategoriProduk(
  produk: Pick<ProdukWebsite, 'kategori' | 'kategoriRegulasi' | 'peruntukan'>,
  filterKategori?: string
): boolean {
  if (!filterKategori || filterKategori === 'Semua') return true;
  const target = filterKategori.trim().toLowerCase();
  const targetSlug = slugifyWebsite(filterKategori);
  const kandidat = [
    produk.kategori,
    produk.kategoriRegulasi,
    ...(produk.peruntukan ?? []),
    produk.kategoriRegulasi
      ? KUNCI_KATEGORI[produk.kategoriRegulasi as IzinEdarAlkes['kategori']]
      : undefined
  ].filter((v): v is string => Boolean(v));

  return kandidat.some((nilai) => nilai.trim().toLowerCase() === target || slugifyWebsite(nilai) === targetSlug);
}

/** Daftar foto produk dengan fallback ke properti tunggal pada konten lama. */
export function fotoProdukSitus(produk: Pick<ProdukWebsite, 'imageUrl' | 'imageUrls'>): string[] {
  const sumber = Array.isArray(produk.imageUrls) ? produk.imageUrls : [produk.imageUrl];
  return sumber
    .filter((rujukan): rujukan is string => typeof rujukan === 'string' && Boolean(rujukan.trim()))
    .map((rujukan) => rujukan.trim());
}

/** href sebuah tautan situs; halaman internal memakai query agar aman dipakai <a>. */
export function hrefTautan(tautan: TautanWebsite | undefined, kontak: KonfigurasiSitus['kontak']): string {
  if (!tautan) return '#';
  switch (tautan.tipe) {
    case 'whatsapp': {
      const nomor = (tautan.nilai || kontak.whatsapp || '').replace(/[^0-9]/g, '');
      if (!nomor) return '#';
      const pesan = encodeURIComponent(
        tautan.nilai && tautan.nilai !== kontak.whatsapp ? tautan.nilai : kontak.pesanPembukaWA
      );
      return `https://wa.me/${nomor}${pesan ? `?text=${pesan}` : ''}`;
    }
    case 'url':
      return tautan.nilai && /^https?:\/\//i.test(tautan.nilai) ? tautan.nilai : '#';
    case 'email':
      return `mailto:${tautan.nilai || kontak.email}`;
    case 'telepon':
      return `tel:${(tautan.nilai || kontak.telepon).replace(/[^+0-9]/g, '')}`;
    case 'halaman':
      return `?halaman=${encodeURIComponent(tautan.nilai || 'beranda')}`;
    default:
      return '#';
  }
}

export interface MediaWebsite {
  id: string;
  nama: string;
  dataUrl: string;
  ukuran: number;
}

let cacheMediaWebsite: MediaWebsite[] | null = null;
const cachePratinjauMemori = new Map<string, string>();
const MAX_PRATINJAU_MEMORI = 80;

export function setPratinjauMemori(id: string, dataUrl: string): void {
  if (!id || !dataUrl) return;
  if (cachePratinjauMemori.size >= MAX_PRATINJAU_MEMORI) {
    const firstKey = cachePratinjauMemori.keys().next().value;
    if (firstKey) cachePratinjauMemori.delete(firstKey);
  }
  cachePratinjauMemori.set(id, dataUrl);
}

export function hapusPratinjauMemori(id: string): void {
  cachePratinjauMemori.delete(id);
}

export function daftarMediaWebsite(): MediaWebsite[] {
  if (cacheMediaWebsite) return cacheMediaWebsite;
  try {
    if (typeof localStorage === 'undefined') return [];
    const tersimpan = localStorage.getItem(WEBSITE_MEDIA_KEY);
    const hasil = tersimpan ? (JSON.parse(tersimpan) as MediaWebsite[]) : [];
    cacheMediaWebsite = Array.isArray(hasil) ? hasil : [];
    return cacheMediaWebsite;
  } catch {
    cacheMediaWebsite = [];
    return cacheMediaWebsite;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === WEBSITE_MEDIA_KEY) cacheMediaWebsite = null;
  });
}

/** Simpan gambar terkompresi di luar konfigurasi agar draf situs tidak membengkak. */
export function simpanMediaWebsite(media: MediaWebsite): MediaWebsite[] {
  const daftar = daftarMediaWebsite().filter((m) => m.id !== media.id);
  const baru = [media, ...daftar];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEBSITE_MEDIA_KEY, JSON.stringify(baru));
    }
    cacheMediaWebsite = baru;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ams:local-setting-write', {
          detail: { key: 'website_media_v1', value: baru }
        })
      );
    }
  } catch {
    return daftar;
  }
  return baru;
}

export function hapusMediaWebsite(id: string): MediaWebsite[] {
  cachePratinjauMemori.delete(id);
  const baru = daftarMediaWebsite().filter((m) => m.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEBSITE_MEDIA_KEY, JSON.stringify(baru));
    }
    cacheMediaWebsite = baru;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ams:local-setting-write', {
          detail: { key: 'website_media_v1', value: baru }
        })
      );
    }
  } catch {
    /* abaikan */
  }
  return baru;
}

/** Nilai gambar bisa berupa URL biasa atau rujukan `media:<id>` yang disajikan langsung oleh server. */
export function selesaikanGambar(referensi?: string): string | undefined {
  if (!referensi) return undefined;
  if (!referensi.startsWith('media:')) return referensi;
  const id = referensi.slice('media:'.length);
  const memUrl = cachePratinjauMemori.get(id);
  if (memUrl) return memUrl;
  const media = daftarMediaWebsite().find((m) => m.id === id);
  return media?.dataUrl ?? `/api/website/media/${encodeURIComponent(id)}`;
}

const objekSitus = (nilai: unknown): nilai is Record<string, unknown> =>
  Boolean(nilai && typeof nilai === 'object' && !Array.isArray(nilai));

const medanTeksOpsional = (objek: Record<string, unknown>, medan: readonly string[]): boolean =>
  medan.every((kunci) => objek[kunci] == null || typeof objek[kunci] === 'string');

const daftarTeksOpsional = (nilai: unknown): boolean =>
  nilai == null || (Array.isArray(nilai) && nilai.every((item) => typeof item === 'string'));

const tautanSitusValid = (nilai: unknown): boolean =>
  nilai == null || (
    objekSitus(nilai) &&
    typeof nilai.tipe === 'string' &&
    ['whatsapp', 'url', 'halaman', 'email', 'telepon'].includes(nilai.tipe) &&
    medanTeksOpsional(nilai, ['nilai'])
  );

const MEDAN_ITEM_SITUS = [
  'nama', 'label', 'judul', 'deskripsi', 'keterangan', 'teks', 'eyebrow', 'subjudul',
  'teksCta', 'teksCtaUtama', 'teksCtaCadangan', 'imageUrl', 'kategori', 'kategoriKey',
  'kategoriRegulasi', 'tipeModel', 'kelasRisiko', 'nomorIzinEdar', 'statusIzinEdar',
  'produsen', 'negaraAsal', 'spesifikasi', 'kodeSKU', 'varianId', 'satuan', 'zonaSuhu',
  'hargaTayang', 'referensiHarga', 'badge', 'dokumenUrl', 'tautanLkpp', 'tautanBrosur',
  'tautanVideo', 'tkdn', 'tahap', 'contoh', 'jenis', 'lokasi', 'tanggalMulai',
  'tanggalSelesai', 'status', 'namaAlkes', 'potongan', 'periode', 'ringkasan', 'tanggal',
  'kutipan', 'penulis', 'jabatan', 'institusi', 'pertanyaan', 'jawaban', 'alamat',
  'telepon', 'email', 'penanggungJawab', 'provinsiDilayani', 'url', 'nilai'
] as const;

const itemSitusValid = (nilai: unknown): nilai is Record<string, unknown> =>
  objekSitus(nilai) &&
  typeof nilai.id === 'string' &&
  typeof nilai.isActive === 'boolean' &&
  medanTeksOpsional(nilai, MEDAN_ITEM_SITUS) &&
  tautanSitusValid(nilai.tautan) &&
  tautanSitusValid(nilai.tautanCtaUtama) &&
  tautanSitusValid(nilai.tautanCtaCadangan);

const kepalaSitusValid = (nilai: unknown): boolean =>
  objekSitus(nilai) &&
  typeof nilai.judul === 'string' &&
  medanTeksOpsional(nilai, ['eyebrow', 'subjudul', 'teksTautan']) &&
  tautanSitusValid(nilai.tautan);

const kolomTautanValid = (nilai: unknown): boolean =>
  objekSitus(nilai) &&
  typeof nilai.id === 'string' &&
  typeof nilai.judul === 'string' &&
  Array.isArray(nilai.tautan) &&
  nilai.tautan.every((item) => itemSitusValid(item) && typeof item.label === 'string');

const DAFTAR_SEKSI_SITUS = [
  'slide', 'kepercayaan', 'solusi', 'statistik', 'produk', 'merek', 'perjalanan',
  'institusi', 'kegiatan', 'promo', 'artikel', 'galeri', 'testimoni', 'faq', 'kantor', 'sosial'
] as const;

/** Periksa struktur yang digunakan renderer, termasuk snapshot lama tanpa tampilan atau varian SKU. */
export const adalahKonfigurasiSitus = (nilai: unknown): nilai is KonfigurasiSitus & Record<string, unknown> => {
  if (!objekSitus(nilai) || typeof nilai.isPublished !== 'boolean' ||
      typeof nilai.lastModifiedAt !== 'number' || !Number.isFinite(nilai.lastModifiedAt)) return false;
  const { identitas, header, hero, menu, konsultasi, tentang, kontak, footerKolom } = nilai;
  if (!objekSitus(identitas) || typeof identitas.nama !== 'string' ||
      !medanTeksOpsional(identitas, ['tagline', 'judulSitus', 'metaDeskripsi', 'logoUrl', 'footerLogoUrl', 'faviconUrl'])) return false;
  if (!objekSitus(header) ||
      !medanTeksOpsional(header, ['utamaTeks', 'cadanganTeks', 'portalTeks', 'portalUrl']) ||
      !tautanSitusValid(header.utamaTautan) || !tautanSitusValid(header.cadanganTautan)) return false;
  if (!objekSitus(hero) || typeof hero.isActive !== 'boolean' || typeof hero.judul !== 'string' ||
      !medanTeksOpsional(hero, ['badge', 'subjudul', 'gambarUrl', 'teksCtaUtama', 'teksCtaCadangan']) ||
      !tautanSitusValid(hero.tautanCtaUtama) || !tautanSitusValid(hero.tautanCtaCadangan) ||
      (hero.banner != null && (!Array.isArray(hero.banner) || !hero.banner.every(itemSitusValid)))) return false;
  if (!Array.isArray(menu) || !menu.every((item) =>
    itemSitusValid(item) && typeof item.label === 'string' &&
    (item.kolom == null || (Array.isArray(item.kolom) && item.kolom.every(kolomTautanValid)))
  )) return false;
  for (const kunci of DAFTAR_SEKSI_SITUS) {
    const seksi = nilai[kunci];
    if (!objekSitus(seksi) || typeof seksi.isActive !== 'boolean' || !kepalaSitusValid(seksi.kepala) ||
        !Array.isArray(seksi.item) || !seksi.item.every(itemSitusValid)) return false;
  }
  const produk = nilai.produk as { item: Record<string, unknown>[] };
  if (!produk.item.every((item) =>
    ['nama', 'kategori', 'produsen', 'nomorIzinEdar'].every((kunci) => typeof item[kunci] === 'string') &&
    daftarTeksOpsional(item.poinJual) && daftarTeksOpsional(item.peruntukan) &&
    daftarTeksOpsional(item.imageUrls) &&
    (item.varianSku == null || (Array.isArray(item.varianSku) && item.varianSku.every((varian) =>
      objekSitus(varian) && typeof varian.id === 'string' && medanTeksOpsional(varian, MEDAN_ITEM_SITUS)
    ))) &&
    (item.tanyaJawabTeknis == null || (Array.isArray(item.tanyaJawabTeknis) && item.tanyaJawabTeknis.every((tanyaJawab) =>
      objekSitus(tanyaJawab) && typeof tanyaJawab.pertanyaan === 'string' && typeof tanyaJawab.jawaban === 'string'
    )))
  )) return false;
  const merek = nilai.merek as { item: Record<string, unknown>[] };
  if (!merek.item.every((item) => typeof item.nama === 'string')) return false;
  if (!objekSitus(konsultasi) || typeof konsultasi.isActive !== 'boolean' ||
      !kepalaSitusValid(konsultasi.kepala) ||
      !medanTeksOpsional(konsultasi, ['catatan', 'teksCta']) || !tautanSitusValid(konsultasi.tautan)) return false;
  if (!objekSitus(tentang) || typeof tentang.isActive !== 'boolean' || !kepalaSitusValid(tentang.kepala) ||
      !Array.isArray(tentang.paragraf) || !tentang.paragraf.every((item) => typeof item === 'string') ||
      !Array.isArray(tentang.capaian) || !tentang.capaian.every((item) =>
        objekSitus(item) && typeof item.nilai === 'string' && typeof item.label === 'string'
      ) || !medanTeksOpsional(tentang, ['imageUrl'])) return false;
  if (!objekSitus(kontak) || typeof kontak.telepon !== 'string' || typeof kontak.email !== 'string' ||
      typeof kontak.pesanPembukaWA !== 'string' ||
      !medanTeksOpsional(kontak, ['whatsapp', 'jamOperasional', 'alamatKantor', 'tautanPeta'])) return false;
  return Array.isArray(footerKolom) && footerKolom.every(kolomTautanValid) &&
    medanTeksOpsional(nilai, ['footerCatatan', 'lastModifiedBy']);
};

export async function muatSnapshotDenganStatus(
  url: string,
  signal?: AbortSignal
): Promise<{ snapshot: KonfigurasiSitus | null; belumAda: boolean }> {
  const controller = new AbortController();
  const batalkan = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', batalkan, { once: true });
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok && res.status !== 404) return { snapshot: null, belumAda: false };
    const teks = await res.text();
    const data = JSON.parse(teks) as unknown;
    if (!res.ok) {
      return {
        snapshot: null,
        belumAda: objekSitus(data) && data.error === 'WEBSITE_NOT_PUBLISHED'
      };
    }
    if (adalahKonfigurasiSitus(data)) return { snapshot: data, belumAda: false };
    const pembungkus = (data as { config?: unknown })?.config;
    if (adalahKonfigurasiSitus(pembungkus)) return { snapshot: pembungkus, belumAda: false };
    console.error('[website] Snapshot yang diterima tidak valid:', url);
    return { snapshot: null, belumAda: false };
  } catch {
    return { snapshot: null, belumAda: false };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', batalkan);
  }
}

export async function muatSnapshot(url: string, signal?: AbortSignal): Promise<KonfigurasiSitus | null> {
  return (await muatSnapshotDenganStatus(url, signal)).snapshot;
}

/** Baca snapshot situs yang disuntikkan server ke window.__AMS_PUBLIC_SITE__ saat render awal. */
export function bacaSnapshotInline(): KonfigurasiSitus | null {
  if (typeof window === 'undefined') return null;
  const kandidat = (window as unknown as { __AMS_PUBLIC_SITE__?: unknown }).__AMS_PUBLIC_SITE__;
  return adalahKonfigurasiSitus(kandidat) ? kandidat : null;
}

/** Baca snapshot terbit langsung dari localStorage tanpa menginisialisasi database ERP. */
export function bacaWebsiteTerbitLokal(): KonfigurasiSitus | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX_PUBLIK}website_published`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return adalahKonfigurasiSitus(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Cek cepat apakah perangkat menyimpan override data operasional/sesi sehingga perlu sinkronisasi ERP. */
export function punyaDataOperasionalLokal(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(`${STORAGE_PREFIX_PUBLIK}sesi_login_v2`)) return true;
    return KOLEKSI_OPERASIONAL_SITUS_LIST.some((k) => localStorage.getItem(`${STORAGE_PREFIX_PUBLIK}${k}`) !== null);
  } catch {
    return false;
  }
}

export interface IdentitasVisualRingan {
  nama: string;
  logoUrl?: string;
  faviconUrl?: string;
}

/** Baca identitas visual tanpa mengimpor `pocketbase.ts` maupun data benih ERP. */
export function bacaIdentitasVisualRingan(): IdentitasVisualRingan {
  try {
    if (typeof localStorage !== 'undefined') {
      const rawDraft = localStorage.getItem(`${STORAGE_PREFIX_PUBLIK}website_draft`);
      const rawPub = localStorage.getItem(`${STORAGE_PREFIX_PUBLIK}website_published`);
      for (const raw of [rawDraft, rawPub]) {
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Partial<KonfigurasiSitus> | null;
        if (parsed?.identitas?.nama) {
          const logoUrl = selesaikanGambar(parsed.identitas.logoUrl);
          const faviconUrl = selesaikanGambar(parsed.identitas.faviconUrl) ?? logoUrl;
          return { nama: parsed.identitas.nama, logoUrl, faviconUrl };
        }
      }
    }
  } catch {
    /* abaikan */
  }
  const inline = bacaSnapshotInline();
  if (inline?.identitas?.nama) {
    const logoUrl = selesaikanGambar(inline.identitas.logoUrl);
    const faviconUrl = selesaikanGambar(inline.identitas.faviconUrl) ?? logoUrl;
    return { nama: inline.identitas.nama, logoUrl, faviconUrl };
  }
  return {
    nama: 'PT Anugrahmitra Selaras',
    logoUrl: '/site/logo-remedi-new-bw.png',
    faviconUrl: '/icon.svg'
  };
}

/** Sinkronkan elemen <link rel="icon"> browser dengan favicon / logo CMS aktif. */
export function terapkanFaviconAplikasi(url?: string) {
  if (!url || typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.href !== url) {
    link.href = url;
  }
}
