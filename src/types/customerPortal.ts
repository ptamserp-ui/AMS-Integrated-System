export type CustomerStatus = 'menunggu-email' | 'menunggu-verifikasi' | 'aktif' | 'ditangguhkan';

export interface CustomerProfileInput {
  nama: string;
  telepon: string;
  perusahaan: string;
}

export interface CustomerAccount extends CustomerProfileInput {
  id: string;
  /** Unique login name; absent only on legacy records and the developer workspace. */
  username?: string;
  email: string;
  status: CustomerStatus;
  teleponTerverifikasi: false;
  /** Developer workspace backed by an ERP developer session instead of a customer identity. */
  aksesDeveloper?: true;
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
  stokLabel: 'perlu-konfirmasi';
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

/** Implemented order states; quotation, conversion and delivery states are added with their workflows. */
export type CustomerOrderStatus = 'menunggu-penawaran' | 'dibatalkan';

export interface CustomerOrderLine {
  id: string;
  produkId: string;
  varianId: string;
  nama: string;
  tipeModel: string;
  kodeSKU: string;
  nomorIzinEdar: string;
  satuan: string;
  jumlah: number;
}

export type CustomerOrderAddress = Omit<CustomerAddress, 'id' | 'isUtama' | 'updatedAt'>;

export interface CustomerOrderEvent {
  id: string;
  status: CustomerOrderStatus;
  oleh: 'customer' | 'staf';
  catatan?: string;
  at: string;
}

export interface CustomerOrder {
  id: string;
  nomor: string;
  status: CustomerOrderStatus;
  baris: CustomerOrderLine[];
  alamat: CustomerOrderAddress;
  catatan: string;
  riwayat: CustomerOrderEvent[];
  /** Placed from the developer workspace for evaluation; never a real customer order. */
  uji?: true;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNotification {
  id: string;
  judul: string;
  pesan: string;
  pesananId?: string;
  dibaca: boolean;
  createdAt: string;
}

export const CUSTOMER_ORDER_NOTE_MAX = 1000;

/** Free text: printable characters plus line breaks and tabs. */
export function customerTextError(value: unknown, label: string, max: number, required = false): string | null {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return `${label} tidak valid (maksimal ${max} karakter).`;
  return null;
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

const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'root', 'developer', 'support', 'system', 'remedia', 'remediams', 'ams', 'staf', 'staff']);

export const normalizeCustomerUsername = (value: string) => value.trim().toLowerCase();

/** Username: 3-30 chars, lowercase letters/digits plus . _ -, starting and ending with a letter or digit. */
export function customerUsernameError(value: unknown): string | null {
  if (typeof value !== 'string') return 'Username wajib diisi.';
  const username = normalizeCustomerUsername(value);
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/.test(username) || /[._-]{2}/.test(username)) {
    return 'Username 3–30 karakter: huruf, angka, titik, garis bawah atau tanda hubung; diawali dan diakhiri huruf/angka.';
  }
  if (RESERVED_USERNAMES.has(username)) return 'Username tersebut tidak dapat digunakan.';
  return null;
}
