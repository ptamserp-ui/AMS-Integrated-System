import { describe, expect, it } from 'vitest';
import {
  buatKatalogProdukDariDaftarHarga,
  normalisasiProdukKatalog,
  perluMigrasiProdukBawaanCms,
  siapkanKatalogProduk
} from '../../src/utils/productCatalog';

describe('katalog rujukan daftar harga AMS V6', () => {
  it('memuat seluruh 114 baris sebagai referensi, bukan produk terverifikasi atau tayang', () => {
    const katalog = buatKatalogProdukDariDaftarHarga();

    expect(katalog).toHaveLength(114);
    expect(new Set(katalog.map((produk) => produk.id)).size).toBe(114);
    expect(new Set(katalog.flatMap((produk) => produk.varianSku.map((varian) => varian.kodeSKU))).size).toBe(114);
    expect(katalog.filter((produk) => produk.kategori === 'BMHP')).toHaveLength(61);
    expect(katalog.filter((produk) => produk.kategori === 'Alat')).toHaveLength(26);
    expect(katalog.filter((produk) => produk.kategori === 'Instrumen')).toHaveLength(27);

    expect(katalog[0]).toMatchObject({
      nama: 'Alcohol Swab/Pad',
      produsen: 'Remedi',
      kategori: 'BMHP',
      isActive: false,
      nomorIzinEdar: '',
      peruntukan: []
    });
    expect(katalog[0]?.varianSku[0]).toMatchObject({
      kodeSKU: 'REF-DH-V6-001',
      hargaTayang: 'Rp 18.870',
      referensiHarga: {
        id: 'Referensi daftar harga AMS V6; harga wajib diverifikasi.',
        en: 'AMS V6 price-list reference; price must be verified.'
      },
      nomorIzinEdar: '',
      satuan: 'box'
    });
    expect(katalog[9]?.tipeModel).toBe('premium; earloop atau tie-on atau hijab');
    expect(katalog[11]?.spesifikasi).toContain('non-oil aerosol; adjustable nose clip');
  });

  it('mengganti produk bawaan CMS tetapi mempertahankan produk manual dan yang dikunci', () => {
    const [referensi] = buatKatalogProdukDariDaftarHarga();
    if (!referensi) throw new Error('Data rujukan produk tidak tersedia');
    const lama = [
      { ...referensi, id: 'produk-dummy', sumberId: 'IE-DUMMY' },
      { ...referensi, id: 'rujuk-produk-dummy', sumberId: 'rujuk-produk-1' },
      { ...referensi, id: 'manual-user', sumberId: undefined },
      { ...referensi, id: 'produk-terkunci', sumberId: 'IE-EDITED', dikunci: true }
    ];

    expect(perluMigrasiProdukBawaanCms(lama)).toBe(true);
    const hasil = siapkanKatalogProduk(lama);

    expect(hasil).toHaveLength(116);
    expect(hasil.some((produk) => produk.id === 'produk-dummy')).toBe(false);
    expect(hasil.some((produk) => produk.id === 'rujuk-produk-dummy')).toBe(false);
    expect(hasil.some((produk) => produk.id === 'manual-user')).toBe(true);
    expect(hasil.some((produk) => produk.id === 'produk-terkunci')).toBe(true);
  });

  it('memisahkan referensi legacy dari harga dan mempertahankan teks per bahasa', () => {
    const [referensi] = buatKatalogProdukDariDaftarHarga();
    if (!referensi) throw new Error('Data rujukan produk tidak tersedia');
    const produk = normalisasiProdukKatalog({
      ...referensi,
      varianSku: [{
        ...referensi.varianSku[0]!,
        hargaTayang: 'Rp 18.870 — referensi PDF, wajib verifikasi',
        referensiHarga: undefined
      }]
    });

    expect(produk.varianSku[0]).toMatchObject({
      hargaTayang: 'Rp 18.870',
      referensiHarga: {
        id: 'Referensi daftar harga AMS V6; harga wajib diverifikasi.',
        en: 'AMS V6 price-list reference; price must be verified.'
      }
    });
  });
});
