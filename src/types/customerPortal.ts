export type CustomerStatus = 'menunggu-email' | 'menunggu-verifikasi' | 'aktif' | 'ditangguhkan';

export interface CustomerProfileInput {
  nama: string;
  telepon: string;
  perusahaan: string;
}

export interface CustomerAccount extends CustomerProfileInput {
  id: string;
  email: string;
  status: CustomerStatus;
  teleponTerverifikasi: false;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPortalStatus {
  enabled: boolean;
  authAvailable: boolean;
  registrationAvailable: boolean;
  privacyUrl: string | null;
  termsUrl: string | null;
  privacyVersion: string | null;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  } | null;
}

export interface CustomerCatalogItem {
  id: string;
  nama: string;
  tipeModel: string;
  kategori: string;
  kategoriRegulasi?: string;
  produsen: string;
  spesifikasi: string;
  nomorIzinEdar: string;
  statusIzinEdar: string;
  satuan: string;
  hargaTayang?: string;
  referensiHarga?: string;
  stokLabel: 'tersedia' | 'tidak-diketahui';
  imageUrls: string[];
  varian: Array<{
    id: string;
    kodeSKU: string;
    tipeModel: string;
    nomorIzinEdar: string;
    satuan: string;
  }>;
}

export interface CustomerCartItem {
  produkId: string;
  varianId: string;
  jumlah: number;
  updatedAt?: string;
}

export interface CustomerCart {
  items: CustomerCartItem[];
  revision: number;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  penerima: string;
  telepon: string;
  alamat: string;
  kota: string;
  provinsi: string;
  kodePos: string;
  isUtama: boolean;
  updatedAt: string;
}

export function customerProfileError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Profil customer wajib diisi.';
  const data = value as Record<string, unknown>;
  for (const [key, label, max, required] of [
    ['nama', 'Nama', 120, true],
    ['telepon', 'Nomor telepon', 40, false],
    ['perusahaan', 'Nama perusahaan', 160, true]
  ] as const) {
    const field = data[key];
    if (typeof field !== 'string' || field.trim().length > max || (required && !field.trim()) ||
        /[\u0000-\u001f\u007f]/.test(field)) return `${label} tidak valid (maksimal ${max} karakter).`;
  }
  return null;
}
