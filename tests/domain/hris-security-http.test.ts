import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { RoleDefinition } from '../../src/types';
import { buatIdentitasSinkronisasi, HEADER_IDENTITAS_SYNC } from '../../src/utils/identitasSinkronisasi';
import { bangunKontenDefault } from '../../src/utils/website';

type JsonRecord = Record<string, unknown>;
type SyncState = {
  revision: number;
  entries: Record<string, { value: unknown }>;
  versions: Record<string, number>;
  allowedKeys: string[];
  writableKeys: string[];
  deletableKeys: string[];
};

const profile = {
  id: 'EMP-01',
  nik: 'NIK-01',
  nama: 'Pegawai Satu',
  gajiPokok: 10,
  riwayatKesehatan: 'rahasia',
  sertifikasi: [{ nama: 'CDAKB', nomor: 'CERT-1', masaBerlaku: '2030-01-01', catatanMedis: 'rahasia' }]
};
const otherProfile = { id: 'EMP-02', nama: 'Pegawai Dua' };
const approvedLeave = {
  id: 'CUTI-1', karyawanId: 'EMP-01', status: 'Disetujui', disetujuiOleh: 'HRD',
  jenis: 'Cuti Tahunan', tanggalMulai: '2026-12-01', tanggalSelesai: '2026-12-02',
  jumlahHari: 2, alasan: 'Keluarga', tanggalPengajuan: '2026-11-01'
};
const otherLeave = { id: 'CUTI-2', karyawanId: 'EMP-02', status: 'Menunggu' };
const projectedProfile = {
  id: 'EMP-01',
  nik: 'NIK-01',
  nama: 'Pegawai Satu',
  sertifikasi: [{ nama: 'CDAKB', nomor: 'CERT-1', masaBerlaku: '2030-01-01' }]
};

function waitForMessage(socket: WebSocket, predicate: (message: JsonRecord) => boolean): Promise<JsonRecord> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Pesan WebSocket uji tidak diterima.'));
    }, 5000);
    const onMessage = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as JsonRecord;
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

