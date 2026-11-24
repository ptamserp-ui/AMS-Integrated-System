import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth';
import type { CustomerPortalStatus } from '../types/customerPortal';

let portalAuth: Auth | undefined;

export function getCustomerFirebase(status: CustomerPortalStatus): Auth {
  const config = status.firebase;
  if (!status.authAvailable || !config) throw new Error('Autentikasi customer belum tersedia.');
  if (portalAuth && portalAuth.app.options.projectId !== config.projectId) {
    throw new Error('Konfigurasi Firebase berubah. Muat ulang halaman.');
  }
  if (!portalAuth) {
    const existing = getApps().find((app) => app.name === 'portal-customer');
    if (existing && existing.options.projectId !== config.projectId) throw new Error('Project Firebase customer tidak sesuai.');
    portalAuth = existing ? getAuth(existing) : initializeAuth(initializeApp(config, 'portal-customer'), { persistence: inMemoryPersistence });
  }
  return portalAuth;
}

export function customerFirebaseMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/user-disabled': return 'Email atau kata sandi tidak valid, atau akun tidak dapat digunakan.';
    case 'auth/email-already-in-use': return 'Akun belum dapat dibuat. Coba masuk atau gunakan lupa kata sandi.';
    case 'auth/invalid-email': return 'Periksa kembali alamat email Anda.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'Kata sandi belum memenuhi kebijakan keamanan Firebase.';
    case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.';
    case 'auth/network-request-failed': return 'Jaringan bermasalah. Periksa koneksi lalu coba kembali.';
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
    case 'auth/unauthorized-continue-uri': return 'Konfigurasi autentikasi customer belum siap. Hubungi tim kami.';
    default:
      if (code.startsWith('auth/')) return 'Layanan autentikasi belum dapat menyelesaikan permintaan.';
      return error instanceof Error ? error.message : 'Permintaan belum dapat diselesaikan.';
  }
}
