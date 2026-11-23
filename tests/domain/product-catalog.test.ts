import { describe, expect, it } from 'vitest';
import {
  buatKatalogProdukDariDaftarHarga,
  normalisasiProdukKatalog,
  perluMigrasiProdukBawaanCms,
  produkKatalogUntukWebsite,
  siapkanKatalogProduk,
  terapkanReferensiHargaTerjemahan
} from '../../src/utils/productCatalog';

import {
  bangunKontenDefault,
  selaraskanKontenOperasional,
  sinkronkanKonten
} from '../../src/utils/website';

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
      referensiHarga: 'Referensi daftar harga AMS V6; harga wajib diverifikasi.',
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

  it('memisahkan referensi legacy dari harga menjadi satu teks sumber', () => {
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
      referensiHarga: 'Referensi daftar harga AMS V6; harga wajib diverifikasi.'
    });
  });

  it('mempertahankan referensi varian hasil terjemahan saat katalog diselaraskan', () => {
    const [referensi] = buatKatalogProdukDariDaftarHarga();
    if (!referensi) throw new Error('Data rujukan produk tidak tersedia');
    const versiIndonesia = normalisasiProdukKatalog(referensi);
    const varian = versiIndonesia.varianSku[0];
    if (!varian) throw new Error('Varian rujukan produk tidak tersedia');
    const versiInggris = {
      ...versiIndonesia,
      varianSku: [{ ...varian, referensiHarga: 'AMS V6 price-list reference; price must be verified.' }]
    };

    const hasil = terapkanReferensiHargaTerjemahan([versiIndonesia], [versiInggris], 'en');

    expect(hasil[0]?.varianSku?.[0]?.referensiHarga)
      .toBe('AMS V6 price-list reference; price must be verified.');
  });

  it('menampilkan seluruh produk katalog di CMS sambil mempertahankan status publish', () => {
    const katalog = buatKatalogProdukDariDaftarHarga().slice(0, 3);
    const sebelumnya = katalog[0];
    if (!sebelumnya) throw new Error('Data rujukan produk tidak tersedia');
    const terpilih = produkKatalogUntukWebsite(katalog, [{ ...sebelumnya, isActive: true }]);

    expect(terpilih.map((produk) => produk.id)).toEqual(katalog.map((produk) => produk.id));
    expect(terpilih.map((produk) => produk.isActive)).toEqual([true, false, false]);
  });

  it('otomatis memunculkan produk baru dari Product Catalog ke CMS Website dan mempertahankannya saat publish', () => {
    const katalogDasar = buatKatalogProdukDariDaftarHarga().slice(0, 2);
    const produkBaru = normalisasiProdukKatalog({
      ...katalogDasar[0]!,
      id: 'produk-baru-commercial',
      sumberId: undefined,
      dikunci: true,
      isActive: true,
      nama: 'Patient Monitor Seri Z9',
      varianSku: [{
        ...katalogDasar[0]!.varianSku[0]!,
        id: 'sku-z9',
        kodeSKU: 'AMS-PM-Z9'
      }]
    });
    const katalogLengkap = [produkBaru, ...katalogDasar];

    const drafAwal = bangunKontenDefault({
      izinEdar: [],
      sertifikat: [],
      pemasok: [],
      pelanggan: [],
      kampanye: [],
      teritorial: [],
      stok: [],
      pengetahuanProduk: [],
      skemaHarga: [],
      rebate: [],
      garansi: [],
      produkKatalog: katalogLengkap
    });

    // Produk baru muncul di daftar CMS dalam status Draft sampai dipilih publish di CMS
    const butirCms = drafAwal.produk.item.find((p) => p.id === 'produk-baru-commercial');
    expect(butirCms?.nama).toBe('Patient Monitor Seri Z9');
    expect(butirCms?.isActive).toBe(false);

    // Simulasi admin mencentang Publish di Website CMS lalu klik Sinkron dari Data Aplikasi
    const drafDipilih = {
      ...drafAwal,
      produk: {
        ...drafAwal.produk,
        item: drafAwal.produk.item.map((p) =>
          p.id === 'produk-baru-commercial' ? { ...p, isActive: true } : p
        )
      }
    };
    const pascaSinkron = sinkronkanKonten(drafDipilih, {
      izinEdar: [],
      sertifikat: [],
      pemasok: [],
      pelanggan: [],
      kampanye: [],
      teritorial: [],
      stok: [],
      pengetahuanProduk: [],
      skemaHarga: [],
      rebate: [],
      garansi: [],
      produkKatalog: katalogLengkap
    });
    expect(pascaSinkron.produk.item.find((p) => p.id === 'produk-baru-commercial')?.isActive).toBe(true);

    // Di perangkat pengunjung dengan cache product_catalog lama, produk terbit tetap tayang
    const tayang = selaraskanKontenOperasional(
      { ...pascaSinkron, isPublished: true },
      {
        izinEdar: [],
        stok: [],
        unitSerial: [],
        penarikan: [],
        skemaHarga: [],
        kontrakHarga: [],
        pengetahuanProduk: [],
        rebate: [],
        produkKatalog: katalogDasar
      }
    );
    expect(tayang.produk.item.some((p) => p.id === 'produk-baru-commercial' && p.isActive)).toBe(true);
  });

  it('menyalin SKU, harga tayang, NIE, dan satuan dari varian pertama ke induk dan tidak menggandakan produk saat padukanKonten', async () => {
    const { padukanKonten } = await import('../../src/utils/website');
    const [referensi] = buatKatalogProdukDariDaftarHarga();
    if (!referensi) throw new Error('Data rujukan produk tidak tersedia');

    const inputForm = normalisasiProdukKatalog({
      ...referensi,
      id: 'produk-manual-user-1',
      sumberId: undefined,
      dikunci: true,
      nama: 'USG Portable 4D',
      kodeSKU: undefined,
      nomorIzinEdar: '',
      statusIzinEdar: 'Verifikasi Register RA',
      hargaTayang: undefined,
      satuan: undefined,
      varianSku: [
        {
          id: 'sku-usg-1',
          kodeSKU: 'AMS-USG-4D',
          tipeModel: 'U4D-Pro',
          nomorIzinEdar: 'KEMENKES RI AKL 20501122334',
          statusIzinEdar: 'Aktif',
          hargaTayang: 'Rp 95.000.000',
          satuan: 'Unit',
          dokumenUrl: 'https://remediams.com/brosur/usg-4d.pdf',
          tautanLkpp: 'https://e-katalog.lkpp.go.id/usg-4d'
        }
      ]
    });

    expect(inputForm.kodeSKU).toBe('AMS-USG-4D');
    expect(inputForm.nomorIzinEdar).toBe('KEMENKES RI AKL 20501122334');
    expect(inputForm.statusIzinEdar).toBe('Aktif');
    expect(inputForm.hargaTayang).toBe('Rp 95.000.000');
    expect(inputForm.satuan).toBe('Unit');
    expect(inputForm.dokumenUrl).toBe('https://remediams.com/brosur/usg-4d.pdf');
    expect(inputForm.tautanLkpp).toBe('https://e-katalog.lkpp.go.id/usg-4d');

    const produkDihapus = { ...inputForm, id: 'produk-manual-terhapus', nama: 'Produk Lama Dihapus', isActive: true };
    const baru = bangunKontenDefault({
      izinEdar: [],
      sertifikat: [],
      pemasok: [],
      pelanggan: [],
      kampanye: [],
      teritorial: [],
      stok: [],
      pengetahuanProduk: [],
      skemaHarga: [],
      rebate: [],
      garansi: [],
      produkKatalog: [inputForm, referensi]
    });
    const lama = {
      ...baru,
      produk: {
        ...baru.produk,
        item: [{ ...inputForm, isActive: true }, produkDihapus, { ...referensi, isActive: false }]
      }
    };

    const hasilPaduan = padukanKonten(lama, baru);
    expect(hasilPaduan.produk.item.filter((p) => p.id === 'produk-manual-user-1')).toHaveLength(1);
    expect(hasilPaduan.produk.item.find((p) => p.id === 'produk-manual-user-1')?.isActive).toBe(true);
    expect(hasilPaduan.produk.item.some((p) => p.id === 'produk-manual-terhapus')).toBe(false);
  });
});
