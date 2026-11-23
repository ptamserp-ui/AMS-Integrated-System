export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
}

export interface ResolveFirebaseClientOptions {
  hostname?: string;
  isAiStudioPreview?: boolean;
}

export function resolveFirebaseBootstrapAdmins(configured: string[], configuredOnly?: string): Set<string> {
  if (configuredOnly && configuredOnly !== 'true' && configuredOnly !== 'false') {
    throw new Error('VITE_FIREBASE_CONFIGURED_ADMINS_ONLY harus bernilai true atau false.');
  }
  const legacyAdmins = configuredOnly === 'true' ? [] : ['antraderyll@gmail.com', 'cloud.ams2026@gmail.com'];
  return new Set(
    [...legacyAdmins, ...configured.flatMap((value) => value.split(','))]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAiStudioPreviewHost(hostname?: string): boolean {
  if (!hostname) return false;
  const cleaned = hostname.trim().toLowerCase();
  return (
    /^ais-(?:dev|pre)-[^.]+\.[^.]+\.run\.app$/i.test(cleaned) ||
    /^(?:[^.]+\.)?ai\.studio$/i.test(cleaned)
  );
}

function isPlaceholderClientValue(value: string): boolean {
  const cleaned = value.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return true;
  return /^(?:GANTI_|YOUR_|MY_|PLACEHOLDER|<[^>]+>)/i.test(cleaned);
}

export function resolveFirebaseClientConfig(
  env: Record<string, string | undefined> | undefined,
  defaultConfig: FirebaseClientConfig,
  options?: ResolveFirebaseClientOptions
): FirebaseClientConfig {
  if (!env) return defaultConfig;
  const deploymentEnv = env.VITE_DEPLOYMENT_ENV;
  if (deploymentEnv !== 'staging' && deploymentEnv !== 'production') {
    return defaultConfig;
  }

  const runningInAiStudioPreview =
    Boolean(options?.isAiStudioPreview) || isAiStudioPreviewHost(options?.hostname);
  const hostname = options?.hostname?.trim().toLowerCase();
  const isProductionOnLocalHost =
    deploymentEnv === 'production' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
  const forcePreviewConfig =
    deploymentEnv === 'staging'
      ? env.VITE_FORCE_STAGING_IN_PREVIEW === 'true'
      : env.VITE_FORCE_PRODUCTION_IN_PREVIEW === 'true';
  if ((runningInAiStudioPreview && !forcePreviewConfig) || isProductionOnLocalHost) {
    return defaultConfig;
  }

  const environmentConfig: FirebaseClientConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
    firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID || ''
  };
  const requiredEnvValues: Array<[string, string]> = [
    ['VITE_FIREBASE_API_KEY', environmentConfig.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', environmentConfig.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', environmentConfig.projectId],
    ['VITE_FIREBASE_STORAGE_BUCKET', environmentConfig.storageBucket],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', environmentConfig.messagingSenderId],
    ['VITE_FIREBASE_APP_ID', environmentConfig.appId],
    ['VITE_FIRESTORE_DATABASE_ID', environmentConfig.firestoreDatabaseId],
    ['VITE_FIREBASE_EXPECTED_PROJECT_ID', env.VITE_FIREBASE_EXPECTED_PROJECT_ID || '']
  ];
  const missing = requiredEnvValues
    .filter(([, value]) => isPlaceholderClientValue(value))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Firebase ${deploymentEnv} config belum lengkap: ${missing.join(', ')}`);
  }

  const expectedProjectId = env.VITE_FIREBASE_EXPECTED_PROJECT_ID?.trim();
  if (environmentConfig.projectId !== expectedProjectId) {
    throw new Error(
      `Project Firebase ${deploymentEnv} tidak sesuai target: diharapkan "${expectedProjectId}", ditemukan "${environmentConfig.projectId}".`
    );
  }

  return environmentConfig;
}
