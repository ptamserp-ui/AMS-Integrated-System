import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { CustomerError, type CustomerIdentity } from './customerStore';

export interface CustomerIdentityState {
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  validAfter: number;
}

export interface CustomerIdentityService {
  available(): boolean;
  verify(token: string): Promise<CustomerIdentity>;
  read(uid: string): Promise<CustomerIdentityState>;
  revoke(uid: string): Promise<void>;
}

function authError(error: unknown): never {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (/^auth\/(id-token-|user-disabled|user-not-found|argument-error|invalid-id-token)/.test(code)) {
    throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas tidak valid. Silakan masuk kembali.');
  }
  console.error('[customer-auth] Layanan identitas tidak tersedia:', code || 'unknown');
  throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Layanan identitas sedang tidak tersedia. Coba lagi nanti.');
}

export function createFirebaseCustomerIdentity(getAuth: () => Pick<Auth, 'verifyIdToken' | 'getUser' | 'revokeRefreshTokens'> | null): CustomerIdentityService {
  const auth = () => {
    const service = getAuth();
    if (!service) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Firebase Admin belum tersedia.');
    return service;
  };
  return {
    available: () => Boolean(getAuth()),
    async verify(token) {
      let claims: DecodedIdToken;
      try { claims = await auth().verifyIdToken(token, true); } catch (error) {
        if (error instanceof CustomerError) throw error;
        authError(error);
      }
      if (claims.firebase?.sign_in_provider !== 'password' || !claims.uid || !claims.email ||
          !Number.isFinite(claims.auth_time) || claims.auth_time <= 0) {
        throw new CustomerError(401, 'INVALID_IDENTITY', 'Gunakan akun Email/Password customer.');
      }
      return {
        uid: claims.uid, email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified === true, authTime: claims.auth_time * 1000
      };
    },
    async read(uid) {
      try {
        const user = await auth().getUser(uid);
        const validAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
        if (!user.email || !Number.isFinite(validAfter)) throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas tidak valid.');
        return { email: user.email.toLowerCase(), emailVerified: user.emailVerified, disabled: user.disabled, validAfter };
      } catch (error) {
        if (error instanceof CustomerError) throw error;
        authError(error);
      }
    },
    async revoke(uid) {
      try { await auth().revokeRefreshTokens(uid); } catch (error) {
        if (error instanceof CustomerError) throw error;
        authError(error);
      }
    }
  };
}
