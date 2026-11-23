import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buatProspekWebsite } from '../../server/websiteRfq';
import { bangunKontenDefault } from '../../src/utils/website';
import type { ProspekAlkes } from '../../src/types';

type JsonRecord = Record<string, unknown>;

const requestRfq = {
  requestId: 'aa115a5a-8a88-4a55-9a77-012345678901',
  namaInstansi: 'Klinik Sintetis',
  tipeInstansi: 'Klinik',
  namaPemohon: 'Petugas Uji',
  kontakPemohon: 'uji@example.invalid',
  jalurPengadaan: 'Permintaan Penawaran Reguler (RFQ)',
  subjek: 'Permintaan uji',
  pesan: 'Kebutuhan sintetis',
  produk: [{ nama: 'Produk Uji', tipeModel: 'Model A', produsen: 'Merek Uji', satuan: 'Unit', jumlah: 2 }]
};

describe('website publik: penerbitan dan RFQ melalui server terisolasi', () => {
  let tempDir = '';
  let modulesLink = '';
  let child: ChildProcess | undefined;
  let baseUrl = '';
  let developerToken = '';
  let payrollToken = '';
  let nomorProspek = '';

  async function request<T>(endpoint: string, method = 'GET', token = '', body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() as T };
  }

  async function start() {
    const preload = path.join(tempDir, 'localhost.cjs');
    const bundle = path.join(tempDir, 'server.mjs');
    child = spawn(process.execPath, ['--require', preload, bundle], {
      cwd: tempDir,
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT_ENV: 'development',
        PORT: '0',
        AMS_DATA_DIR: path.join(tempDir, 'data'),
        FIREBASE_SERVICE_ACCOUNT_PATH: path.join(tempDir, 'disabled-firebase.json'),
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
        ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
        ...(process.env.TMP ? { TMP: process.env.TMP } : {})
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    const port = await new Promise<number>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Server uji gagal dimulai: ${output}`)), 15000);
      child!.stdout!.on('data', (data: Buffer) => {
        output += data.toString();
        const match = /__AMS_TEST_PORT__(\d+)/.exec(output);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child!.stderr!.on('data', (data: Buffer) => { output += data.toString(); });
      child!.once('error', (error) => { clearTimeout(timer); reject(error); });
      child!.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server uji berhenti (${code}): ${output}`));
      });
    });
    baseUrl = `http://127.0.0.1:${port}`;
    expect((await fetch(`${baseUrl}/api/health`)).ok).toBe(true);
  }

  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    if (child.connected) child.send('shutdown');
    let timer: ReturnType<typeof setTimeout>;
    const stopped = await Promise.race([
      exited.then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 5000); })
    ]);
    clearTimeout(timer!);
    if (!stopped) {
      child.kill();
      await exited;
    }
  }

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-website-http-'));
    modulesLink = path.join(tempDir, 'node_modules');
    fs.symlinkSync(path.resolve('node_modules'), modulesLink, process.platform === 'win32' ? 'junction' : 'dir');
    await build({
      entryPoints: [path.resolve('server.ts')],
      outfile: path.join(tempDir, 'server.mjs'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      logLevel: 'silent'
    });
    fs.writeFileSync(path.join(tempDir, 'localhost.cjs'), `
      const http = require('node:http');
      const listen = http.Server.prototype.listen;
      http.Server.prototype.listen = function (_port, _host, callback) {
        const server = this;
        process.on('message', (message) => {
          if (message === 'shutdown') {
            server.close(() => process.disconnect());
            server.closeAllConnections();
          }
        });
        return listen.call(server, 0, '127.0.0.1', () => {
          process.stdout.write('__AMS_TEST_PORT__' + server.address().port + '\\n');
          callback();
        });
      };
    `);
    await start();
    const setup = await request<{ token: string }>('/api/auth/setup', 'POST', '', {
      username: 'developer.test', password: 'TestPassword123!', fullName: 'Developer Uji'
    });
    expect(setup.status).toBe(201);
    developerToken = setup.body.token;
    expect((await request('/api/rbac/users', 'POST', developerToken, {
      username: 'payroll.test', roleId: 'payroll_manager', fullName: 'Payroll Uji', password: 'TestPassword123!'
    })).status).toBe(201);
    const login = await request<{ token: string }>('/api/auth/login', 'POST', '', {
      username: 'payroll.test', password: 'TestPassword123!'
    });
    expect(login.status).toBe(200);
    payrollToken = login.body.token;
  }, 30000);

  afterAll(async () => {
    await stop();
    if (modulesLink && fs.existsSync(modulesLink)) fs.unlinkSync(modulesLink);
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }, 10000);

  it('menolak RFQ sebelum situs tayang, lalu menyimpan publikasi server sebagai sumber resmi', async () => {
    expect((await request('/api/website/rfq', 'POST', '', requestRfq)).status).toBe(503);
    const belumAda = await request<{ error: string }>('/api/website/published');
    expect(belumAda.status).toBe(404);
    expect(belumAda.body.error).toBe('WEBSITE_NOT_PUBLISHED');
    const cfg = {
      ...bangunKontenDefault({
        izinEdar: [], sertifikat: [], pemasok: [], pelanggan: [], kampanye: [], teritorial: [],
        stok: [], pengetahuanProduk: [], skemaHarga: [], rebate: [], garansi: [], produkKatalog: []
      }),
      isPublished: true,
      lastPublishedAt: Date.now()
    };
    const result = await request<{ config: typeof cfg; version: number }>('/api/website/published', 'PUT', developerToken, { config: cfg });
    expect(result.status).toBe(200);
    expect(result.body.config.isPublished).toBe(true);
    expect(result.body.version).toBeGreaterThan(0);
    expect((await request('/api/website/published', 'PUT', payrollToken, { config: cfg })).status).toBe(403);

    fs.writeFileSync(path.join(tempDir, 'data', 'website-published.json'), JSON.stringify({ ...cfg, isPublished: false }));
    const published = await request<{ config: typeof cfg }>('/api/website/published');
    expect(published.body.config.isPublished).toBe(true);
  });

  it('menolak snapshot tidak lengkap di seluruh jalur tulis tanpa mengubah state', async () => {
    const sebelumnya = await request<{ config: ReturnType<typeof bangunKontenDefault> }>('/api/website/published');
    const tidakLengkap = { identitas: sebelumnya.body.config.identitas, hero: sebelumnya.body.config.hero };
    const stateSebelum = await request<{ revision: number; entries: JsonRecord }>('/api/sync/state', 'GET', developerToken);
    const hasil = await Promise.all([
      request('/api/website/published', 'PUT', developerToken, { config: tidakLengkap }),
      request('/api/sync/keys/website_published', 'PUT', developerToken, { value: tidakLengkap }),
      request('/api/sync/batch', 'POST', developerToken, {
        updates: { website_published: tidakLengkap, website_uji_atomic: 'tidak boleh tersimpan' }
      }),
      request('/api/firebase/hydrate', 'POST', developerToken, {
        entries: {
          website_published: { value: tidakLengkap, updatedAt: '2099-01-01T00:00:00.000Z' },
          website_uji_atomic: { value: 'tidak boleh tersimpan', updatedAt: '2099-01-01T00:00:00.000Z' }
        }
      })
    ]);
    expect(hasil.map((item) => item.status)).toEqual([400, 400, 400, 400]);
    const stateSesudah = await request<{ revision: number; entries: JsonRecord }>('/api/sync/state', 'GET', developerToken);
    expect(stateSesudah.body.revision).toBe(stateSebelum.body.revision);
    expect(stateSesudah.body.entries.website_uji_atomic).toBeUndefined();
    expect((await request<{ config: typeof sebelumnya.body.config }>('/api/website/published')).body.config)
      .toEqual(sebelumnya.body.config);
  });

  it('tidak menulis salinan snapshot jika penyimpanan sync atau batch gagal', async () => {
    const sebelumnya = await request<{ config: ReturnType<typeof bangunKontenDefault> }>('/api/website/published');
    const cfg = { ...sebelumnya.body.config, hero: { ...sebelumnya.body.config.hero, judul: 'Tidak boleh tersimpan' } };
    const berkas = path.join(tempDir, 'data', 'website-published.json');
    const salinanSebelum = fs.readFileSync(berkas, 'utf8');
    const tmpState = path.join(tempDir, 'data', 'app-state.json.tmp');
    fs.mkdirSync(tmpState);
    try {
      expect((await request('/api/sync/keys/website_published', 'PUT', developerToken, { value: cfg })).status).toBe(500);
      expect((await request('/api/sync/batch', 'POST', developerToken, { updates: { website_published: cfg } })).status).toBe(500);
      expect(fs.readFileSync(berkas, 'utf8')).toBe(salinanSebelum);
      expect((await request<{ config: typeof cfg }>('/api/website/published')).body.config).toEqual(sebelumnya.body.config);
    } finally {
      fs.rmdirSync(tmpState);
    }
  });

  it('memberi peringatan jika snapshot tersimpan tetapi salinan statis gagal ditulis', async () => {
    const sebelumnya = await request<{ config: ReturnType<typeof bangunKontenDefault> }>('/api/website/published');
    const cfg = { ...sebelumnya.body.config, hero: { ...sebelumnya.body.config.hero, judul: 'Snapshot dengan peringatan' } };
    const berkas = path.join(tempDir, 'public', 'website-published.json');
    const cadangan = path.join(tempDir, 'public', 'website-published-test-backup.json');
    fs.renameSync(berkas, cadangan);
    fs.mkdirSync(berkas);
    try {
      const hasil = await request<{ peringatan?: string }>('/api/sync/keys/website_published', 'PUT', developerToken, { value: cfg });
      expect(hasil.status).toBe(200);
      expect(hasil.body.peringatan).toMatch(/salinan berkas/i);
      expect((await request<{ config: typeof cfg }>('/api/website/published')).body.config.hero.judul).toBe(cfg.hero.judul);
    } finally {
      fs.rmdirSync(berkas);
      fs.renameSync(cadangan, berkas);
    }
  });

  it('membedakan kegagalan simpan snapshot dari kegagalan audit setelah snapshot tersimpan', async () => {
    const sebelumnya = await request<{ config: ReturnType<typeof bangunKontenDefault> }>('/api/website/published');
    const cfg = {
      ...sebelumnya.body.config,
      hero: { ...sebelumnya.body.config.hero, judul: 'Judul publikasi sintetis' }
    };
    const tmpState = path.join(tempDir, 'data', 'app-state.json.tmp');
    fs.mkdirSync(tmpState);
    try {
      expect((await request('/api/website/published', 'PUT', developerToken, { config: cfg })).status).toBe(500);
      const tetap = await request<{ config: typeof cfg }>('/api/website/published');
      expect(tetap.body.config.hero.judul).not.toBe(cfg.hero.judul);
    } finally {
      fs.rmdirSync(tmpState);
    }

    const tmpAudit = path.join(tempDir, 'data', 'rbac-db.json.tmp');
    fs.mkdirSync(tmpAudit);
    try {
      const disimpan = await request<{ config: typeof cfg; peringatan?: string }>(
        '/api/website/published', 'PUT', developerToken, { config: cfg }
      );
      expect(disimpan.status).toBe(200);
      expect(disimpan.body.config.hero.judul).toBe(cfg.hero.judul);
      expect(disimpan.body.peringatan).toMatch(/audit server gagal/i);
      const tayang = await request<{ config: typeof cfg }>('/api/website/published');
      expect(tayang.body.config.hero.judul).toBe(cfg.hero.judul);
    } finally {
      fs.rmdirSync(tmpAudit);
    }
  });

  it('mengonfirmasi foto tersimpan dan memberi peringatan jika audit media gagal', async () => {
    const png = fs.readFileSync(path.resolve('public', 'pwa-192x192.png'));
    const tmpAudit = path.join(tempDir, 'data', 'rbac-db.json.tmp');
    fs.mkdirSync(tmpAudit);
    try {
      const hasil = await request<{ id: string; url: string; peringatan?: string }>(
        '/api/media/upload', 'POST', developerToken, {
          id: 'media-audit-uji',
          filename: 'foto-uji.png',
          dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          visibility: 'public',
          scope: 'website'
        }
      );
      expect(hasil.status).toBe(201);
      expect(hasil.body.peringatan).toMatch(/audit server gagal/i);
      const foto = await fetch(`${baseUrl}${hasil.body.url}`);
      expect(foto.status).toBe(200);
      expect(Buffer.from(await foto.arrayBuffer())).toEqual(png);
    } finally {
      fs.rmdirSync(tmpAudit);
    }
  });

  it('memvalidasi, menyimpan dan menyiarkan RFQ hanya ke pengguna yang memiliki akses', async () => {
    expect((await request('/api/website/rfq', 'POST', '', { ...requestRfq, kontakPemohon: '' })).status).toBe(400);
    expect((await request('/api/website/rfq', 'POST', '', {
      ...requestRfq, produk: [{ ...requestRfq.produk[0], jumlah: -1 }]
    })).status).toBe(400);

    const adminSocket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/sync/ws?token=${encodeURIComponent(developerToken)}`);
    const publicSocket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/sync/ws`);
    await Promise.all([once(adminSocket, 'open'), once(publicSocket, 'open')]);
    let bocor = false;
    publicSocket.on('message', (raw) => {
      const pesan = JSON.parse(raw.toString()) as JsonRecord;
      if (pesan.key === 'sales_website_rfq') bocor = true;
    });
    const received = new Promise<JsonRecord>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Pembaruan RFQ tidak diterima.')), 5000);
      adminSocket.on('message', (raw) => {
        const pesan = JSON.parse(raw.toString()) as JsonRecord;
        if (pesan.key === 'sales_website_rfq') {
          clearTimeout(timer);
          resolve(pesan);
        }
      });
    });
    try {
      const created = await request<{ nomorProspek: string }>('/api/website/rfq', 'POST', '', requestRfq);
      expect(created.status).toBe(201);
      nomorProspek = created.body.nomorProspek;
      expect(nomorProspek).toMatch(/^WEB-RFQ-\d{6}-[A-F0-9]{12}$/);
      const siaran = await received;
      expect(siaran.value).toEqual([expect.objectContaining({
        nomorProspek, namaProspek: 'Klinik Sintetis', sumberLead: 'Situs Web',
        produkDiminati: expect.stringContaining('Model A')
      })]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(bocor).toBe(false);
    } finally {
      adminSocket.terminate();
      publicSocket.terminate();
    }

    const ulang = await request<{ nomorProspek: string }>('/api/website/rfq', 'POST', '', requestRfq);
    expect(ulang.status).toBe(200);
    expect(ulang.body.nomorProspek).toBe(nomorProspek);
    expect((await request('/api/website/rfq', 'POST', '', { ...requestRfq, pesan: 'Isi berbeda' })).status).toBe(409);
    expect((await request('/api/sync/state')).status).toBe(401);
    const publik = await request<{ entries: JsonRecord }>('/api/sync/public-settings');
    expect(publik.body.entries).not.toHaveProperty('sales_website_rfq');
    const payroll = await request<{ entries: JsonRecord }>('/api/sync/state', 'GET', payrollToken);
    expect(payroll.body.entries).not.toHaveProperty('sales_website_rfq');
    expect((await request('/api/sync/keys/sales_website_rfq', 'PUT', developerToken, { value: [] })).status).toBe(403);
    expect((await request('/api/sync/keys/sales_website_rfq', 'DELETE', developerToken)).status).toBe(403);
    expect((await request('/api/sync/batch', 'POST', developerToken, { updates: { sales_website_rfq: [] } })).status).toBe(403);
    expect((await request('/api/sync/purge-dummy', 'POST', developerToken, { deletes: ['sales_website_rfq'] })).status).toBe(403);
    expect((await request('/api/sync/purge-dummy', 'POST', developerToken, { updates: { sales_website_rfq: [] } })).status).toBe(403);
  });

  it('tidak melaporkan keberhasilan ketika penulisan server gagal, termasuk saat dicoba ulang', async () => {
    const baru = { ...requestRfq, requestId: 'bb115a5a-8a88-4a55-9a77-012345678901' };
    const tmpPath = path.join(tempDir, 'data', 'app-state.json.tmp');
    fs.mkdirSync(tmpPath);
    try {
      expect((await request('/api/website/rfq', 'POST', '', baru)).status).toBe(500);
      expect((await request('/api/website/rfq', 'POST', '', baru)).status).toBe(500);
    } finally {
      fs.rmdirSync(tmpPath);
    }
    expect((await request('/api/website/rfq', 'POST', '', baru)).status).toBe(201);
  });

  it('mempertahankan RFQ dan status tayang setelah restart', async () => {
    await stop();
    await start();
    const login = await request<{ token: string }>('/api/auth/login', 'POST', '', {
      username: 'developer.test', password: 'TestPassword123!'
    });
    expect(login.status).toBe(200);
    developerToken = login.body.token;
    const state = await request<{ entries: Record<string, { value: ProspekAlkes[] }> }>('/api/sync/state', 'GET', login.body.token);
    const rfq = state.body.entries.sales_website_rfq.value;
    expect(rfq).toHaveLength(2);
    expect(rfq.map((item) => item.nomorProspek)).toContain(nomorProspek);
    const published = await request<{ config: { isPublished: boolean } }>('/api/website/published');
    expect(published.body.config.isPublished).toBe(true);
    const duplicate = await request<{ nomorProspek: string }>('/api/website/rfq', 'POST', '', requestRfq);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.nomorProspek).toBe(nomorProspek);
  }, 30000);

  it('menggabungkan RFQ cloud tanpa menimpa antrean server dan membatalkan pemulihan yang konflik', async () => {
    const cloudEntry = buatProspekWebsite({
      ...requestRfq,
      requestId: 'cc115a5a-8a88-4a55-9a77-012345678901',
      namaInstansi: 'Klinik Cloud Sintetis'
    });
    if (!cloudEntry.ok) throw new Error(cloudEntry.pesan);
    const snapshotCloud = (value: unknown) => ({ value, version: 999, updatedAt: '2099-01-01T00:00:00.000Z' });

    expect((await request('/api/firebase/hydrate', 'POST', developerToken, {
      entries: { sales_website_rfq: snapshotCloud([]) }
    })).status).toBe(200);
    expect((await request('/api/firebase/hydrate', 'POST', developerToken, {
      entries: { sales_website_rfq: snapshotCloud([cloudEntry.prospek]) }
    })).status).toBe(200);
    const merged = await request<{ entries: Record<string, { value: ProspekAlkes[] }> }>('/api/sync/state', 'GET', developerToken);
    const daftar = merged.body.entries.sales_website_rfq.value;
    expect(daftar).toHaveLength(3);
    expect(daftar.map((item) => item.nomorProspek)).toContain(nomorProspek);
    expect(daftar.map((item) => item.id)).toContain(cloudEntry.prospek.id);

    expect((await request('/api/firebase/hydrate', 'POST', developerToken, {
      entries: { sales_website_rfq: snapshotCloud([{ ...cloudEntry.prospek, id: cloudEntry.prospek.id.toUpperCase() }]) }
    })).status).toBe(200);
    const tanpaDuplikat = await request<{ entries: Record<string, { value: ProspekAlkes[] }> }>('/api/sync/state', 'GET', developerToken);
    expect(tanpaDuplikat.body.entries.sales_website_rfq.value).toEqual(daftar);

    const konflik = { ...daftar[0], catatan: 'Isi konflik sintetis' };
    const gagal = await request('/api/firebase/hydrate', 'POST', developerToken, {
      entries: {
        website_rollback_test: snapshotCloud({ value: 'tidak boleh tersimpan' }),
        sales_website_rfq: snapshotCloud([konflik])
      }
    });
    expect(gagal.status).toBe(500);
    const setelah = await request<{ entries: Record<string, { value: unknown }> }>('/api/sync/state', 'GET', developerToken);
    expect(setelah.body.entries).not.toHaveProperty('website_rollback_test');
    expect(setelah.body.entries.sales_website_rfq.value).toEqual(daftar);
  });

  it('membatasi RFQ berdasarkan alamat klien pada proxy tepercaya, bukan alamat awal yang dapat dipalsukan', async () => {
    for (let i = 0; i < 21; i++) {
      const response = await request('/api/website/rfq', 'POST', '', {}, {
        'X-Forwarded-For': `192.0.2.${i + 1}, 203.0.113.42`
      });
      expect(response.status).toBe(i < 20 ? 400 : 429);
    }
  });
});
