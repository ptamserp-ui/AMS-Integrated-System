import fs from 'fs';
import path from 'path';

const root = process.cwd();
const args = process.argv.slice(2);
const targetUrlArg = args.find((a) => a.startsWith('--url='))?.slice('--url='.length)?.trim();

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: CheckResult[] = [];

function checkFile(relPath: string, label: string) {
  const full = path.join(root, relPath);
  const exists = fs.existsSync(full);
  checks.push({
    name: label,
    ok: exists,
    detail: exists ? `${relPath} tersedia` : `${relPath} tidak ditemukan`
  });
}

checkFile('deploy.ps1', 'Skrip deploy Windows VPS');
checkFile('scripts/backup-windows-vps.ps1', 'Skrip backup Windows VPS');
checkFile('scripts/verify-windows-vps.ps1', 'Skrip verifikasi Windows VPS');
checkFile('scripts/setup-vps.sh', 'Skrip provisioning Linux VPS');
checkFile('ecosystem.config.cjs', 'Konfigurasi PM2 Single-Instance');
checkFile('firestore.rules', 'Aturan keamanan Firestore');
checkFile('dist/index.html', 'Artefak build frontend (dist/index.html)');
checkFile('server.js', 'Artefak build server (server.js)');

const indexHtmlPath = path.join(root, 'dist', 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const hasAssets = html.includes('/assets/');
  checks.push({
    name: 'Validasi dist/index.html',
    ok: hasAssets,
    detail: hasAssets ? 'Asset JS/CSS terpasang di dist/index.html' : 'Asset JS/CSS tidak ditemukan di dist/index.html'
  });
}

async function runHttpChecks(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '');
  const endpoints = [
    { path: '/api/health', expectJsonKey: 'status' },
    { path: '/api/system/db-config', expectJsonKey: 'activeDriver' },
    { path: '/api/website/published', expectJsonKey: null },
    { path: '/web', expectJsonKey: null }
  ];

  for (const ep of endpoints) {
    const url = `${normalized}${ep.path}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept-Encoding': 'gzip' }
      });
      const contentType = res.headers.get('content-type') || '';
      const okStatus = res.status >= 200 && res.status < 300;
      let detail = `HTTP ${res.status} (${contentType.split(';')[0] || 'unknown'})`;

      if (okStatus && ep.expectJsonKey) {
        const json = (await res.json()) as Record<string, unknown>;
        detail += ` · ${ep.expectJsonKey}=${String(json[ep.expectJsonKey] ?? '-')}`;
        if (ep.path === '/api/system/db-config') {
          const fb = json.firebase as { projectId?: string } | undefined;
          const admin = json.firebaseAdmin as { connected?: boolean; databaseId?: string } | undefined;
          detail += `, env=${String(json.deploymentEnv ?? '-')}, project=${fb?.projectId ?? '-'}, admin=${String(admin?.connected ?? false)}, db=${admin?.databaseId ?? '-'}`;
        }
      }
      checks.push({ name: `Live ${ep.path}`, ok: okStatus, detail });
    } catch (err) {
      checks.push({
        name: `Live ${ep.path}`,
        ok: false,
        detail: err instanceof Error ? err.message : String(err)
      });
    }
  }
}

async function main() {
  if (targetUrlArg) {
    await runHttpChecks(targetUrlArg);
  }

  let failed = 0;
  for (const item of checks) {
    const mark = item.ok ? 'PASS' : 'FAIL';
    if (!item.ok) failed += 1;
    console.log(`[${mark}] ${item.name}: ${item.detail}`);
  }

  if (failed > 0) {
    console.error(`\nTotal gagal: ${failed} pemeriksaan.`);
    process.exit(1);
  }
  console.log('\nSeluruh pemeriksaan kesiapan deployment lulus.');
}

void main();
