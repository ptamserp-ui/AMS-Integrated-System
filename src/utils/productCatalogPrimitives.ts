import type { ProdukKatalog, ProdukWebsite, VarianSkuProduk } from '../types';

export const REFERENSI_HARGA_DAFTAR_AMS_V6 = 'Referensi daftar harga AMS V6; harga wajib diverifikasi.';

export function teksReferensiHarga(nilai: unknown, bahasa: 'id' | 'en'): string | undefined {
  if (typeof nilai === 'string') return nilai.trim() ? nilai : undefined;
  if (!nilai || typeof nilai !== 'object') return undefined;
  const lama = nilai as { id?: unknown; en?: unknown };
  const pilihan = lama[bahasa];
  if (typeof pilihan === 'string' && pilihan.trim()) return pilihan;
  const cadangan = bahasa === 'en' ? lama.id : lama.en;
  return typeof cadangan === 'string' && cadangan.trim() ? cadangan : undefined;
}

export function pisahkanHargaTayang(
  hargaTayang?: string,
  referensiHarga?: unknown
): { hargaTayang?: string; referensiHarga?: string } {
  const referensi = teksReferensiHarga(referensiHarga, 'id');
  if (!hargaTayang) return { hargaTayang, referensiHarga: referensi };
  const lama =
    hargaTayang.match(/^(.*?)\s+[—–-]\s*(?:referensi PDF,?\s*)?wajib verifikasi\s*$/i) ??
    hargaTayang.match(/^(.*?)\s+[—–-]\s*verifikasi\s*$/i);
  if (!lama) return { hargaTayang, referensiHarga: referensi };
  return {
    hargaTayang: lama[1]?.trim(),
    referensiHarga: referensi ?? REFERENSI_HARGA_DAFTAR_AMS_V6
  };
}

function varianWarisan(produk: ProdukWebsite): VarianSkuProduk {
  return {
    id: `sku-${produk.id}`,
    kodeSKU: produk.kodeSKU ?? '',
    tipeModel: produk.tipeModel,
    nomorIzinEdar: produk.nomorIzinEdar,
    statusIzinEdar: produk.statusIzinEdar,
    kategoriRegulasi: produk.kategoriRegulasi,
    kelasRisiko: produk.kelasRisiko,
    produsen: produk.produsen,
    negaraAsal: produk.negaraAsal,
    hargaTayang: produk.hargaTayang,
    referensiHarga: produk.referensiHarga,
    satuan: produk.satuan,
    zonaSuhu: produk.zonaSuhu,
    imageUrl: produk.imageUrl,
    dokumenUrl: produk.dokumenUrl,
    tautanLkpp: produk.tautanLkpp,
    tkdn: produk.tkdn
  };
}

export function normalisasiProdukKatalog(produk: ProdukWebsite): ProdukKatalog {
  const varianMentah =
    Array.isArray(produk.varianSku) && produk.varianSku.length ? produk.varianSku : [varianWarisan(produk)];
  const hargaProduk = pisahkanHargaTayang(produk.hargaTayang, produk.referensiHarga);
  const varianSku = varianMentah.map((varian) => ({
    ...varian,
    ...pisahkanHargaTayang(varian.hargaTayang, varian.referensiHarga)
  }));
  const varianUtama = varianSku[0];
  const statusDefaultInduk =
    !produk.statusIzinEdar ||
    produk.statusIzinEdar === 'Verifikasi Register RA' ||
    produk.statusIzinEdar === 'Belum diverifikasi — referensi daftar harga';
  return {
    ...produk,
    ...hargaProduk,
    kodeSKU: produk.kodeSKU || varianUtama?.kodeSKU || undefined,
    tipeModel: produk.tipeModel || varianUtama?.tipeModel || '',
    nomorIzinEdar: produk.nomorIzinEdar || varianUtama?.nomorIzinEdar || '',
    statusIzinEdar:
      statusDefaultInduk && varianUtama?.statusIzinEdar
        ? varianUtama.statusIzinEdar
        : produk.statusIzinEdar || varianUtama?.statusIzinEdar || '',
    hargaTayang: hargaProduk.hargaTayang || varianUtama?.hargaTayang || undefined,
    referensiHarga: hargaProduk.referensiHarga ?? teksReferensiHarga(varianUtama?.referensiHarga, 'id'),
    satuan: produk.satuan || varianUtama?.satuan || undefined,
    zonaSuhu: produk.zonaSuhu || varianUtama?.zonaSuhu || undefined,
    dokumenUrl: produk.dokumenUrl || varianUtama?.dokumenUrl || undefined,
    tautanLkpp: produk.tautanLkpp || varianUtama?.tautanLkpp || undefined,
    tkdn: produk.tkdn || varianUtama?.tkdn || undefined,
    imageUrl: produk.imageUrl || produk.imageUrls?.[0] || varianUtama?.imageUrl || undefined,
    peruntukan: Array.isArray(produk.peruntukan) ? produk.peruntukan : [],
    varianSku
  };
}

