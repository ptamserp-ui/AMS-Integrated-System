import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../server/postgres/migrations/003_sync_shadow.sql', import.meta.url), 'utf8');
const snapshotMigration = readFileSync(new URL('../../server/postgres/migrations/004_sync_snapshot.sql', import.meta.url), 'utf8');

describe('Prototipe sinkronisasi PostgreSQL terisolasi', () => {
  let db: PGlite;

  beforeEach(async () => { db = new PGlite(); await db.exec(migration); await db.exec(snapshotMigration); });
  afterEach(async () => { await db.close(); });

  const apply = (updates: unknown, deletes: unknown, versions: unknown, actor = 'operator') =>
    db.query<{ result: { revision: number; updated: number; deleted: number } }>(
      'SELECT ams_sync_shadow.apply_batch($1::jsonb, $2::jsonb, $3::jsonb, $4) AS result',
      [JSON.stringify(updates), JSON.stringify(deletes), JSON.stringify(versions), actor]
    );

  it('menyimpan beberapa koleksi dan data null JSON dengan satu revisi', async () => {
    const result = await apply({ sales_pelanggan: [{ id: 'TEST', extra: { n: 1 } }], other: null }, [], { sales_pelanggan: 0, other: 0 });
    expect(result.rows[0].result).toEqual({ revision: 1, updated: 2, deleted: 0 });
    const rows = await db.query<{ key: string; value: unknown; version: number }>(
      'SELECT key, value, version FROM ams_sync_shadow.entries ORDER BY key'
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].value).toBeNull();
    expect(rows.rows[1].value).toEqual([{ id: 'TEST', extra: { n: 1 } }]);
    expect(Number(rows.rows[1].version)).toBe(1);
  });

  it('menolak batch stale tanpa menyimpan koleksi lain', async () => {
    await apply({ a: [1] }, [], { a: 0 });
    await expect(apply({ a: [2], b: [3] }, [], { a: 0, b: 0 })).rejects.toThrow(/version conflict/i);
    const rows = await db.query<{ key: string; value: unknown }>('SELECT key, value FROM ams_sync_shadow.entries');
    expect(rows.rows).toEqual([{ key: 'a', value: [1] }]);
    expect((await db.query<{ revision: number }>('SELECT revision FROM ams_sync_shadow.state')).rows[0].revision).toBe(1);
  });

  it('mempertahankan versi tombstone dan menolak pembuatan ulang dengan versi lama', async () => {
    await apply({ a: [1] }, [], { a: 0 });
    expect((await apply({}, ['a'], { a: 1 })).rows[0].result).toEqual({ revision: 2, updated: 0, deleted: 1 });
    await expect(apply({ a: [2] }, [], { a: 0 })).rejects.toThrow(/version conflict/i);
    expect((await apply({ a: [2] }, [], { a: 2 })).rows[0].result.revision).toBe(3);
    const row = (await db.query<{ version: number; value: unknown }>('SELECT version, value FROM ams_sync_shadow.entries')).rows[0];
    expect(Number(row.version)).toBe(3);
    expect(row.value).toEqual([2]);
  });

  it('menolak batch tidak valid dan mempertahankan revisi tanpa mutasi', async () => {
    await expect(apply({ a: [] }, ['a'], { a: 0 })).rejects.toThrow();
    await expect(apply({ rb_akun: [] }, [], { rb_akun: 0 })).rejects.toThrow();
    await expect(apply({ a: [] }, [], {})).rejects.toThrow();
    await expect(apply({ a: [] }, [], { a: 0, b: 0 })).rejects.toThrow();
    expect((await apply({}, ['missing'], { missing: 0 })).rows[0].result).toEqual({ revision: 0, updated: 0, deleted: 0 });
    expect((await db.query('SELECT key FROM ams_sync_shadow.entries')).rows).toHaveLength(0);
  });

  it('membatalkan mutasi yang melampaui batas aman versi atau revisi', async () => {
    await apply({ a: [1] }, [], { a: 0 });
    await db.query('UPDATE ams_sync_shadow.entries SET version = 9007199254740991 WHERE key = $1', ['a']);
    await expect(apply({ a: [2] }, [], { a: Number.MAX_SAFE_INTEGER })).rejects.toThrow(/safe integer/);
    await db.query('UPDATE ams_sync_shadow.state SET revision = 9007199254740991');
    await expect(apply({ b: [2] }, [], { b: 0 })).rejects.toThrow(/safe integer/);
    expect((await db.query<{ key: string; value: unknown }>('SELECT key, value FROM ams_sync_shadow.entries')).rows)
      .toEqual([{ key: 'a', value: [1] }]);
  });

  it('mengimpor snapshot lengkap sekali, mempertahankan versi dan tombstone, serta menolak replay setelah perubahan', async () => {
    const snapshot = {
      revision: 12,
      entries: { customer: { value: [{ id: 'TEST', extra: { preserved: true } }], version: 3, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'operator' } },
      keyVersions: { customer: 3, deleted_key: 5 }
    };
    const run = () => db.query<{ result: { replayed: boolean; revision: number } }>(
      'SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2) AS result', [JSON.stringify(snapshot), 'migration-test']
    );
    expect((await run()).rows[0].result).toMatchObject({ replayed: false, revision: 12 });
    expect((await run()).rows[0].result).toMatchObject({ replayed: true, revision: 12 });
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [
      JSON.stringify({ ...snapshot, entries: {} }), 'migration-test'
    ])).rejects.toThrow(/Snapshot differs/);
    const rows = await db.query<{ key: string; version: number; deleted: boolean; value: unknown }>(
      'SELECT key, version, deleted, value FROM ams_sync_shadow.entries ORDER BY key'
    );
    expect(rows.rows.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([
      { key: 'customer', version: 3, deleted: false, value: snapshot.entries.customer.value },
      { key: 'deleted_key', version: 5, deleted: true, value: null }
    ]);
    await expect(apply({ deleted_key: [] }, [], { deleted_key: 0 })).rejects.toThrow(/version conflict/i);
    await apply({ customer: [] }, [], { customer: 3 });
    await expect(run()).rejects.toThrow(/shadow has changed/);
  });

  it('menolak snapshot tidak valid secara atomik tanpa menginisialisasi target', async () => {
    const snapshot = {
      revision: 1,
      entries: {
        a: { value: [], version: 1, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'operator' },
        b: { value: [], version: 2, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'operator' }
      },
      keyVersions: { a: 1, b: 3 }
    };
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [JSON.stringify(snapshot), 'operator']))
      .rejects.toThrow(/versions differ/);
    expect((await db.query('SELECT key FROM ams_sync_shadow.entries')).rows).toHaveLength(0);
    expect((await db.query('SELECT singleton FROM ams_sync_shadow.snapshot_import')).rows).toHaveLength(0);
    expect(Number((await db.query<{ revision: number }>('SELECT revision FROM ams_sync_shadow.state')).rows[0].revision)).toBe(0);
  });

  it('menolak peta versi yang kehilangan entry, tetapi menerima snapshot legacy tanpa peta versi', async () => {
    const snapshot = {
      revision: 1,
      entries: { a: { value: [], version: 1, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'operator' } }
    };
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [
      JSON.stringify({ ...snapshot, keyVersions: {} }), 'operator'
    ])).rejects.toThrow(/key version is missing/);
    expect((await db.query('SELECT key FROM ams_sync_shadow.entries')).rows).toHaveLength(0);
    expect((await db.query<{ result: { revision: number } }>('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2) AS result', [
      JSON.stringify(snapshot), 'operator'
    ])).rows[0].result.revision).toBe(1);
  });

  it('menolak tombstone versi nol dan state target yang hilang', async () => {
    const snapshot = { revision: 0, entries: {}, keyVersions: { old_key: 0 } };
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [JSON.stringify(snapshot), 'operator']))
      .rejects.toThrow(/Zero-version tombstone/);
    expect((await db.query('SELECT singleton FROM ams_sync_shadow.snapshot_import')).rows).toHaveLength(0);
    await db.exec('DELETE FROM ams_sync_shadow.state');
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [JSON.stringify(snapshot), 'operator']))
      .rejects.toThrow(/state is missing/);
    await expect(apply({ test: [] }, [], { test: 0 })).rejects.toThrow(/state is missing/);
  });

  it('tidak menimpa target yang sudah berisi data', async () => {
    await apply({ existing: [1] }, [], { existing: 0 });
    await expect(db.query('SELECT ams_sync_shadow.import_snapshot($1::jsonb, $2)', [
      JSON.stringify({ revision: 0, entries: {}, keyVersions: {} }), 'operator'
    ])).rejects.toThrow(/not empty/);
    expect((await db.query('SELECT key, value FROM ams_sync_shadow.entries')).rows).toEqual([{ key: 'existing', value: [1] }]);
  });

  it('reset memeriksa revisi dan mempertahankan tombstone sebagai versi konflik', async () => {
    await apply({ a: [1], b: [2] }, [], { a: 0, b: 0 });
    await apply({}, ['b'], { b: 1 });
    await expect(db.query('SELECT ams_sync_shadow.reset_all($1, $2)', [1, 'operator']))
      .rejects.toThrow(/revision conflict/);
    const reset = await db.query<{ result: unknown }>('SELECT ams_sync_shadow.reset_all($1, $2) AS result', [2, 'operator']);
    expect(reset.rows[0].result).toEqual({ revision: 3, deletedVersions: { a: 2 } });
    const rows = await db.query<{ key: string; version: number; deleted: boolean }>(
      'SELECT key, version, deleted FROM ams_sync_shadow.entries ORDER BY key'
    );
    expect(rows.rows.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([
      { key: 'a', version: 2, deleted: true },
      { key: 'b', version: 2, deleted: true }
    ]);
    await expect(apply({ a: [3] }, [], { a: 1 })).rejects.toThrow(/version conflict/);
    expect((await db.query<{ result: unknown }>('SELECT ams_sync_shadow.reset_all($1, $2) AS result', [3, 'operator'])).rows[0].result)
      .toEqual({ revision: 4, deletedVersions: {} });
  });

  it('reset menolak overflow tanpa mengubah data', async () => {
    await apply({ a: [1], b: [2] }, [], { a: 0, b: 0 });
    await db.query('UPDATE ams_sync_shadow.entries SET version = 9007199254740991 WHERE key = $1', ['b']);
    await expect(db.query('SELECT ams_sync_shadow.reset_all($1, $2)', [1, 'operator'])).rejects.toThrow(/safe integer/);
    expect((await db.query('SELECT key, value FROM ams_sync_shadow.entries ORDER BY key')).rows).toEqual([
      { key: 'a', value: [1] }, { key: 'b', value: [2] }
    ]);
    expect(Number((await db.query<{ revision: number }>('SELECT revision FROM ams_sync_shadow.state')).rows[0].revision)).toBe(1);
  });
});
