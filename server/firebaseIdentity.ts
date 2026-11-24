export function hasFirebaseSignInProvider(idToken: string, provider: 'google.com' | 'password'): boolean {
  // This is only a rejection filter. The caller must still verify the complete token.
  if (idToken.length > 16384) return false;
  const parts = idToken.split('.');
  if (parts.length !== 3) return false;
  try {
    const claims: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object' || !('firebase' in claims)) return false;
    const firebase = claims.firebase;
    return Boolean(firebase && typeof firebase === 'object' && 'sign_in_provider' in firebase &&
      firebase.sign_in_provider === provider);
  } catch {
    return false;
  }
}

interface EmployeeIdentity {
  ok: true;
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

export async function verifyEmployeeFirebaseToken(
  idToken: string,
  verifyAdmin: (token: string) => Promise<EmployeeIdentity | { ok: false; fallbackToRest: boolean; message: string }>,
  apiKey: () => string | undefined
): Promise<EmployeeIdentity | { ok: false; message: string }> {
  if (!hasFirebaseSignInProvider(idToken, 'google.com')) {
    return { ok: false, message: 'Login karyawan melalui Firebase hanya menerima akun Google.' };
  }
  const adminVerified = await verifyAdmin(idToken);
  if (adminVerified.ok) return adminVerified;
  if (!adminVerified.fallbackToRest) return { ok: false, message: adminVerified.message };
  const key = apiKey();
  if (!key) return { ok: false, message: 'Konfigurasi Firebase belum tersedia di server.' };
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { ok: false, message: 'Token Firebase tidak valid atau sudah kedaluwarsa.' };
    const payload = await response.json() as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean; displayName?: string; disabled?: boolean }>;
    };
    const user = payload.users?.[0];
    if (!user?.localId || !user.email || user.disabled) return { ok: false, message: 'Akun Firebase tidak dapat digunakan.' };
    if (!user.emailVerified) return { ok: false, message: 'Email akun Google belum terverifikasi.' };
    return {
      ok: true, uid: user.localId, email: user.email.trim().toLowerCase(),
      emailVerified: true, displayName: user.displayName || user.email
    };
  } catch {
    return { ok: false, message: 'Gagal memverifikasi token Firebase ke layanan identitas Google.' };
  }
}
