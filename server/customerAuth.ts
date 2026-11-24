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
  /** Server-side Email/Password sign-in used by username login; returns a Firebase ID token. */
  signIn(email: string, password: string): Promise<string>;
  sendVerification(idToken: string, continueUrl?: string): Promise<void>;
}

export interface CustomerIdentityRestOptions {
  apiKey: () => string | undefined;
  /** Origin sent as Referer so browser-restricted Firebase API keys still accept server calls. */
  referer?: string;
  fetcher?: typeof fetch;
}

const CUSTOMER_PROVIDERS = new Set(['password', 'google.com']);
const INVALID_CREDENTIALS = () => new CustomerError(401, 'INVALID_CREDENTIALS', 'Username atau kata sandi salah.');

async function identityToolkit(options: CustomerIdentityRestOptions | undefined, method: string, body: Record<string, unknown>) {
  const key = options?.apiKey();
  if (!key) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Konfigurasi autentikasi customer belum siap.');
  let response: Response;
  try {
    response = await (options?.fetcher ?? fetch)(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options?.referer ? { Referer: `${options.referer}/` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Layanan identitas sedang tidak tersedia. Coba lagi nanti.');
  }
  const payload = await response.json().catch(() => ({})) as { idToken?: unknown; error?: { message?: unknown } };
  if (response.ok) return payload;
  const code = String(payload.error?.message ?? '').split(/[\s:]/)[0];
  if (['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'USER_DISABLED', 'INVALID_EMAIL', 'MISSING_PASSWORD'].includes(code)) throw INVALID_CREDENTIALS();
  if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new CustomerError(429, 'RATE_LIMIT', 'Terlalu banyak percobaan. Coba lagi nanti.');
  console.error('[customer-auth] Identity Toolkit menolak permintaan:', method, code || response.status);
  throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Layanan identitas sedang tidak tersedia. Coba lagi nanti.');
}

function authError(error: unknown): never {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (/^auth\/(id-token-|user-disabled|user-not-found|argument-error|invalid-id-token)/.test(code)) {
    throw new CustomerError(401, 'INVALID_IDENTITY', 'Identitas tidak valid. Silakan masuk kembali.');
  }
  console.error('[customer-auth] Layanan identitas tidak tersedia:', code || 'unknown');
  throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Layanan identitas sedang tidak tersedia. Coba lagi nanti.');
}

export function createFirebaseCustomerIdentity(
  getAuth: () => Pick<Auth, 'verifyIdToken' | 'getUser' | 'revokeRefreshTokens'> | null,
  rest?: CustomerIdentityRestOptions
): CustomerIdentityService {
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
      const provider = claims.firebase?.sign_in_provider;
      if (!CUSTOMER_PROVIDERS.has(provider ?? '') || !claims.uid || !claims.email ||
          !Number.isFinite(claims.auth_time) || claims.auth_time <= 0) {
        throw new CustomerError(401, 'INVALID_IDENTITY', 'Gunakan akun Email/Password atau Google customer.');
      }
      if (provider === 'google.com' && claims.email_verified !== true) {
        throw new CustomerError(401, 'INVALID_IDENTITY', 'Email akun Google belum terverifikasi.');
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
    },
    async signIn(email, password) {
      const payload = await identityToolkit(rest, 'signInWithPassword', { email, password, returnSecureToken: true });
      if (typeof payload.idToken !== 'string' || !payload.idToken) throw new CustomerError(503, 'IDENTITY_UNAVAILABLE', 'Layanan identitas sedang tidak tersedia. Coba lagi nanti.');
      return payload.idToken;
    },
    async sendVerification(idToken, continueUrl) {
      await identityToolkit(rest, 'sendOobCode', { requestType: 'VERIFY_EMAIL', idToken, ...(continueUrl ? { continueUrl } : {}) });
    }
  };
}
