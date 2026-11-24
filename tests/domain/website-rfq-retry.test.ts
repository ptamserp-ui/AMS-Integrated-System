import { afterEach, describe, expect, it, vi } from 'vitest';
import { siapkanPermintaanRfq, validasiBatasProdukRfq } from '../../src/utils/websiteRfq';
import { buatProspekWebsite } from '../../server/websiteRfq';

const produkUji = { nama: 'Produk Uji', tipeModel: '', produsen: '', satuan: 'Unit', jumlah: 1 };
const formulirUji = {
  requestId: 'aa115a5a-8a88-4a55-9a77-012345678901',
  namaInstansi: 'Klinik Sintetis',
  tipeInstansi: 'Klinik',
  namaPemohon: '',
  kontakPemohon: 'uji@example.invalid',
  jalurPengadaan: 'Permintaan Penawaran Reguler (RFQ)',
  subjek: '',
  pesan: ''
};

describe('batas permintaan RFQ', () => {
  it('menerima batas produk dan memberi petunjuk sebelum mengirim daftar yang terlalu panjang', () => {
    const maksimal = Array.from({ length: 30 }, () => produkUji);
    expect(validasiBatasProdukRfq(maksimal)).toBeNull();
    expect(buatProspekWebsite({ ...formulirUji, produk: maksimal }).ok).toBe(true);

    const terlaluBanyak = [...maksimal, produkUji];
    expect(validasiBatasProdukRfq(terlaluBanyak)).toMatch(/maksimal 30 produk/i);
    expect(buatProspekWebsite({ ...formulirUji, produk: terlaluBanyak }).ok).toBe(false);
  });

  it.each([0, -1, 1.5, 1_000_001, Number.NaN])('menolak jumlah tidak valid %s di klien dan server', (jumlah) => {
    const produk = [{ ...produkUji, jumlah }];
    expect(validasiBatasProdukRfq(produk)).toMatch(/bilangan bulat/i);
    expect(buatProspekWebsite({ ...formulirUji, produk }).ok).toBe(false);
  });

  it('menerima jumlah minimum dan maksimum yang dapat disimpan server', () => {
    const produk = [{ ...produkUji, jumlah: 1 }, { ...produkUji, jumlah: 1_000_000 }];
    expect(validasiBatasProdukRfq(produk)).toBeNull();
    expect(buatProspekWebsite({ ...formulirUji, produk }).ok).toBe(true);
  });
});

describe('identitas pengulangan RFQ', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('menggunakan ID yang sama setelah muat ulang tanpa menyimpan isi formulir', async () => {
    const data = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value)
    });
    const isi = JSON.stringify({ instansi: 'Klinik Sintetis', kontak: 'uji@example.invalid' });
    const awal = await siapkanPermintaanRfq(isi, null);
    const setelahMuatUlang = await siapkanPermintaanRfq(isi, null);
    const berubah = await siapkanPermintaanRfq(`${isi} baru`, setelahMuatUlang);

    expect(setelahMuatUlang.id).toBe(awal.id);
    expect(setelahMuatUlang.tersimpanDiSesi).toBe(true);
    expect(berubah.id).not.toBe(awal.id);
    expect([...data.values()].join('')).not.toContain('uji@example.invalid');
  });

  it('mempertahankan ID dalam memori dan menandai keterbatasan saat penyimpanan sesi gagal', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('storage blocked'); }
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const awal = await siapkanPermintaanRfq('isi sintetis', null);
    const ulang = await siapkanPermintaanRfq('isi sintetis', awal);

    expect(awal.tersimpanDiSesi).toBe(false);
    expect(ulang.id).toBe(awal.id);
  });
});