describe('isolasi HRIS melalui HTTP dan WebSocket', () => {
  let tempDir = '';
  let modulesLink = '';
  let child: ChildProcess | undefined;
  let baseUrl = '';
  let developerToken = '';
  let employeeToken = '';
  let payrollToken = '';
  let pjtToken = '';

  async function request<T>(
    endpoint: string,
    method = 'GET',
    token = '',
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ) {
    let requestBody = body;
    const requestHeaders = { ...extraHeaders };
    const syncKeys = endpoint.startsWith('/api/sync/keys/')
      ? [decodeURIComponent(endpoint.slice('/api/sync/keys/'.length))]
      : endpoint === '/api/sync/batch' && body && typeof body === 'object'
        ? [
            ...Object.keys((body as { updates?: Record<string, unknown> }).updates ?? {}),
            ...((body as { deletes?: string[] }).deletes ?? [])
          ]
        : [];
    if (token && syncKeys.length > 0) {
      const stateResponse = await fetch(
        `${baseUrl}/api/sync/state?known=${encodeURIComponent(JSON.stringify(syncKeys))}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...extraHeaders
          }
        }
      );
      const state = stateResponse.ok
        ? await stateResponse.json() as { versions?: Record<string, number> }
        : {};
      const versions = Object.fromEntries(syncKeys.map((key) => [key, state.versions?.[key] ?? 0]));
      if (endpoint === '/api/sync/batch') {
        const batch = body as { expectedVersions?: Record<string, number> };
        if (!batch.expectedVersions) requestBody = { ...batch, expectedVersions: versions };
      } else if (!Object.hasOwn(requestHeaders, 'If-Match')) {
        requestHeaders['If-Match'] = `"${versions[syncKeys[0]]}"`;
      }
    }
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...requestHeaders
      },
      ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {})
    });
    return { status: response.status, body: await response.json() as T };
  }

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-hris-http-'));
    modulesLink = path.join(tempDir, 'node_modules');
    fs.symlinkSync(path.resolve('node_modules'), modulesLink, process.platform === 'win32' ? 'junction' : 'dir');
    const bundle = path.join(tempDir, 'server.mjs');
    await build({
      entryPoints: [path.resolve('server.ts')],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      logLevel: 'silent'
    });
    const preload = path.join(tempDir, 'localhost.cjs');
    fs.writeFileSync(preload, `
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

    const setup = await request<{ token: string }>('/api/auth/setup', 'POST', '', {
      username: 'dev.test', password: 'TestPassword123!', fullName: 'Developer Test'
    });
    expect(setup.status).toBe(201);
    developerToken = setup.body.token;
    expect((await request('/api/sync/batch', 'POST', developerToken, {
      updates: {
        hris_karyawan: [profile, otherProfile],
        hris_cuti: [approvedLeave, otherLeave],
        hris_slip_gaji: [{ id: 'SLIP-1', karyawanId: 'EMP-01', jumlah: 100 }]
      }
    })).status).toBe(200);

    for (const [username, roleId, employeeId] of [
      ['staf.test', 'karyawan', 'EMP-01'],
      ['payroll.test', 'payroll_manager', ''],
      ['pjt.test', 'pjt', '']
    ]) {
      expect((await request('/api/rbac/users', 'POST', developerToken, {
        username, roleId, employeeId, fullName: username, password: 'TestPassword123!'
      })).status).toBe(201);
    }
    const login = async (username: string) => {
      const result = await request<{ token: string }>('/api/auth/login', 'POST', '', {
        username, password: 'TestPassword123!'
      });
      expect(result.status).toBe(200);
      return result.body.token;
    };
    employeeToken = await login('staf.test');
    payrollToken = await login('payroll.test');
    pjtToken = await login('pjt.test');
  }, 30000);

  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      if (child.connected) child.send('shutdown');
      let timeout: ReturnType<typeof setTimeout>;
      const stopped = await Promise.race([
        exited.then(() => true),
        new Promise<false>((resolve) => { timeout = setTimeout(() => resolve(false), 5000); })
      ]);
      clearTimeout(timeout!);
      if (!stopped) {
        child.kill();
        await exited;
      }
    }
    if (modulesLink && fs.existsSync(modulesLink)) fs.unlinkSync(modulesLink);
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }, 10000);

  it('memverifikasi identitas antrean sebelum membaca atau mengirim data dan media', async () => {
    const auth = await request<{
      user: { id: string; employeeId?: string };
      role: RoleDefinition;
    }>('/api/auth/me', 'GET', employeeToken);
    const { user, role } = auth.body;
    const identity = buatIdentitasSinkronisasi(user.id, role.id, role.permissions, user.employeeId);
    const staleIdentity = buatIdentitasSinkronisasi(user.id, role.id, role.permissions, 'EMP-02');
    const known = encodeURIComponent(JSON.stringify(['hris_cuti', 'audit_trail']));
    const validHeaders = { [HEADER_IDENTITAS_SYNC]: encodeURIComponent(identity) };
    const staleHeaders = { [HEADER_IDENTITAS_SYNC]: encodeURIComponent(staleIdentity) };
    const valid = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', employeeToken, undefined, validHeaders);
    expect(valid.status).toBe(200);
    expect(valid.body.writableKeys).toEqual(expect.arrayContaining(['hris_cuti', 'audit_trail']));
    expect(valid.body.allowedKeys).not.toContain('audit_trail');
    expect(valid.body.deletableKeys).not.toContain('hris_cuti');

    expect((await request('/api/sync/state', 'GET', employeeToken, undefined, staleHeaders)).status).toBe(409);
    expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, { value: [] }, staleHeaders)).status).toBe(409);
    expect((await request('/api/sync/keys/hris_cuti', 'DELETE', employeeToken, undefined, staleHeaders)).status).toBe(409);
    expect((await request('/api/sync/batch', 'POST', employeeToken, { updates: { hris_cuti: [] } }, staleHeaders)).status).toBe(409);
    expect((await request('/api/media/upload', 'POST', employeeToken, {}, staleHeaders)).status).toBe(409);
    const unchanged = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect(unchanged.body.entries.hris_cuti.value).toEqual([approvedLeave, otherLeave]);
  });

  it('menolak PUT, batch, dan DELETE dengan versi basi tanpa menerapkan bagian batch lain', async () => {
    const known = encodeURIComponent(JSON.stringify(['website_draft', 'website_content_v']));
    const before = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    const initialVersion = before.body.versions.website_draft ?? 0;
    const simultaneousWrites = await Promise.all([
      request('/api/sync/keys/website_draft', 'PUT', developerToken, {
        value: { judul: 'Perubahan editor satu' }
      }, { 'If-Match': `"${initialVersion}"` }),
      request('/api/sync/keys/website_draft', 'PUT', developerToken, {
        value: { judul: 'Perubahan editor dua' }
      }, { 'If-Match': `"${initialVersion}"` })
    ]);
    expect(simultaneousWrites.map((write) => write.status).sort()).toEqual([200, 409]);

    const staleHeader = { 'If-Match': `"${initialVersion}"` };
    expect((await request('/api/sync/keys/website_draft', 'PUT', developerToken, {
      value: { judul: 'Draf basi' }
    }, staleHeader)).status).toBe(409);

    const afterFirstWrite = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    const acceptedDraft = afterFirstWrite.body.entries.website_draft.value;
    const untouchedVersion = afterFirstWrite.body.versions.website_content_v ?? 0;
    const revision = afterFirstWrite.body.revision;
    expect((await request('/api/sync/batch', 'POST', developerToken, {
      updates: {
        website_draft: { judul: 'Draf batch basi' },
        website_content_v: 99
      },
      expectedVersions: {
        website_draft: initialVersion,
        website_content_v: untouchedVersion
      }
    })).status).toBe(409);
    expect((await request('/api/sync/keys/website_draft', 'DELETE', developerToken, undefined, staleHeader)).status).toBe(409);

    const afterConflicts = await request<SyncState & { revision: number }>(
      `/api/sync/state?known=${known}`,
      'GET',
      developerToken
    );
    expect(afterConflicts.body.revision).toBe(revision);
    expect(afterConflicts.body.entries.website_draft.value).toEqual(acceptedDraft);
    expect(afterConflicts.body.entries.website_content_v).toBeUndefined();

    expect((await request('/api/sync/keys/website_draft', 'DELETE', developerToken, undefined, {
      'If-Match': `"${afterConflicts.body.versions.website_draft}"`
    })).status).toBe(200);
    const afterDelete = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    expect(afterDelete.body.entries.website_draft).toBeUndefined();
    expect(afterDelete.body.versions.website_draft).toBe(initialVersion + 2);
    expect((await request('/api/sync/keys/website_draft', 'PUT', developerToken, {
      value: { judul: 'Dibuat ulang' }
    }, { 'If-Match': `"${afterDelete.body.versions.website_draft}"` })).status).toBe(200);

    const missingVersion = await fetch(`${baseUrl}/api/sync/keys/website_draft`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${developerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { judul: 'Tanpa precondition' } })
    });
    expect(missingVersion.status).toBe(428);
  });

  it('melindungi purge administratif dengan versi setiap kunci dan menolak purge basi secara atomik', async () => {
    const key = 'website_sync_conflict_probe';
    const known = encodeURIComponent(JSON.stringify([key]));
    const initial = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    const initialVersion = initial.body.versions[key] ?? 0;
    const update = (value: string) => ({ updates: { [key]: { value } } });

    expect((await request('/api/sync/purge-dummy', 'POST', developerToken, update('tanpa versi'))).status).toBe(428);
    expect((await request('/api/sync/purge-dummy', 'POST', developerToken, {
      ...update('versi tidak lengkap'),
      expectedVersions: {}
    })).status).toBe(428);

    expect((await request(`/api/sync/keys/${key}`, 'PUT', developerToken, {
      value: { value: 'versi terbaru' }
    }, { 'If-Match': `"${initialVersion}"` })).status).toBe(200);
    const afterWrite = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    const stale = await request<JsonRecord>('/api/sync/purge-dummy', 'POST', developerToken, {
      ...update('purge basi'),
      expectedVersions: { [key]: initialVersion }
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('SYNC_VERSION_CONFLICT');

    const afterConflict = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    expect(afterConflict.body.revision).toBe(afterWrite.body.revision);
    expect(afterConflict.body.entries[key].value).toEqual({ value: 'versi terbaru' });

    const accepted = await request('/api/sync/purge-dummy', 'POST', developerToken, {
      ...update('purge tervalidasi'),
      expectedVersions: { [key]: afterConflict.body.versions[key] }
    });
    expect(accepted.status).toBe(200);
    const afterAccepted = await request<SyncState>(`/api/sync/state?known=${known}`, 'GET', developerToken);
    expect(afterAccepted.body.entries[key].value).toEqual({ value: 'purge tervalidasi' });
  });

  it('membatasi snapshot, event realtime, dan perubahan cuti self-service', async () => {
    const snapshot = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.entries.hris_karyawan.value).toEqual([projectedProfile]);
    expect(snapshot.body.entries.hris_cuti.value).toEqual([approvedLeave]);
    expect(snapshot.body.entries.hris_slip_gaji).toBeUndefined();
    expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, {
      value: [{ ...approvedLeave, tanggalMulai: '2026-12-10' }]
    })).status).toBe(403);
    expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, {
      value: [{ id: 'CUTI-2', karyawanId: 'EMP-01' }]
    })).status).toBe(403);
    expect((await request('/api/sync/batch', 'POST', employeeToken, {
      updates: { hris_cuti: [{ ...approvedLeave, tanggalMulai: '2026-12-10' }] }
    })).status).toBe(403);
    expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, {
      value: [{ id: 'CUTI-3', karyawanId: 'EMP-01', jenis: 'Cuti Tahunan' }]
    })).status).toBe(200);
    const fullState = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect(fullState.body.entries.hris_cuti.value).toEqual([
      otherLeave, approvedLeave, expect.objectContaining({ id: 'CUTI-3', status: 'Menunggu' })
    ]);

    const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/sync/ws?token=${encodeURIComponent(employeeToken)}`);
    try {
      await waitForMessage(socket, (message) => message.type === 'sync:hello' && message.authenticated === true);
      const update = waitForMessage(socket, (message) => message.type === 'sync:update' && message.key === 'hris_karyawan');
      expect((await request('/api/sync/keys/hris_karyawan', 'PUT', developerToken, {
        value: [profile, otherProfile]
      })).status).toBe(200);
      expect((await update).value).toEqual([projectedProfile]);
    } finally {
      socket.terminate();
    }
  });

  it('menolak penghapusan, bulk, reset, dan media HRIS oleh peran yang tidak berwenang', async () => {
    expect((await request('/api/sync/keys/hris_karyawan', 'DELETE', payrollToken)).status).toBe(403);
    expect((await request('/api/sync/keys/hris_slip_gaji', 'DELETE', payrollToken)).status).toBe(403);
    expect((await request('/api/sync/keys/hris_slip_gaji', 'PUT', payrollToken, { value: [] })).status).toBe(403);
    expect((await request('/api/sync/batch', 'POST', payrollToken, {
      updates: { hris_slip_gaji: [] }
    })).status).toBe(403);
    expect((await request('/api/sync/keys/hris_slip_gaji', 'PUT', payrollToken, {
      value: [{ id: 'SLIP-1' }, { id: 'SLIP-1' }]
    })).status).toBe(403);
    expect((await request('/api/sync/keys/hris_slip_gaji', 'PUT', payrollToken, {
      value: [{ id: 'SLIP-1', karyawanId: 'EMP-01', jumlah: 101 }]
    })).status).toBe(200);
    expect((await request('/api/sync/purge-dummy', 'POST', pjtToken, {
      updates: { hris_karyawan: [] }
    })).status).toBe(403);
    expect((await request('/api/sync/purge-dummy', 'POST', pjtToken, {
      deletes: ['hris_karyawan']
    })).status).toBe(403);
    expect((await request('/api/sync/reset', 'POST', pjtToken, {})).status).toBe(403);
    const hrisState = await request<SyncState>(
      `/api/sync/state?known=${encodeURIComponent(JSON.stringify(['hris_karyawan']))}`,
      'GET',
      developerToken
    );
    expect((await request('/api/sync/purge-dummy', 'POST', developerToken, {
      updates: { hris_karyawan: [profile, otherProfile] },
      expectedVersions: { hris_karyawan: hrisState.body.versions.hris_karyawan }
    })).status).toBe(200);
    expect((await request('/api/media/upload', 'POST', developerToken, {
      id: 'sertifikat-uji',
      filename: 'sertifikat.png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      visibility: 'internal',
      scope: 'sertifikasi_pegawai'
    })).status).toBe(201);
    expect((await fetch(`${baseUrl}/api/website/media/sertifikat-uji`, {
      headers: { Authorization: `Bearer ${pjtToken}` }
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/website/media/sertifikat-uji`, {
      headers: { Authorization: `Bearer ${developerToken}` }
    })).status).toBe(200);
    const fullState = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect(fullState.body.entries.hris_karyawan.value).toEqual([profile, otherProfile]);
  });

  it('mencabut akses self-service ketika izin HRIS pada peran dihapus', async () => {
    const roles = await request<{ roles: RoleDefinition[] }>('/api/rbac/roles', 'GET', developerToken);
    const employeeRole = roles.body.roles.find((role) => role.id === 'karyawan');
    expect(employeeRole).toBeDefined();
    if (!employeeRole) throw new Error('Peran karyawan tidak ditemukan.');
    const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/sync/ws?token=${encodeURIComponent(employeeToken)}`);
    try {
      await waitForMessage(socket, (message) => message.type === 'sync:hello' && message.authenticated === true);
      const accessChanged = waitForMessage(socket, (message) => message.type === 'rbac:updated');
      expect((await request('/api/rbac/roles/karyawan', 'PUT', developerToken, {
        permissions: { ...employeeRole.permissions, 'hrd-pelatihan': [] }
      })).status).toBe(200);
      await accessChanged;
      const snapshot = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
      expect(snapshot.body.entries.hris_karyawan).toBeUndefined();
      expect(snapshot.body.entries.hris_cuti).toBeUndefined();
      expect(snapshot.body.allowedKeys).not.toContain('hris_cuti');
      expect(snapshot.body.writableKeys).not.toContain('hris_cuti');
      expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, { value: [] })).status).toBe(403);
    } finally {
      socket.terminate();
      expect((await request('/api/rbac/roles/karyawan', 'PUT', developerToken, {
        permissions: employeeRole.permissions
      })).status).toBe(200);
    }
  });

  it('membatasi ekspor arsip audit ke peran yang memiliki izin export', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const archiveUrl = `${baseUrl}/api/rbac/audit/archive/${month}`;
    const allowed = await fetch(archiveUrl, { headers: { Authorization: `Bearer ${developerToken}` } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('content-type')).toContain('application/x-ndjson');

    const denied = await fetch(archiveUrl, { headers: { Authorization: `Bearer ${employeeToken}` } });
    expect(denied.status).toBe(403);

    const invalidMonth = await fetch(`${baseUrl}/api/rbac/audit/archive/2026-99`, {
      headers: { Authorization: `Bearer ${developerToken}` }
    });
    expect(invalidMonth.status).toBe(400);
  });

  it('menonaktifkan self-service bila tautan akun atau master karyawan tidak unik', async () => {
    const snapshot = await request<{ users: Array<JsonRecord> }>('/api/firebase/rbac-snapshot', 'GET', developerToken);
    const pjt = snapshot.body.users.find((user) => user.username === 'pjt.test');
    expect(pjt).toBeDefined();
    expect((await request('/api/firebase/hydrate', 'POST', developerToken, {
      users: [{ ...pjt, employeeId: 'EMP-01', updatedAt: '2098-01-01T00:00:00.000Z' }]
    })).status).toBe(200);
    const duplicateLinkState = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
    expect(duplicateLinkState.body.entries.hris_cuti).toBeUndefined();
    expect(duplicateLinkState.body.allowedKeys).not.toContain('hris_cuti');
    expect(duplicateLinkState.body.writableKeys).not.toContain('hris_cuti');
    expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, { value: [] })).status).toBe(403);
    expect((await request('/api/firebase/hydrate', 'POST', developerToken, {
      users: [{ ...pjt, employeeId: '', updatedAt: '2099-01-01T00:00:00.000Z' }]
    })).status).toBe(200);
    const restoredLinkState = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
    expect(restoredLinkState.body.entries.hris_karyawan.value).toEqual([projectedProfile]);

    const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/sync/ws?token=${encodeURIComponent(employeeToken)}`);
    try {
      await waitForMessage(socket, (message) => message.type === 'sync:hello' && message.authenticated === true);
      const messages: JsonRecord[] = [];
      socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as JsonRecord));
      const marker = waitForMessage(socket, (message) => message.type === 'sync:update' && message.key === 'website_published');
      const accessChanged = waitForMessage(socket, (message) => message.type === 'rbac:updated');
      expect((await request('/api/sync/keys/hris_karyawan', 'PUT', developerToken, {
        value: [profile, { ...profile, nama: 'ID Duplikat' }]
      })).status).toBe(200);
      const website = bangunKontenDefault({
        izinEdar: [], sertifikat: [], pemasok: [], pelanggan: [], kampanye: [], teritorial: [],
        stok: [], pengetahuanProduk: [], skemaHarga: [], rebate: [], garansi: [], produkKatalog: []
      });
      expect((await request('/api/sync/keys/website_published', 'PUT', developerToken, { value: website })).status).toBe(200);
      await accessChanged;
      await marker;
      expect(messages.some((message) => message.type === 'sync:update' && message.key === 'hris_karyawan')).toBe(false);
      const invalidMasterState = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
      expect(invalidMasterState.body.entries.hris_cuti).toBeUndefined();
      expect(invalidMasterState.body.allowedKeys).not.toContain('hris_karyawan');
      expect((await request('/api/sync/keys/hris_cuti', 'PUT', employeeToken, { value: [] })).status).toBe(403);

      const accessRestored = waitForMessage(socket, (message) => message.type === 'rbac:updated');
      expect((await request('/api/sync/keys/hris_karyawan', 'PUT', developerToken, {
        value: [profile, otherProfile]
      })).status).toBe(200);
      await accessRestored;
      const recovered = await request<SyncState>('/api/sync/state', 'GET', employeeToken);
      expect(recovered.body.entries.hris_karyawan.value).toEqual([projectedProfile]);
    } finally {
      socket.terminate();
    }
  });

  it('mensyaratkan revisi global dan menolak reset basi tanpa menghapus perubahan baru', async () => {
    const before = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect((await request('/api/sync/reset', 'POST', developerToken, {})).status).toBe(428);
    expect((await request('/api/sync/reset', 'POST', developerToken, {
      expectedRevision: String(before.body.revision)
    })).status).toBe(400);

    expect((await request('/api/sync/keys/website_reset_conflict_probe', 'PUT', developerToken, {
      value: { retained: true }
    })).status).toBe(200);
    const staleReset = await request<JsonRecord>('/api/sync/reset', 'POST', developerToken, {
      expectedRevision: before.body.revision
    });
    expect(staleReset.status).toBe(409);
    expect(staleReset.body.error).toBe('SYNC_REVISION_CONFLICT');

    const unchanged = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect(unchanged.body.entries.website_reset_conflict_probe.value).toEqual({ retained: true });
    expect(unchanged.body.revision).toBeGreaterThan(before.body.revision);

    const reset = await request('/api/sync/reset', 'POST', developerToken, {
      expectedRevision: unchanged.body.revision
    });
    expect(reset.status).toBe(200);
    const afterReset = await request<SyncState>('/api/sync/state', 'GET', developerToken);
    expect(afterReset.body.entries.website_reset_conflict_probe).toBeUndefined();
  });
});
