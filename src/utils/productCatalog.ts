import type { KonfigurasiSitus, ProdukKatalog, ProdukWebsite, VarianSkuProduk } from '../types';
import { DATA_DAFTAR_HARGA_AMS_V6 } from '../data/productCatalogReference';
import {
  REFERENSI_HARGA_DAFTAR_AMS_V6,
  teksReferensiHarga,
  pisahkanHargaTayang,
  normalisasiProdukKatalog,
  terapkanVarianProduk,
  terapkanReferensiHargaTerjemahan
} from './productCatalogPrimitives';

export {
  REFERENSI_HARGA_DAFTAR_AMS_V6,
  normalisasiProdukKatalog,
  terapkanVarianProduk,
  terapkanReferensiHargaTerjemahan
};

function teksRujukan(nilai: string): string {
  return nilai
    .replace(/^(?:PRODUK|MEREK|MODEL\/TIPE|SPESIFIKASI|DOCUMENTS|UNIT|TKDN|LINK LKPP|GROUP|\(incl\. PPN\))\s*/i, '')
    .replace(/https?:\/\/\S+|(?:www\.)?t2m\.io\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tautanRujukan(nilai: string): string | undefined {
  const hasil = nilai.match(/https?:\/\/\S+|t2m\.io\/\S+/i)?.[0]?.replace(/[),;]+$/, '');
  return hasil ? (hasil.startsWith('http') ? hasil : `https://${hasil}`) : undefined;
}

const KOREKSI_KOLOM_DAFTAR_HARGA: Record<number, { model: string; tambahanSpesifikasi: string }> = {
  10: { model: 'premium; earloop atau tie-on atau hijab', tambahanSpesifikasi: 'hydrophilic; BFE >99%; gramasi 16-25-30' },
  12: { model: 'KN95-C', tambahanSpesifikasi: 'cotton; non-oil aerosol; adjustable nose clip' },
  13: { model: 'KN95-L', tambahanSpesifikasi: 'cotton; non-oil aerosol; adjustable nose clip' },
  44: { model: 'RM 8908', tambahanSpesifikasi: 'pyrogenic, 460mm tubing; soft rounded' },
  52: { model: 'kulit (GT) atau otot (GR)', tambahanSpesifikasi: 'segitiga/cutting (GT), round/taper (GR)' },
  64: { model: 'Star-V17', tambahanSpesifikasi: 'a-Si photodiode; CsI/GOS; 3072x3072' },
  82: { model: 'MTA-100', tambahanSpesifikasi: 'optimized to offer 20, 40, or 60 seconds' },
  85: { model: 'DM-3125', tambahanSpesifikasi: '4sec; 0.4-500mAs; dual focus; c/w tube stand, table top, chest stand, collimator' },
  113: { model: 'S|M|L', tambahanSpesifikasi: 'stainless steel, 75x20 small | 95x30mm medium | 115x35mm large' }
};

/** Prices and temporary reference codes are copied for review, not operational authorization. */
export function buatKatalogProdukDariDaftarHarga(): ProdukKatalog[] {
  return DATA_DAFTAR_HARGA_AMS_V6.map((baris) => {
    const kodeRujukan = `REF-DH-V6-${String(baris.no).padStart(3, '0')}`;
    let nama = teksRujukan(baris.name);
    let produsen = teksRujukan(baris.brand);
    const koreksi = KOREKSI_KOLOM_DAFTAR_HARGA[baris.no];
    let model = koreksi?.model ?? teksRujukan(baris.model);
    const merekDikenal = ['Hohlkorpel', 'SafeMask', 'RemediTech'];
    if (!produsen) {
      const merek = merekDikenal.find((item) => nama.endsWith(` ${item}`));
      if (merek) {
        produsen = merek;
        nama = nama.slice(0, -merek.length).trim();
      }
    }
    if (produsen && nama.endsWith(` ${produsen}`)) nama = nama.slice(0, -produsen.length).trim();
    if (/^Remedi\s+.+/i.test(produsen) && !koreksi) {
      const rincianModel = produsen.slice('Remedi'.length).trim();
      produsen = 'Remedi';
      model = [rincianModel, model].filter(Boolean).join(' ');
    } else if (/^Remedi\s+.+/i.test(produsen)) {
      produsen = 'Remedi';
    }

    const kelompok = (baris.group + ' ' + baris.lkpp)
      .match(/(?:^|\s)\d?\s*(BMHP|Instrumen|Alat)(?=\s|$)/i)?.[1] ?? 'Umum';
    const harga = (baris.price + ' ' + baris.tkdn)
      .match(/\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b/)?.[0];
    const tkdn = Array.from(new Set((baris.tkdn + ' ' + baris.price).match(/(?:PDN|proses|\d{1,3},\d{2}%)/gi) ?? []));
    const urlDokumen = tautanRujukan(baris.docs);
    const urlLkpp = tautanRujukan(baris.lkpp);
    const spesifikasi = [koreksi?.tambahanSpesifikasi, teksRujukan(baris.spec)].filter(Boolean).join('; ');
    const satuan = teksRujukan(baris.unit).split(' ')[0] ?? '';
    const hargaTayang = harga ? `Rp ${harga}` : 'Belum tercantum';
    const statusIzinEdar = 'Belum diverifikasi — referensi daftar harga';

    return {
      id: `ams-daftar-harga-v6-${String(baris.no).padStart(3, '0')}`,
      sumberId: `daftar-harga-ams-v6:${String(baris.no).padStart(3, '0')}`,
      isActive: false,
      badge: 'Rujukan awal — perlu verifikasi',
      nama,
      tipeModel: model,
      kategori: kelompok,
      kategoriRegulasi: '',
      kelasRisiko: '',
      nomorIzinEdar: '',
      statusIzinEdar,
      produsen,
      negaraAsal: '',
      spesifikasi,
      poinJual: [],
      tautanBrosur: urlDokumen,
      peruntukan: [],
      varianSku: [{
        id: `ams-daftar-harga-v6-sku-${String(baris.no).padStart(3, '0')}`,
        kodeSKU: kodeRujukan,
        tipeModel: model,
        nomorIzinEdar: '',
        statusIzinEdar,
        produsen,
        hargaTayang,
        referensiHarga: REFERENSI_HARGA_DAFTAR_AMS_V6,
        satuan,
        dokumenUrl: urlDokumen,
        tautanLkpp: urlLkpp,
        tkdn: tkdn.join(', ')
      }]
    };
  });
}

function produkBawaanCms(produk: ProdukKatalog): boolean {
  const berasalDariCms =
    (produk.id.startsWith('produk-') && Boolean(produk.sumberId)) ||
    Boolean(produk.sumberId?.startsWith('rujuk-produk-'));
  return berasalDariCms && !produk.dikunci;
}

export function perluMigrasiProdukBawaanCms(katalog: ProdukKatalog[]): boolean {
  return !katalog.some((produk) => produk.sumberId?.startsWith('daftar-harga-ams-v6:')) &&
    katalog.some(produkBawaanCms);
}

export function siapkanKatalogProduk(tersimpan?: ProdukKatalog[]): ProdukKatalog[] {
  if (!Array.isArray(tersimpan)) return buatKatalogProdukDariDaftarHarga();
  const katalog = tersimpan.map(normalisasiProdukKatalog);
  if (!perluMigrasiProdukBawaanCms(katalog)) return katalog;

  const dataManual = katalog.filter((produk) =>
    !produkBawaanCms(produk)
  );
  return [...buatKatalogProdukDariDaftarHarga(), ...dataManual];
}

/** Migrates both existing CMS snapshots without losing edited content or products. */
export function migrasikanKatalogProduk(
  draf: KonfigurasiSitus,
  terbit: KonfigurasiSitus | null
): ProdukKatalog[] {
  const hasil = new Map<string, ProdukKatalog>();
  for (const produk of [...(terbit?.produk.item ?? []), ...draf.produk.item]) {
    hasil.set(produk.id, normalisasiProdukKatalog(produk));
  }
  return Array.from(hasil.values());
}

export function produkKatalogUntukWebsite(
  katalog: ProdukKatalog[],
  pilihanWebsite: ProdukWebsite[]
): ProdukWebsite[] {
  const statusTayang = new Map(pilihanWebsite.map((produk) => [produk.id, produk.isActive]));
  return katalog.map((produk) => ({
    ...produk,
    isActive: statusTayang.get(produk.id) ?? false
  }));
}

/** Sales tools select individual SKU rows, while the public website presents product families. */
export function produkKatalogUntukPenjualan(katalog: ProdukKatalog[]): ProdukWebsite[] {
  return katalog.flatMap((produk) =>
    produk.varianSku.length > 0
      ? produk.varianSku.map((varian) => terapkanVarianProduk(produk, varian))
      : [produk]
  );
}
