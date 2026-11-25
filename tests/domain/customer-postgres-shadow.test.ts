import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../server/postgres/migrations/001_customer_shadow.sql', import.meta.url), 'utf8');
const emptyBaselineMigration = readFileSync(new URL('../../server/postgres/migrations/002_customer_empty_baseline.sql', import.meta.url), 'utf8');

describe('Skema shadow PostgreSQL customer', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(migration);
    await db.exec(emptyBaselineMigration);
  });
  afterEach(async () => { await db.close(); });

  it('menyimpan ID dan record sumber lengkap tanpa mengubah properti tambahan', async () => {
    const record = {
      id: 'TEST-001', kodePelanggan: '  C-001 ', namaInstalasi: 'Customer Uji',
      alamatPengiriman: [{ alamat1: 'Alamat Uji', catatan: 'Pertahankan' }],
      piutangBerjalan: 100, emailPortal: 'portal@example.test', fieldLama: { nilai: 'ada' }
    };
    await db.query('INSERT INTO ams_customer_shadow.customers (source_record, source_version) VALUES ($1::jsonb, $2)', [JSON.stringify(record), 4]);
    const result = await db.query<{ id: string; customer_code: string; source_record: unknown; source_version: string }>(
      'SELECT id, customer_code, source_record, source_version FROM ams_customer_shadow.customers'
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: 'TEST-001', customer_code: '  C-001 ', source_record: record });
    expect(Number(result.rows[0].source_version)).toBe(4);
  });

  it('menolak identitas tidak lengkap atau bertipe salah dan kode duplikat tanpa membedakan kapital/spasi', async () => {
    const insert = (record: unknown) => db.query(
      'INSERT INTO ams_customer_shadow.customers (source_record, source_version) VALUES ($1::jsonb, 1)',
      [JSON.stringify(record)]
    );
    await insert({ id: 'A', kodePelanggan: ' Ab-01 ', namaInstalasi: 'Nama' });
    await expect(insert({ id: 'B', kodePelanggan: 'ab-01', namaInstalasi: 'Nama lain' })).rejects.toThrow();
    await expect(insert({ id: 'C', kodePelanggan: 123, namaInstalasi: 'Nama' })).rejects.toThrow();
    await expect(insert({ id: 'D', kodePelanggan: 'kode', namaInstalasi: ' ' })).rejects.toThrow();
    await expect(insert({ id: 'E', kodePelanggan: '\t', namaInstalasi: 'Nama' })).rejects.toThrow();
    expect((await db.query('SELECT id FROM ams_customer_shadow.customers')).rows).toHaveLength(1);
  });

  it('membatalkan seluruh batch ketika salah satu record bertentangan', async () => {
    await expect(db.transaction(async (tx) => {
      for (const id of ['A', 'B']) {
        await tx.query('INSERT INTO ams_customer_shadow.customers (source_record, source_version) VALUES ($1::jsonb, 1)', [
          JSON.stringify({ id, kodePelanggan: 'DUP', namaInstalasi: 'Customer' })
        ]);
      }
    })).rejects.toThrow();
    expect((await db.query('SELECT id FROM ams_customer_shadow.customers')).rows).toHaveLength(0);
  });

  it('mengimpor ulang batch identik tanpa menggandakan atau menimpa data yang berbeda', async () => {
    const batch = [
      { id: 'A', kodePelanggan: 'A-01', namaInstalasi: 'Customer A', keteranganLama: 'utuh' },
      { id: 'B', kodePelanggan: 'B-01', namaInstalasi: 'Customer B' }
    ];
    const importBatch = (records: unknown, version: number) => db.query<{ inserted: number }>(
      'SELECT ams_customer_shadow.import_batch($1::jsonb, $2) AS inserted', [JSON.stringify(records), version]
    );
    expect((await importBatch(batch, 7)).rows[0].inserted).toBe(2);
    expect((await importBatch(batch, 7)).rows[0].inserted).toBe(0);
    await expect(importBatch([{ ...batch[0], namaInstalasi: 'Berubah' }, { id: 'C', kodePelanggan: 'C', namaInstalasi: 'Baru' }], 7)).rejects.toThrow(/conflicts/);
    await expect(importBatch(batch, 8)).rejects.toThrow(/conflicts/);
    const result = await db.query<{ source_record: unknown }>('SELECT source_record FROM ams_customer_shadow.customers ORDER BY id');
    expect(result.rows.map((row) => row.source_record)).toEqual(batch);
  });

  it('menolak batch duplikat, batas batch, dan versi sumber yang tidak sah', async () => {
    const record = { id: 'A', kodePelanggan: 'A', namaInstalasi: 'Customer' };
    const importBatch = (records: unknown, version: number | null) => db.query(
      'SELECT ams_customer_shadow.import_batch($1::jsonb, $2)', [JSON.stringify(records), version]
    );
    await expect(importBatch([record, record], 1)).rejects.toThrow(/Duplicate/);
    await expect(importBatch(Array(10001).fill(record), 1)).rejects.toThrow(/10000/);
    await expect(importBatch([record], null)).rejects.toThrow(/Invalid/);
    expect((await db.query('SELECT id FROM ams_customer_shadow.customers')).rows).toHaveLength(0);
  });

  it('mencatat baseline kosong sekali dan menolak baseline pada tabel yang sudah berisi data', async () => {
    await expect(db.query('SELECT ams_customer_shadow.initialize_empty_baseline($1)', [' '])).rejects.toThrow(/Actor/);
    const first = await db.query<{ created: boolean }>('SELECT ams_customer_shadow.initialize_empty_baseline($1) AS created', ['operator']);
    const retry = await db.query<{ created: boolean }>('SELECT ams_customer_shadow.initialize_empty_baseline($1) AS created', ['operator-lain']);
    expect(first.rows[0].created).toBe(true);
    expect(retry.rows[0].created).toBe(false);
    const marker = await db.query<{ initialized_by: string; source_version: string; source_present: boolean }>(
      'SELECT initialized_by, source_version, source_present FROM ams_customer_shadow.empty_baseline'
    );
    expect(marker.rows).toHaveLength(1);
    expect(marker.rows[0]).toMatchObject({ initialized_by: 'operator', source_present: false });
    expect(Number(marker.rows[0].source_version)).toBe(0);
    await db.query('INSERT INTO ams_customer_shadow.customers (source_record, source_version) VALUES ($1::jsonb, 1)', [
      JSON.stringify({ id: 'A', kodePelanggan: 'A', namaInstalasi: 'Customer' })
    ]);
    await expect(db.query('SELECT ams_customer_shadow.initialize_empty_baseline($1)', ['operator'])).rejects.toThrow(/not empty/);
  });
});
