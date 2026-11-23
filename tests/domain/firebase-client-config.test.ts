import { describe, expect, it, vi } from 'vitest';
import { resolveFirebaseBootstrapAdmins, resolveFirebaseClientConfig, type FirebaseClientConfig } from '../../src/services/firebaseConfig';

const productionConfig: FirebaseClientConfig = {
  apiKey: 'production-api-key',
  authDomain: 'production.firebaseapp.com',
  projectId: 'production-project',
  storageBucket: 'production.appspot.com',
  messagingSenderId: '123',
  appId: 'production-app',
  firestoreDatabaseId: '(default)'
};

const stagingEnv = {
  VITE_DEPLOYMENT_ENV: 'staging',
  VITE_FIREBASE_API_KEY: 'staging-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'staging.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'staging-project',
  VITE_FIREBASE_EXPECTED_PROJECT_ID: 'staging-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'staging.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '456',
  VITE_FIREBASE_APP_ID: 'staging-app',
  VITE_FIRESTORE_DATABASE_ID: '(default)'
};

describe('resolveFirebaseClientConfig', () => {
  it('limits bootstrap admins to the configured addresses when opted in', () => {
    expect([...resolveFirebaseBootstrapAdmins([' Admin@Example.com, second@example.com, '], 'true')]).toEqual([
      'admin@example.com',
      'second@example.com'
    ]);
    expect([...resolveFirebaseBootstrapAdmins([], 'true')]).toEqual([]);
    expect(resolveFirebaseBootstrapAdmins([], undefined).has('cloud.ams2026@gmail.com')).toBe(true);
    expect(() => resolveFirebaseBootstrapAdmins([], 'TRUE')).toThrow('harus bernilai true atau false');
  });

  it('uses the configured staging project instead of the bundled project', () => {
    expect(resolveFirebaseClientConfig(stagingEnv, productionConfig)).toEqual({
      apiKey: 'staging-api-key',
      authDomain: 'staging.firebaseapp.com',
      projectId: 'staging-project',
      storageBucket: 'staging.appspot.com',
      messagingSenderId: '456',
      appId: 'staging-app',
      firestoreDatabaseId: '(default)'
    });
  });

  it('fails closed when staging Firebase settings are incomplete', () => {
    expect(() =>
      resolveFirebaseClientConfig(
        { ...stagingEnv, VITE_FIREBASE_PROJECT_ID: undefined },
        productionConfig
      )
    ).toThrow('VITE_FIREBASE_PROJECT_ID');
    expect(() =>
      resolveFirebaseClientConfig(
        { ...stagingEnv, VITE_FIREBASE_API_KEY: 'GANTI_API_KEY_FIREBASE_STAGING' },
        productionConfig
      )
    ).toThrow('VITE_FIREBASE_API_KEY');
  });

  it('does not initialize the bundled Firebase project when staging configuration is invalid', async () => {
    for (const [key, value] of Object.entries({
      ...stagingEnv,
      VITE_FIREBASE_PROJECT_ID: 'wrong-project'
    })) {
      vi.stubEnv(key, value);
    }
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(import('../../src/services/firebase')).rejects.toThrow('tidak sesuai target');
    } finally {
      errorLog.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('reports an oversized RFQ collection instead of treating it as backed up', async () => {
    const { authFirebase, pushSyncEntryToFirestore } = await import('../../src/services/firebase');
    const previousUser = authFirebase.currentUser;
    Object.assign(authFirebase, { currentUser: { emailVerified: true } });
    try {
      await expect(pushSyncEntryToFirestore(
        'sales_website_rfq', ['x'.repeat(920_000)], 1, 'admin-uji'
      )).rejects.toThrow(/sales_website_rfq.*belum dapat dicadangkan/i);
    } finally {
      Object.assign(authFirebase, { currentUser: previousUser });
    }
  });

  it('rejects a failed or incomplete server response when restoring Firebase data', async () => {
    const { hydrateCloudStateOnServer } = await import('../../src/services/firebase');
    const cloud = { entries: {}, roles: [], users: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ pesan: 'Konflik RFQ sintetis.' }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(hydrateCloudStateOnServer(cloud, 'token-uji')).rejects.toThrow(/HTTP 500.*Konflik RFQ/i);
      await expect(hydrateCloudStateOnServer(cloud, 'token-uji')).rejects.toThrow(/HTTP 200/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('logs a warning when restore succeeds but the static website copy fails', async () => {
    const { hydrateCloudStateOnServer } = await import('../../src/services/firebase');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true, peringatan: 'Salinan statis gagal.' })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(hydrateCloudStateOnServer({ entries: {}, roles: [], users: [] }, 'token-uji')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Salinan statis gagal.'));
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('uses the configured production project and rejects a project mismatch', () => {
    const productionEnv = {
      ...stagingEnv,
      VITE_DEPLOYMENT_ENV: 'production',
      VITE_FIREBASE_PROJECT_ID: 'ams-integrated-system',
      VITE_FIREBASE_EXPECTED_PROJECT_ID: 'ams-integrated-system',
      VITE_FIREBASE_AUTH_DOMAIN: 'ams-integrated-system.firebaseapp.com'
    };

    expect(resolveFirebaseClientConfig(productionEnv, productionConfig)).toMatchObject({
      projectId: 'ams-integrated-system',
      firestoreDatabaseId: '(default)'
    });
    expect(() =>
      resolveFirebaseClientConfig(
        { ...productionEnv, VITE_FIREBASE_PROJECT_ID: 'ams-integrated-staging' },
        productionConfig
      )
    ).toThrow('tidak sesuai target');
  });

  it('preserves the bundled Firebase project outside staging', () => {
    expect(resolveFirebaseClientConfig({}, productionConfig)).toBe(productionConfig);
  });

  it('preserves the provisioned AI Studio applet config on *.run.app preview hosts even when staging env vars are set', () => {
    expect(
      resolveFirebaseClientConfig(stagingEnv, productionConfig, {
        hostname: 'ais-dev-5wlp3yc5jxvcxnp4msjgv6-571456223791.asia-east1.run.app'
      })
    ).toBe(productionConfig);
  });

  it('does not use production Firebase config in an AI Studio preview by default', () => {
    const productionEnv = {
      ...stagingEnv,
      VITE_DEPLOYMENT_ENV: 'production',
      VITE_FIREBASE_PROJECT_ID: 'ams-integrated-system',
      VITE_FIREBASE_EXPECTED_PROJECT_ID: 'ams-integrated-system'
    };
    expect(
      resolveFirebaseClientConfig(productionEnv, productionConfig, {
        hostname: 'ais-dev-5wlp3yc5jxvcxnp4msjgv6-571456223791.asia-east1.run.app'
      })
    ).toBe(productionConfig);
  });

  it('does not use production Firebase config on localhost', () => {
    const productionEnv = {
      ...stagingEnv,
      VITE_DEPLOYMENT_ENV: 'production',
      VITE_FIREBASE_PROJECT_ID: 'ams-integrated-system',
      VITE_FIREBASE_EXPECTED_PROJECT_ID: 'ams-integrated-system'
    };
    expect(
      resolveFirebaseClientConfig(productionEnv, productionConfig, {
        hostname: 'localhost'
      })
    ).toBe(productionConfig);
  });

  it('uses staging config on Windows VPS / custom staging domains', () => {
    expect(
      resolveFirebaseClientConfig(stagingEnv, productionConfig, {
        hostname: 'staging-ams.perusahaan-anda.co.id'
      }).projectId
    ).toBe('staging-project');
  });

  it('preserves the provisioned AI Studio applet config on *.ai.studio custom preview/deployed hosts', () => {
    expect(
      resolveFirebaseClientConfig(
        {
          ...stagingEnv,
          VITE_FIREBASE_API_KEY: 'YOUR_FIREBASE_API_KEY',
          VITE_FIREBASE_PROJECT_ID: 'ams-staging',
          VITE_FIREBASE_EXPECTED_PROJECT_ID: 'ams-integrated-staging'
        },
        productionConfig,
        { hostname: 'remediams.ai.studio' }
      )
    ).toBe(productionConfig);
  });

  it('rejects generic placeholder values like YOUR_* on non-AI-Studio hosts', () => {
    expect(() =>
      resolveFirebaseClientConfig(
        { ...stagingEnv, VITE_FIREBASE_API_KEY: 'YOUR_FIREBASE_API_KEY' },
        productionConfig,
        { hostname: 'staging.ams.internal' }
      )
    ).toThrow('VITE_FIREBASE_API_KEY');
  });
});