export function terapkanVarianProduk(produk: ProdukWebsite, varian: VarianSkuProduk): ProdukWebsite {
  return {
    ...produk,
    id: `${produk.id}::${varian.id}`,
    varianId: varian.id,
    kodeSKU: varian.kodeSKU,
    tipeModel: varian.tipeModel || produk.tipeModel,
    nomorIzinEdar: varian.nomorIzinEdar || produk.nomorIzinEdar,
    statusIzinEdar: varian.statusIzinEdar || produk.statusIzinEdar,
    referensiHarga: varian.referensiHarga ?? produk.referensiHarga,
    kategoriRegulasi: varian.kategoriRegulasi || produk.kategoriRegulasi,
    kelasRisiko: varian.kelasRisiko || produk.kelasRisiko,
    produsen: varian.produsen || produk.produsen,
    negaraAsal: varian.negaraAsal || produk.negaraAsal,
    hargaTayang: varian.hargaTayang || produk.hargaTayang,
    stokTersedia: varian.stokTersedia,
    satuan: varian.satuan || produk.satuan,
    zonaSuhu: varian.zonaSuhu || produk.zonaSuhu,
    imageUrl: varian.imageUrl || produk.imageUrl,
    imageUrls: varian.imageUrl ? [varian.imageUrl] : produk.imageUrls,
    dokumenUrl: varian.dokumenUrl || produk.dokumenUrl,
    tautanLkpp: varian.tautanLkpp || produk.tautanLkpp,
    tkdn: varian.tkdn || produk.tkdn
  };
}

export function terapkanReferensiHargaTerjemahan(
  produk: ProdukWebsite[],
  terjemahan: ProdukWebsite[],
  bahasa: 'id' | 'en'
): ProdukWebsite[] {
  const terjemahanPerProduk = new Map(terjemahan.map((item) => [item.id, item]));
  return produk.map((item) => {
    const versiTerjemahan = terjemahanPerProduk.get(item.id);
    if (!versiTerjemahan) {
      return {
        ...item,
        referensiHarga: teksReferensiHarga(item.referensiHarga, bahasa),
        varianSku: (item.varianSku ?? []).map((varian) => ({
          ...varian,
          referensiHarga: teksReferensiHarga(varian.referensiHarga, bahasa)
        }))
      };
    }
    const referensiPerSku = new Map(
      (versiTerjemahan.varianSku ?? []).map((varian) => [
        varian.id,
        teksReferensiHarga(varian.referensiHarga, bahasa)
      ])
    );
    return {
      ...item,
      referensiHarga:
        teksReferensiHarga(versiTerjemahan.referensiHarga, bahasa) ??
        teksReferensiHarga(item.referensiHarga, bahasa),
      varianSku: (item.varianSku ?? []).map((varian) => ({
        ...varian,
        referensiHarga:
          referensiPerSku.get(varian.id) ?? teksReferensiHarga(varian.referensiHarga, bahasa)
      }))
    };
  });
}
