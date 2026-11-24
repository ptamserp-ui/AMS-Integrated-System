import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyEmployeeFirebaseToken } from '../../server/firebaseIdentity';
import { createFirebaseCustomerIdentity } from '../../server/customerAuth';
import type { DecodedIdToken } from 'firebase-admin/auth';

const token = (provider: string) => `header.${Buffer.from(JSON.stringify({ firebase: { sign_in_provider: provider } })).toString('base64url')}.signature`;
const googleIdentity = { ok: true as const, uid: 'employee', email: 'employee@example.invalid', emailVerified: true, displayName: 'Employee' };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Firebase provider isolation', () => {
  it('preserves verified Google login but rejects password sign-ins for the same employee email', async () => {
    const verifier = vi.fn().mockResolvedValue(googleIdentity);
    expect(await verifyEmployeeFirebaseToken(token('google.com'), verifier, () => undefined)).toEqual(googleIdentity);
    expect(await verifyEmployeeFirebaseToken(token('password'), verifier, () => undefined)).toMatchObject({ ok: false });
    expect(verifier).toHaveBeenCalledTimes(1);
  });

  it('never trusts an unverified Google provider claim or bypasses revoked-token rejection', async () => {
    const verifier = vi.fn().mockResolvedValue({ ok: false, fallbackToRest: false, message: 'revoked' });
    const rest = vi.fn();
    vi.stubGlobal('fetch', rest);
    expect(await verifyEmployeeFirebaseToken(token('google.com'), verifier, () => 'test')).toMatchObject({ ok: false });
    expect(rest).not.toHaveBeenCalled();
  });

  it('keeps REST fallback for verified Google identities without accepting linked password sign-ins', async () => {
    const verifier = vi.fn().mockResolvedValue({ ok: false, fallbackToRest: true, message: 'Admin unavailable' });
    const rest = vi.fn().mockResolvedValue(Response.json({ users: [{ localId: 'employee', email: googleIdentity.email, emailVerified: true }] }));
    vi.stubGlobal('fetch', rest);
    expect(await verifyEmployeeFirebaseToken(token('password'), verifier, () => 'test')).toMatchObject({ ok: false });
    expect(rest).not.toHaveBeenCalled();
    expect(await verifyEmployeeFirebaseToken(token('google.com'), verifier, () => 'test')).toMatchObject({ ok: true, email: googleIdentity.email });
    expect(rest).toHaveBeenCalledOnce();
  });

  it('requires password provider and revoked-token checking for customer identities', async () => {
    const claims: DecodedIdToken = {
      aud: 'test', auth_time: 1700000000, exp: 1800000000, iat: 1700000000,
      iss: 'test', sub: 'customer', uid: 'customer', email: 'customer@example.invalid', email_verified: true,
      firebase: { identities: {}, sign_in_provider: 'password' }
    };
    const sdk = {
      verifyIdToken: vi.fn().mockResolvedValue(claims),
      getUser: vi.fn(),
      revokeRefreshTokens: vi.fn()
    };
    const service = createFirebaseCustomerIdentity(() => sdk);
    expect(await service.verify('opaque')).toMatchObject({ uid: 'customer', authTime: 1700000000000 });
    expect(sdk.verifyIdToken).toHaveBeenCalledWith('opaque', true);
    sdk.verifyIdToken.mockResolvedValue({ ...claims, firebase: { identities: {}, sign_in_provider: 'google.com' } });
    await expect(service.verify('google')).rejects.toMatchObject({ status: 401 });
    sdk.verifyIdToken.mockRejectedValue({ code: 'auth/id-token-revoked' });
    await expect(service.verify('revoked')).rejects.toMatchObject({ status: 401 });
    sdk.verifyIdToken.mockRejectedValue({ code: 'auth/internal-error' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(service.verify('outage')).rejects.toMatchObject({ status: 503 });
  });
});
