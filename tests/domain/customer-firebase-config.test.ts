import { describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  app: { name: 'portal-customer', options: { projectId: 'customer-project' } },
  auth: { app: { options: { projectId: 'customer-project' } } },
  browserPopupRedirectResolver: { name: 'browserPopupRedirectResolver' },
  inMemoryPersistence: { name: 'inMemoryPersistence' },
  getApps: vi.fn(),
  getAuth: vi.fn(),
  initializeApp: vi.fn(),
  initializeAuth: vi.fn()
}));

vi.mock('firebase/app', () => ({
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp
}));

vi.mock('firebase/auth', () => ({
  browserPopupRedirectResolver: firebaseMocks.browserPopupRedirectResolver,
  getAuth: firebaseMocks.getAuth,
  inMemoryPersistence: firebaseMocks.inMemoryPersistence,
  initializeAuth: firebaseMocks.initializeAuth
}));

import { customerFirebaseMessage, getCustomerFirebase } from '../../src/services/customerFirebase';
import type { CustomerPortalStatus } from '../../src/types/customerPortal';

describe('customer Firebase browser auth configuration', () => {
  it('initializes the customer auth instance with the browser popup resolver', () => {
    firebaseMocks.getApps.mockReturnValue([]);
    firebaseMocks.initializeApp.mockReturnValue(firebaseMocks.app);
    firebaseMocks.initializeAuth.mockReturnValue(firebaseMocks.auth);
    const status: CustomerPortalStatus = {
      enabled: true,
      authAvailable: true,
      registrationAvailable: true,
      privacyUrl: null,
      termsUrl: null,
      privacyVersion: 'test',
      firebase: {
        apiKey: 'test-api-key',
        authDomain: 'customer.example.invalid',
        projectId: 'customer-project',
        appId: 'test-app'
      }
    };

    expect(getCustomerFirebase(status)).toBe(firebaseMocks.auth);
    expect(firebaseMocks.initializeAuth).toHaveBeenCalledWith(firebaseMocks.app, {
      persistence: firebaseMocks.inMemoryPersistence,
      popupRedirectResolver: firebaseMocks.browserPopupRedirectResolver
    });
  });

  it('explains blocked or cancelled Google popups without exposing Firebase internals', () => {
    expect(customerFirebaseMessage({ code: 'auth/popup-blocked' })).toContain('diblokir');
    expect(customerFirebaseMessage({ code: 'auth/popup-closed-by-user' })).toContain('dibatalkan');
    expect(customerFirebaseMessage({ code: 'auth/unauthorized-domain', message: 'internal details' }))
      .toBe('Konfigurasi autentikasi customer belum siap. Hubungi tim kami.');
  });
});
