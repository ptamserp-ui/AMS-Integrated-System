export interface WindowsDeploymentGuides {
  environment: 'staging' | 'production' | 'development';
  isStaging: boolean;
  caddyfile: string;
  nssmCommands: string[];
  envStagingTemplate: string;
  envProductionTemplate: string;
  powershellQuickDeploy: string[];
}

export function buildWindowsDeploymentGuides(opts?: {
  domain?: string;
  deploymentEnv?: string;
  activeDriver?: 'firebase' | 'pocketbase';
  port?: number;
}): WindowsDeploymentGuides {
  const rawEnv = (opts?.deploymentEnv || 'staging').trim().toLowerCase();
  const environment =
    rawEnv === 'staging' ? 'staging' : rawEnv === 'production' ? 'production' : 'development';
  const isStaging = environment === 'staging';
  const domain = (opts?.domain || 'ams.bejodigitalprint.com').trim();
  const configuredPort = opts?.port;
  const port = configuredPort && Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
  const firebaseProjectId = environment === 'production' ? 'ams-integrated-system' : 'ams-integrated-staging';

  const caddyfile = `# Caddyfile Konfigurasi Reverse Proxy + HTTPS Otomatis (Windows Server VPS)
# Lokasi file: C:\\caddy\\Caddyfile
# Catatan: Pastikan domain ${domain} sudah ditambahkan ke Firebase Auth -> Authorized domains

${domain} {
    encode gzip zstd

    # Reverse proxy utama (Express API + SPA + WebSocket /api/sync/ws)
    reverse_proxy 127.0.0.1:${port} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Header Keamanan Standar Medis & Privasi Data (UU PDP)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Opsional (Hanya jika mode PocketBase diaktifkan kembali pada 127.0.0.1:8091)
    # handle_path /api/ams-pb/* {
    #     reverse_proxy 127.0.0.1:8091
    # }

    log {
        output file C:\\caddy\\logs\\ams_access.log {
            roll_size 20mb
            roll_keep 10
        }
    }
}`;

  const nssmCommands = [
    `# ===== 1. PERSIAPAN DIREKTORI & BUILD FIREBASE ${environment.toUpperCase()} (PowerShell Admin) =====`,
    'New-Item -ItemType Directory -Force -Path C:\\AMS\\App, C:\\AMS\\Data, C:\\AMS\\Secrets, C:\\AMS\\Backups, C:\\AMS\\Logs | Out-Null',
    'cd C:\\AMS\\App',
    `Copy-Item .env.${environment}.example .env.${environment} -Force  # isi Firebase ${firebaseProjectId} dan Service Account yang sesuai`,
    'npm ci',
    `npm run build:${environment}`,
    '',
    '# ===== 2. PASANG NODE EXPRESS SERVICE (WAJIB 1 INSTANCE TUNGGAL) =====',
    'nssm install AMS_AppService "C:\\Program Files\\nodejs\\node.exe" "C:\\AMS\\App\\server.js"',
    'nssm set AMS_AppService AppDirectory "C:\\AMS\\App"',
    `nssm set AMS_AppService AppEnvironmentExtra NODE_ENV=production DEPLOYMENT_ENV=${environment} VITE_DEPLOYMENT_ENV=${environment} AMS_DB_DRIVER=firebase PORT=${port} AMS_DATA_DIR=C:\\AMS\\Data FIREBASE_PROJECT_ID=${firebaseProjectId} FIREBASE_EXPECTED_PROJECT_ID=${firebaseProjectId} FIREBASE_SERVICE_ACCOUNT_PATH=C:\\AMS\\Secrets\\${firebaseProjectId}-service-account.json`,
    'nssm set AMS_AppService AppStdout "C:\\AMS\\Logs\\service_output.log"',
    'nssm set AMS_AppService AppStderr "C:\\AMS\\Logs\\service_error.log"',
    'nssm set AMS_AppService Start SERVICE_AUTO_START',
    'nssm restart AMS_AppService',
    '',
    '# Caddy is shared; do not install, stop, or restart its service for an AMS deploy.',
    '',
    `# ===== 4. VERIFIKASI ENDPOINT FIREBASE ${environment.toUpperCase()} =====`,
    `Invoke-RestMethod -Uri "http://127.0.0.1:${port}/api/health"`,
    `Invoke-RestMethod -Uri "http://127.0.0.1:${port}/api/system/db-config"`
  ];

  const buildEnvTemplate = (target: 'staging' | 'production', projectId: string, databaseId: string) => `# Simpan sebagai C:\\AMS\\App\\.env.${target} (JANGAN di-commit ke Git)
NODE_ENV=production
PORT=${port}
APP_URL=https://${domain}
DEPLOYMENT_ENV=${target}
VITE_DEPLOYMENT_ENV=${target}
AMS_DB_DRIVER=firebase
AMS_DATA_DIR=C:\\AMS\\Data

# Firebase Web App Config (ambil nilai Web App dari Firebase Console)
VITE_FIREBASE_API_KEY=GANTI_DARI_FIREBASE_CONSOLE
VITE_FIREBASE_AUTH_DOMAIN=GANTI_DARI_FIREBASE_CONSOLE
VITE_FIREBASE_PROJECT_ID=${projectId}
VITE_FIREBASE_EXPECTED_PROJECT_ID=${projectId}
VITE_FIREBASE_STORAGE_BUCKET=GANTI_DARI_FIREBASE_CONSOLE
VITE_FIREBASE_MESSAGING_SENDER_ID=GANTI_DARI_FIREBASE_CONSOLE
VITE_FIREBASE_APP_ID=GANTI_DARI_FIREBASE_CONSOLE
VITE_FIRESTORE_DATABASE_ID=${databaseId}
VITE_FIREBASE_ADMIN_EMAIL=ptams.erp@gmail.com

# Firebase Admin SDK Server-to-Server (simpan JSON di C:\\AMS\\Secrets)
FIREBASE_PROJECT_ID=${projectId}
FIREBASE_EXPECTED_PROJECT_ID=${projectId}
FIRESTORE_DATABASE_ID=${databaseId}
FIREBASE_FIRESTORE_DATABASE_ID=${databaseId}
FIRESTORE_EXPECTED_DATABASE_ID=${databaseId}
FIREBASE_SERVICE_ACCOUNT_PATH=C:\\AMS\\Secrets\\${projectId}-service-account.json

# Rahasia Server (Buat minimal 48 karakter acak di PowerShell)
SESSION_SECRET=GANTI_DENGAN_RANDOM_HEX_64_KARAKTER
INITIAL_SETUP_TOKEN=GANTI_TOKEN_SETUP_AWAL_STAGING
BOOTSTRAP_DEV_EMAIL=ptams.erp@gmail.com
FIREBASE_ADMIN_EMAILS=ptams.erp@gmail.com,antraderyll@gmail.com`;
  const envStagingTemplate = buildEnvTemplate('staging', 'ams-integrated-staging', '(default)');
  const envProductionTemplate = buildEnvTemplate('production', 'ams-integrated-system', 'GANTI_DATABASE_ID_PRODUCTION');

  const powershellQuickDeploy = [
    `# Jalankan di PowerShell Administrator pada Windows Server VPS untuk mode ${environment}:`,
    'cd C:\\AMS\\App',
    `powershell -ExecutionPolicy Bypass -File .\\deploy.ps1 -Domain "${domain}" -Port ${port} -DeploymentEnv ${environment} -EnvFileName .env.${environment}`
  ];

  return {
    environment,
    isStaging,
    caddyfile,
    nssmCommands,
    envStagingTemplate,
    envProductionTemplate,
    powershellQuickDeploy
  };
}
