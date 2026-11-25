import type { PelangganB2B } from '../types';

export type DetailCustomerDatabase = Pick<PelangganB2B,
  'kodePelanggan' | 'namaInstalasi' | 'npwp' | 'namaPajak' | 'kodeFakturPajak' | 'bl' |
  'alamat1' | 'alamat2' | 'kotaSurat' | 'alamatPengiriman' | 'alamatPajak' |
  'wilayahCustomer' | 'penanggungJawabSales' | 'nomorTelepon' | 'nomorFax' |
  'emailCustomer' | 'nomorWhatsapp' | 'afiliasiKeterangan' |
  'termsOfPaymentHari' | 'batasKredit' | 'maxCnPersen' | 'noCn' | 'maxSkiPersen' |
  'setHarga' | 'kontakPerson' | 'jabatanKontak' | 'izinCustomer'
>;

export function detailCustomerDatabase(pelanggan: PelangganB2B): DetailCustomerDatabase {
  return {
    kodePelanggan: pelanggan.kodePelanggan,
    namaInstalasi: pelanggan.namaInstalasi,
    npwp: pelanggan.npwp || '',
    namaPajak: pelanggan.namaPajak || '',
    kodeFakturPajak: pelanggan.kodeFakturPajak || '',
    bl: pelanggan.bl ?? false,
    alamat1: pelanggan.alamat1 || '',
    alamat2: pelanggan.alamat2 || '',
    kotaSurat: pelanggan.kotaSurat || '',
    alamatPengiriman: Array.from({ length: Math.max(3, pelanggan.alamatPengiriman?.length ?? 0) }, (_, i) => ({
      ...pelanggan.alamatPengiriman?.[i],
      alamat1: pelanggan.alamatPengiriman?.[i]?.alamat1 || '',
      alamat2: pelanggan.alamatPengiriman?.[i]?.alamat2 || '',
      kota: pelanggan.alamatPengiriman?.[i]?.kota || ''
    })),
    alamatPajak: {
      ...pelanggan.alamatPajak,
      alamat1: pelanggan.alamatPajak?.alamat1 || '',
      alamat2: pelanggan.alamatPajak?.alamat2 || '',
      kota: pelanggan.alamatPajak?.kota || ''
    },
    wilayahCustomer: pelanggan.wilayahCustomer || '',
    penanggungJawabSales: pelanggan.penanggungJawabSales || '',
    nomorTelepon: pelanggan.nomorTelepon || '',
    nomorFax: pelanggan.nomorFax || '',
    emailCustomer: pelanggan.emailCustomer || '',
    nomorWhatsapp: pelanggan.nomorWhatsapp || '',
    afiliasiKeterangan: pelanggan.afiliasiKeterangan || '',
    termsOfPaymentHari: pelanggan.termsOfPaymentHari,
    batasKredit: pelanggan.batasKredit,
    maxCnPersen: pelanggan.maxCnPersen,
    noCn: pelanggan.noCn ?? false,
    maxSkiPersen: pelanggan.maxSkiPersen,
    setHarga: pelanggan.setHarga || '',
    kontakPerson: pelanggan.kontakPerson || '',
    jabatanKontak: pelanggan.jabatanKontak || '',
    izinCustomer: pelanggan.izinCustomer || ''
  };
}

export function validasiDetailCustomer(detail: DetailCustomerDatabase): string | null {
  if (!detail.kodePelanggan.trim() || !detail.namaInstalasi.trim()) return 'Kode dan nama customer wajib diisi.';
  if (!Number.isSafeInteger(detail.termsOfPaymentHari) || detail.termsOfPaymentHari < 0) return 'Jatuh tempo harus berupa jumlah hari bulat yang tidak negatif.';
  if (!Number.isFinite(detail.batasKredit) || detail.batasKredit < 0) return 'Batas kredit harus berupa angka yang tidak negatif.';
  if ([detail.maxCnPersen, detail.maxSkiPersen].some((nilai) => nilai !== undefined && (!Number.isFinite(nilai) || nilai < 0 || nilai > 100))) {
    return 'Max. CN dan Max. SKI harus antara 0 dan 100 persen.';
  }
  const email = (detail.emailCustomer || '').trim();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return 'Format email tidak valid.';
  }
  const nomor = (detail.nomorWhatsapp || '').trim();
  if (nomor && (!/^\+?[0-9][0-9 ()-]*$/.test(nomor) || nomor.replace(/\D/g, '').length < 6 || nomor.replace(/\D/g, '').length > 20)) {
    return 'Nomor WhatsApp harus berisi 6–20 digit, dengan tanda +, spasi, kurung atau tanda hubung bila diperlukan.';
  }
  return null;
}

export function detailCustomerBerubah(a: DetailCustomerDatabase, b: DetailCustomerDatabase): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function rapikanDetailCustomer(detail: DetailCustomerDatabase): DetailCustomerDatabase {
  return {
    ...detail,
    kodePelanggan: detail.kodePelanggan.trim(),
    namaInstalasi: detail.namaInstalasi.trim(),
    npwp: (detail.npwp || '').trim(),
    namaPajak: (detail.namaPajak || '').trim(),
    kodeFakturPajak: (detail.kodeFakturPajak || '').trim(),
    alamat1: (detail.alamat1 || '').trim(),
    alamat2: (detail.alamat2 || '').trim(),
    kotaSurat: (detail.kotaSurat || '').trim(),
    alamatPengiriman: detail.alamatPengiriman?.map((alamat) => ({
      ...alamat,
      alamat1: alamat.alamat1.trim(), alamat2: alamat.alamat2.trim(), kota: alamat.kota.trim()
    })),
    alamatPajak: detail.alamatPajak && {
      ...detail.alamatPajak,
      alamat1: detail.alamatPajak.alamat1.trim(),
      alamat2: detail.alamatPajak.alamat2.trim(),
      kota: detail.alamatPajak.kota.trim()
    },
    wilayahCustomer: (detail.wilayahCustomer || '').trim(),
    penanggungJawabSales: (detail.penanggungJawabSales || '').trim(),
    nomorTelepon: (detail.nomorTelepon || '').trim(),
    nomorFax: (detail.nomorFax || '').trim(),
    emailCustomer: (detail.emailCustomer || '').trim(),
    nomorWhatsapp: (detail.nomorWhatsapp || '').trim(),
    afiliasiKeterangan: (detail.afiliasiKeterangan || '').trim(),
    setHarga: (detail.setHarga || '').trim(),
    kontakPerson: (detail.kontakPerson || '').trim(),
    jabatanKontak: (detail.jabatanKontak || '').trim(),
    izinCustomer: (detail.izinCustomer || '').trim()
  };
}
