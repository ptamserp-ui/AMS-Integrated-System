import fs from 'fs';
import os from 'os';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DaftarKodeAkunTab from '../../src/components/modules/supporting/finance/DaftarKodeAkunTab';
import { INITIAL_REFERENSI_KODE_AKUN } from '../../src/data/referensiKodeAkun';
import { AMSDatabaseManager } from '../../src/services/pocketbase';
import { ServerDataSyncStore, canReadSyncKey, canWriteSyncKey, SyncVersionConflictError } from '../../server/dataSyncStore';
import type { RoleDefinition } from '../../src/types';

const key = 'keuangan_referensi_akun';
const storageKey = `ams_alkes_${key}`;
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  fail = false;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(name: string) { return this.data.get(name) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(name: string) { this.data.delete(name); }
  setItem(name: string, value: string) {
    if (this.fail && name === storageKey) throw new Error('storage full');
    this.data.set(name, value);
  }
}

describe('Daftar Kode Akun referensi', () => {
  let storage: MemoryStorage;
  let manager: AMSDatabaseManager;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    manager = new AMSDatabaseManager();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('memuat 180 akun sumber, pedoman lengkap dan mode baca tanpa tombol tambah/edit', () => {
    expect(INITIAL_REFERENSI_KODE_AKUN).toHaveLength(180);
    expect(new Set(INITIAL_REFERENSI_KODE_AKUN.map((item) => item.kode)).size).toBe(180);
    const html = renderToStaticMarkup(createElement(DaftarKodeAkunTab, { bolehUbah: false, aktor: 'Uji' }));
    expect(html).toContain('Kendaraan');
    expect(html).toContain('Contoh pola penomoran sub-akun');
    expect(html).toContain('Disclaimer sumber');
    expect(html).not.toContain('>Tambah Kode Akun</button>');
    expect(html).not.toContain('>Ubah</button>');
    expect(renderToStaticMarkup(createElement(DaftarKodeAkunTab, { bolehUbah: true, aktor: 'Uji' }))).toContain('Tambah Kode Akun');
  });

  it('menambah sub-akun dan mengubah kode dengan ID stabil, bertahan setelah reload tanpa mutasi CoA', () => {
    storage.setItem('ams_alkes_keuangan_coa', '[{"id":"aktif"}]');
    const item = { id: 'uji', kode: '1003.01', nama: 'Bank Contoh', kelompok: '1. Aset' };
    manager.simpanReferensiKodeAkun(item, null, 'Uji');
    manager.simpanReferensiKodeAkun({ ...item, kode: '1003.02', nama: 'Bank Baru' }, item, 'Uji');
    const reloaded = new AMSDatabaseManager().getReferensiKodeAkun();
    expect(reloaded).toHaveLength(181);
    expect(reloaded.find((akun) => akun.id === item.id)).toMatchObject({ kode: '1003.02', nama: 'Bank Baru' });
    expect(storage.getItem('ams_alkes_keuangan_coa')).toBe('[{"id":"aktif"}]');
  });

  it('menolak kode duplikat/invalid, nama kosong dan konflik draf tanpa menimpa data', () => {
    const awal = manager.getReferensiKodeAkun()[0];
    manager.simpanReferensiKodeAkun({ ...awal, nama: 'Revisi' }, awal, 'Uji');
    const before = storage.getItem(storageKey);
    expect(() => manager.simpanReferensiKodeAkun({ ...awal, nama: 'Draf lama' }, awal, 'Uji')).toThrow('berubah');
    for (const draf of [
      { id: 'baru', kode: awal.kode, nama: 'Duplikat', kelompok: 'Aset' },
      { id: 'baru', kode: 'abc', nama: 'Invalid', kelompok: 'Aset' },
      { id: 'baru', kode: '1003.01', nama: ' ', kelompok: 'Aset' }
    ]) expect(() => manager.simpanReferensiKodeAkun(draf, null, 'Uji')).toThrow();
    expect(storage.getItem(storageKey)).toBe(before);
  });

  it('menampilkan kegagalan storage/data rusak secara eksplisit, tidak mengganti dengan seed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.fail = true;
    const item = manager.getReferensiKodeAkun()[0];
    expect(() => manager.simpanReferensiKodeAkun({ ...item, nama: 'Revisi' }, item, 'Uji')).toThrow('storage full');
    storage.fail = false;
    storage.setItem(storageKey, '{invalid');
    expect(() => manager.getReferensiKodeAkun()).toThrow();
  });

  it('server membatasi update Finance, menyimpan seluruh daftar setelah restart dan menolak versi usang', () => {
    const role: RoleDefinition = { id: 'uji', name: 'Uji', description: '', isSystem: false, updatedAt: '',
      permissions: { 'finance-akuntansi': ['view'] } };
    expect(canReadSyncKey(role, key)).toBe(true);
    expect(canWriteSyncKey(role, key)).toBe(false);
    role.permissions['finance-akuntansi'] = ['view', 'create'];
    expect(canWriteSyncKey(role, key)).toBe(false);
    role.permissions['finance-akuntansi'] = ['view', 'update'];
    expect(canWriteSyncKey(role, key)).toBe(true);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-reference-test-'));
    try {
      const server = new ServerDataSyncStore(dir);
      const item = manager.getReferensiKodeAkun()[0];
      manager.simpanReferensiKodeAkun({ ...item, nama: 'Edit di perangkat' }, item, 'Uji');
      const value = manager.getReferensiKodeAkun();
      server.setKey(key, value, 'Uji', 0);
      const restarted = new ServerDataSyncStore(dir);
      expect(restarted.getEntry(key)?.value).toEqual(value);
      expect(() => restarted.setKey(key, [], 'Editor usang', 0)).toThrow(SyncVersionConflictError);
      expect(restarted.getEntry(key)?.value).toEqual(value);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
