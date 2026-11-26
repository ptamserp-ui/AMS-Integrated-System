import type { PenjualanAlkes, PromosiFOC } from '../types';

export function validasiPromosiFOC(promosi: PromosiFOC): string[] {
  const sebab: string[] = [];
  const tanggalValid = (tanggal: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(tanggal) &&
    Number.isFinite(Date.parse(`${tanggal}T00:00:00Z`)) &&
    new Date(`${tanggal}T00:00:00Z`).toISOString().slice(0, 10) === tanggal;
  if (!promosi.nama.trim()) sebab.push('Nama promosi wajib diisi.');
  if (!promosi.skuPemicu.trim()) sebab.push('SKU pemicu wajib diisi.');
  if (!Number.isInteger(promosi.minimumPembelian) || promosi.minimumPembelian < 1)
    sebab.push('Minimum pembelian harus berupa bilangan bulat positif.');
  if (!Number.isInteger(promosi.maksimumKitPerPesanan) || promosi.maksimumKitPerPesanan < 1)
    sebab.push('Maksimum kit per pesanan harus berupa bilangan bulat positif.');
  if (!tanggalValid(promosi.berlakuMulai) || !tanggalValid(promosi.berlakuSampai) || promosi.berlakuSampai < promosi.berlakuMulai)
    sebab.push('Rentang periode promosi tidak valid.');
  if (promosi.paket.length === 0) sebab.push('Tambahkan sedikitnya satu pilihan kit.');

  const idPaket = new Set<string>();
  for (const paket of promosi.paket) {
    if (!paket.id || idPaket.has(paket.id)) sebab.push('Setiap pilihan kit harus memiliki ID unik.');
    idPaket.add(paket.id);
    if (!paket.nama.trim()) sebab.push('Nama setiap pilihan kit wajib diisi.');
    if (paket.komponen.length === 0) sebab.push(`Kit ${paket.nama || paket.id} harus memiliki komponen.`);
    const skuKomponen = new Set<string>();
    for (const komponen of paket.komponen) {
      if (!komponen.kodeSKU.trim() || !komponen.namaAlkes.trim())
        sebab.push(`Komponen pada kit ${paket.nama || paket.id} harus berasal dari produk bersku.`);
      if (!Number.isInteger(komponen.qtyPerKit) || komponen.qtyPerKit < 1)
        sebab.push(`Kuantitas komponen ${komponen.namaAlkes || komponen.kodeSKU} harus bilangan bulat positif.`);
      const sku = komponen.kodeSKU.trim().toLowerCase();
      if (sku && skuKomponen.has(sku)) sebab.push(`SKU ${komponen.kodeSKU} terdaftar lebih dari sekali dalam kit ${paket.nama}.`);
      skuKomponen.add(sku);
    }
  }
  return [...new Set(sebab)];
}

export function hitungKelayakanPromosiFOC(
  promosi: PromosiFOC,
  pesanan: Pick<PenjualanAlkes, 'kodeSKU' | 'jumlah' | 'jalurPenjualan' | 'pelangganId' | 'tanggalPesanan'>
): { memenuhi: boolean; jumlahKit: number; alasan: string[] } {
  const alasan: string[] = [];
  if (validasiPromosiFOC(promosi).length) alasan.push('Konfigurasi promosi tidak valid.');
  if (!promosi.aktif) alasan.push('Promosi tidak aktif.');
  if ((pesanan.kodeSKU ?? '').trim().toLowerCase() !== promosi.skuPemicu.trim().toLowerCase())
    alasan.push('SKU pesanan tidak memenuhi SKU pemicu.');
  if (!Number.isSafeInteger(pesanan.jumlah) || pesanan.jumlah < 1) alasan.push('Kuantitas pesanan tidak valid.');
  if (pesanan.jumlah < promosi.minimumPembelian) alasan.push('Kuantitas pesanan belum mencapai minimum pembelian.');
  if (pesanan.tanggalPesanan < promosi.berlakuMulai || pesanan.tanggalPesanan > promosi.berlakuSampai)
    alasan.push('Tanggal pesanan di luar periode promosi.');
  if (promosi.jalurPenjualan.length && !promosi.jalurPenjualan.includes(pesanan.jalurPenjualan))
    alasan.push('Jalur penjualan tidak termasuk kanal promosi.');
  if (promosi.pelangganIds.length && !promosi.pelangganIds.includes(pesanan.pelangganId ?? ''))
    alasan.push('Pelanggan tidak termasuk sasaran promosi.');

  return {
    memenuhi: alasan.length === 0,
    jumlahKit: alasan.length === 0
      ? Math.min(Math.floor(pesanan.jumlah / promosi.minimumPembelian), promosi.maksimumKitPerPesanan)
      : 0,
    alasan
  };
}
