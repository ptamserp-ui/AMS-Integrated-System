import type {
  CustomerAccount,
  CustomerAddress,
  CustomerCart,
  CustomerCatalogItem,
  CustomerNotification,
  CustomerOrder,
  CustomerPortalStatus,
  CustomerProfileInput
} from '../types/customerPortal';

export class CustomerApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(`/api/customer${path}`, {
    method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(data ?? {}) })
  });
  let result: T & { error?: string; pesan?: string };
  try { result = await response.json(); } catch {
    throw new CustomerApiError(response.status, 'INVALID_RESPONSE', 'Jawaban server tidak valid. Coba lagi nanti.');
  }
  if (!response.ok) throw new CustomerApiError(response.status, result.error || 'REQUEST_FAILED', result.pesan || 'Permintaan belum berhasil.');
  return result;
}

export const customerApi = {
  status: () => request<CustomerPortalStatus>('/status'),
  me: () => request<{ account: CustomerAccount }>('/auth/saya'),
  register: (idToken: string, username: string, profile: CustomerProfileInput, privacyVersion: string) =>
    request<{ account: CustomerAccount }>('/auth/daftar', 'POST', { idToken, username, ...profile, privacyAccepted: true, privacyVersion }),
  checkUsername: (username: string) => request<{ available: boolean; pesan: string }>('/auth/cek-username', 'POST', { username }),
  loginWithUsername: (username: string, password: string) =>
    request<{ account: CustomerAccount }>('/auth/masuk', 'POST', { username, password }),
  login: (idToken: string) => request<{ account: CustomerAccount }>('/auth/sesi', 'POST', { idToken }),
  logout: (all = false) => request<{ ok: boolean }>(all ? '/auth/keluar-semua' : '/auth/keluar', 'POST'),
  updateProfile: (profile: CustomerProfileInput) => request<{ account: CustomerAccount }>('/profil', 'PATCH', profile),
  catalog: (query = '') => request<{ items: CustomerCatalogItem[]; categories: string[] }>(`/katalog${query}`),
  catalogDetail: (id: string) => request<{ item: CustomerCatalogItem }>(`/katalog/${encodeURIComponent(id)}`),
  cart: () => request<{ cart: CustomerCart }>('/keranjang'),
  updateCart: (items: Array<{ produkId: string; varianId: string; jumlah: number }>) =>
    request<{ cart: CustomerCart }>('/keranjang', 'PUT', { items }),
  addresses: () => request<{ items: CustomerAddress[] }>('/alamat'),
  saveAddress: (address: Omit<CustomerAddress, 'id' | 'isUtama' | 'updatedAt'> & { id?: string; isUtama?: boolean }) =>
    request<{ items: CustomerAddress[] }>(address.id ? `/alamat/${encodeURIComponent(address.id)}` : '/alamat', address.id ? 'PATCH' : 'POST', address),
  deleteAddress: (id: string) =>
    request<{ items: CustomerAddress[] }>(`/alamat/${encodeURIComponent(id)}`, 'DELETE'),
  notifications: () => request<{ items: CustomerNotification[] }>('/notifikasi'),
  markNotificationsRead: () => request<{ items: CustomerNotification[] }>('/notifikasi/baca', 'POST'),
  orders: () => request<{ items: CustomerOrder[] }>('/pesanan'),
  order: (id: string) => request<{ order: CustomerOrder }>(`/pesanan/${encodeURIComponent(id)}`),
  submitOrder: (input: { requestId: string; cartRevision: number; alamatId: string; catatan: string }) =>
    request<{ order: CustomerOrder; cart: CustomerCart }>('/pesanan', 'POST', input),
  cancelOrder: (id: string, alasan: string) =>
    request<{ order: CustomerOrder }>(`/pesanan/${encodeURIComponent(id)}/batal`, 'POST', { alasan })
};
