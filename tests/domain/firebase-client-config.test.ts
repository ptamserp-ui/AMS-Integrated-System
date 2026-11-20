import { describe, expect, it } from 'vitest';
import { resolveFirebaseClientConfig, type FirebaseClientConfig } from '../../src/services/firebaseConfig';

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
});
