import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CustomerDatabaseModule from '../../src/components/modules/commercial/sales/CustomerDatabaseModule';
import { INITIAL_PELANGGAN_B2B } from '../../src/data/initialData';
import { AMSDatabaseManager } from '../../src/services/pocketbase';
import { detailCustomerBerubah, detailCustomerDatabase, rapikanDetailCustomer, validasiDetailCustomer } from '../../src/utils/customerDatabase';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failKey: string | null = null;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('storage full');
    this.values.set(key, String(value));
  }
}

describe('Customer Database', () => {
  let storage: MemoryStorage;
  let manager: AMSDatabaseManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    manager = new AMSDatabaseManager();
    storage.setItem('ams_alkes_sales_pelanggan', JSON.stringify([{
      ...INITIAL_PELANGGAN_B2B[0], id: 'TEST-1', kodePelanggan: 'TEST-1', namaInstalasi: 'Customer Uji',
      emailPortal: 'portal@example.test', alamat1: 'Alamat Uji', alamat2: 'Gedung Uji', afiliasiKeterangan: 'Afiliasi Uji'
    }]));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('menampilkan enam kolom master pelanggan dan alamat gabungan', () => {
    const html = renderToStaticMarkup(createElement(CustomerDatabaseModule, { bolehUbah: false, aktor: 'Uji' }));
    expect(html).toContain('Customer Uji');
    expect(html).toContain('Master Data Pelanggan');
    expect(html).toContain('Nama / Instansi');
    expect(html).toContain('Alamat Uji, Gedung Uji, DKI Jakarta');
    expect(html).toContain('Email');
    expect(html).toContain('No. Telp');
    expect(html).toContain('Afiliasi / Keterangan');
    expect(html).toContain('Afiliasi Uji');
    expect(html).toContain('>Customer Uji</button>');
    expect((html.match(/<th /g) || [])).toHaveLength(6);
  });

  it('menyimpan kontak tanpa mengubah atribut kredit atau email portal', () => {
    const sebelum = manager.getPelangganB2B()[0];
    manager.updatePelangganB2B('TEST-1', {
      alamat1: 'Alamat uji', emailCustomer: 'kontak@example.test', nomorWhatsapp: '+62 812-3456-7890',
      afiliasiKeterangan: 'Afiliasi baru'
    }, { aktor: 'Pengguna Uji', throwOnFailure: true });
    const sesudah = manager.getPelangganB2B()[0];
    expect(sesudah).toMatchObject({
      alamat1: 'Alamat uji', emailCustomer: 'kontak@example.test', nomorWhatsapp: '+62 812-3456-7890',
      afiliasiKeterangan: 'Afiliasi baru',
      batasKredit: sebelum.batasKredit, emailPortal: sebelum.emailPortal
    });
  });

  it('melaporkan kegagalan penyimpanan dan menolak data lokal rusak tanpa menimpanya', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.failKey = 'ams_alkes_sales_pelanggan';
    expect(() => manager.updatePelangganB2B('TEST-1', { emailCustomer: 'uji@example.test' }, { aktor: 'Uji', throwOnFailure: true })).toThrow('storage full');
    storage.failKey = null;
    storage.setItem('ams_alkes_sales_pelanggan', 'invalid');
    expect(() => manager.updatePelangganB2B('TEST-1', { emailCustomer: 'uji@example.test' }, { aktor: 'Uji', throwOnFailure: true })).toThrow();
    expect(storage.getItem('ams_alkes_sales_pelanggan')).toBe('invalid');
  });

  it('memvalidasi kontak, menjaga nomor sebagai teks dan mendeteksi perubahan paralel', () => {
    const awal = detailCustomerDatabase(manager.getPelangganB2B()[0]);
    const draf = { ...awal, emailCustomer: ' kontak@example.test ', nomorWhatsapp: ' 0812-3456-7890 ' };
    expect(validasiDetailCustomer(draf)).toBeNull();
    expect(rapikanDetailCustomer(draf).nomorWhatsapp).toBe('0812-3456-7890');
    expect(validasiDetailCustomer({ ...awal, emailCustomer: 'invalid' })).toMatch(/email/i);
    expect(validasiDetailCustomer({ ...awal, nomorWhatsapp: '12abc' })).toMatch(/WhatsApp/);
    expect(detailCustomerBerubah(awal, { ...awal, alamat1: 'Alamat baru' })).toBe(true);
    expect(detailCustomerBerubah(awal, { ...awal, afiliasiKeterangan: 'Afiliasi lain' })).toBe(true);
    expect(detailCustomerBerubah(awal, { ...awal })).toBe(false);
  });
});
