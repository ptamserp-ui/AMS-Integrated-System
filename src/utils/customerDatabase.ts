import type { PelangganB2B } from '../types';

export type DetailCustomerDatabase = Pick<PelangganB2B,
  'alamat1' | 'alamat2' | 'wilayahCustomer' | 'penanggungJawabSales' | 'emailCustomer' | 'nomorWhatsapp' | 'afiliasiKeterangan'
>;

export function detailCustomerDatabase(pelanggan: PelangganB2B): DetailCustomerDatabase {
  return {
    alamat1: pelanggan.alamat1 || '',
    alamat2: pelanggan.alamat2 || '',
    wilayahCustomer: pelanggan.wilayahCustomer || '',
    penanggungJawabSales: pelanggan.penanggungJawabSales || '',
    emailCustomer: pelanggan.emailCustomer || '',
    nomorWhatsapp: pelanggan.nomorWhatsapp || '',
    afiliasiKeterangan: pelanggan.afiliasiKeterangan || ''
  };
}

export function validasiDetailCustomer(detail: DetailCustomerDatabase): string | null {
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
  return a.alamat1 !== b.alamat1 || a.alamat2 !== b.alamat2 ||
    a.wilayahCustomer !== b.wilayahCustomer || a.penanggungJawabSales !== b.penanggungJawabSales ||
    a.emailCustomer !== b.emailCustomer || a.nomorWhatsapp !== b.nomorWhatsapp ||
    a.afiliasiKeterangan !== b.afiliasiKeterangan;
}

export function rapikanDetailCustomer(detail: DetailCustomerDatabase): DetailCustomerDatabase {
  return {
    alamat1: (detail.alamat1 || '').trim(),
    alamat2: (detail.alamat2 || '').trim(),
    wilayahCustomer: (detail.wilayahCustomer || '').trim(),
    penanggungJawabSales: (detail.penanggungJawabSales || '').trim(),
    emailCustomer: (detail.emailCustomer || '').trim(),
    nomorWhatsapp: (detail.nomorWhatsapp || '').trim(),
    afiliasiKeterangan: (detail.afiliasiKeterangan || '').trim()
  };
}
