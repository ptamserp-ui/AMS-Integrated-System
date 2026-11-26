import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/services/pocketbase';
import type { PenjualanAlkes, PromosiFOC, StokGudang, ValuasiBatch } from '../../src/types';
import { INITIAL_IZIN_EDAR, INITIAL_LOKASI_BIN, INITIAL_STOK_GUDANG } from '../../src/data/initialData';
import { KODE_AKUN, rancangJurnalPromosiFOC } from '../../src/utils/akuntansi';
import { hitungKelayakanPromosiFOC, validasiPromosiFOC } from '../../src/utils/promosiFoc';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const promosiDasar = (): PromosiFOC => ({
  id: 'FOC-UJI',
  nama: 'Promo Uji',
  aktif: true,
  skuPemicu: 'SKU-A',
  minimumPembelian: 2,
  maksimumKitPerPesanan: 2,
  berlakuMulai: '2026-01-01',
  berlakuSampai: '2026-12-31',
  jalurPenjualan: ['Klinik & Laboratorium'],
  pelangganIds: ['PLG-UJI'],
  paket: [{
    id: 'KIT-UJI',
    nama: 'Paket Complimentary',
    komponen: [{ kodeSKU: 'SKU-B', namaAlkes: 'Produk B', qtyPerKit: 2, satuan: 'Unit' }]
  }]
});

const valuasiDasar = (asal: ValuasiBatch['asal'] = 'ASLI'): ValuasiBatch => ({
  nomorBatch: 'LOT-B',
  kodeSKU: 'SKU-B',
  namaAlkes: 'Produk B',
  tanggalProduksi: '2026-01-01',
  tanggalKedaluwarsa: '2030-01-01',
  qtyTercatat: 10,
  satuan: 'Unit',
  nilaiPerUnit: 1250,
  metode: 'FIFO',
  sumberBiaya: 'Purchase Order',
  rujukanSumber: 'PO-UJI',
  asal,
  tercatatPada: '2026-01-01'
});

const storageAwal = globalThis.localStorage;
afterEach(() => {
  if (storageAwal === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
  else Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storageAwal });
});

describe('aturan promosi FOC', () => {
  it('membatasi jumlah kit berdasarkan ambang, maksimum, kanal, pelanggan, dan periode', () => {
    const promosi = promosiDasar();
    const pesanan: Pick<PenjualanAlkes, 'kodeSKU' | 'jumlah' | 'jalurPenjualan' | 'pelangganId' | 'tanggalPesanan'> = {
      kodeSKU: 'SKU-A',
      jumlah: 5,
      jalurPenjualan: 'Klinik & Laboratorium',
      pelangganId: 'PLG-UJI',
      tanggalPesanan: '2026-06-15'
    };

    expect(validasiPromosiFOC(promosi)).toEqual([]);
    expect(hitungKelayakanPromosiFOC(promosi, pesanan)).toEqual({ memenuhi: true, jumlahKit: 2, alasan: [] });
    expect(hitungKelayakanPromosiFOC(promosi, { ...pesanan, pelangganId: 'PLG-LAIN' }).memenuhi).toBe(false);
    expect(hitungKelayakanPromosiFOC(promosi, { ...pesanan, tanggalPesanan: '2027-01-01' }).memenuhi).toBe(false);
  });

  it('menolak kit dengan kuantitas nol dan SKU komponen duplikat', () => {
    const promosi = promosiDasar();
    promosi.paket[0]!.komponen.push({ ...promosi.paket[0]!.komponen[0]!, qtyPerKit: 0 });

    expect(validasiPromosiFOC(promosi).some((item) => item.includes('bilangan bulat positif'))).toBe(true);
    expect(validasiPromosiFOC(promosi).some((item) => item.includes('terdaftar lebih dari sekali'))).toBe(true);
  });
});

describe('rancangJurnalPromosiFOC', () => {
  it('mengakui biaya batch ASLI ke beban promosi dan mengkredit persediaan per batch', () => {
    const hasil = rancangJurnalPromosiFOC({
      nomorSuratJalan: 'SJ-UJI-01',
      tanggal: '2026-06-15',
      fasyankesTujuan: 'Klinik Uji',
      alokasi: [{ kodeSKU: 'SKU-B', namaAlkes: 'Produk B', nomorBatch: 'LOT-B', qty: 2 }],
      daftarValuasi: [valuasiDasar()],
      petugas: 'Tester',
      peran: 'Finance',
      nomorJournal: 'JV-202606-0001'
    });

    expect(hasil.penolakan).toEqual([]);
    expect(hasil.totalBiaya).toBe(2500);
    expect(hasil.rancangan?.sumberRujukan).toBe('PROMOSI_FOC');
    expect(hasil.rancangan?.baris).toEqual([
      expect.objectContaining({ akunKode: KODE_AKUN.BEBAN_PROMOSI_FOC, debit: 2500, kredit: 0 }),
      expect.objectContaining({ akunKode: KODE_AKUN.PERSEDIAAN_ALKES, debit: 0, kredit: 2500, nomorBatch: 'LOT-B' })
    ]);
  });

  it('menolak seluruh jurnal bila salah satu batch belum memiliki valuasi ASLI', () => {
    const hasil = rancangJurnalPromosiFOC({
      nomorSuratJalan: 'SJ-UJI-02',
      tanggal: '2026-06-15',
      fasyankesTujuan: 'Klinik Uji',
      alokasi: [{ kodeSKU: 'SKU-B', namaAlkes: 'Produk B', nomorBatch: 'LOT-B', qty: 2 }],
      daftarValuasi: [valuasiDasar('DUMMY')],
      petugas: 'Tester',
      peran: 'Finance',
      nomorJournal: 'JV-202606-0002'
    });

    expect(hasil.rancangan).toBeNull();
    expect(hasil.penolakan[0]).toContain('hanya valuasi ASLI');
  });
});

describe('pengiriman FOC', () => {
  it('menolak secara atomik jika stok komponen tidak lengkap', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: new MemoryStorage() });
    const base = INITIAL_STOK_GUDANG[0];
    const bin = INITIAL_LOKASI_BIN.find((item) => item.id === base?.binId);
    if (!base || !bin) throw new Error('fixture lokasi stok tidak tersedia');
    const stok: StokGudang[] = [{
      ...base,
      id: 'STK-MAIN-UJI',
      kodeSKU: 'SKU-A',
      namaAlkes: 'Produk A',
      nomorIzinEdar: 'NIE-UJI',
      nomorBatch: 'LOT-A',
      jumlahStok: 3,
      qtyDipesan: 0,
      tanggalKedaluwarsa: '2030-01-01',
      statusStok: 'AVAILABLE',
      binId: bin.id,
      gudangId: bin.gudangId
    }];
    const pesanan: PenjualanAlkes = {
      id: 'SO-FOC-UJI',
      nomorPesanan: 'SP-KLINIK-2026-901',
      fasyankes: 'Klinik Uji',
      jalurPenjualan: 'Klinik & Laboratorium',
      namaAlkes: 'Produk A',
      kodeSKU: 'SKU-A',
      nomorBatch: 'LOT-A',
      jumlah: 1,
      satuan: 'Unit',
      totalHarga: 10000,
      statusVerifikasiEtikaIklan: 'Memenuhi Etika Promosi',
      statusKirim: 'Menunggu Alokasi FEFO',
      tanggalPesanan: '2026-06-15',
      promosiFoc: {
        promosiId: 'FOC-UJI',
        namaPromosi: 'Promo Uji',
        paketId: 'KIT-UJI',
        namaPaket: 'Paket Complimentary',
        jumlahKit: 1,
        komponen: [{ kodeSKU: 'SKU-B', namaAlkes: 'Produk B', qtyPerKit: 2, satuan: 'Unit' }]
      }
    };

    db.saveStokGudang(stok);
    db.saveIzinEdar([{ ...INITIAL_IZIN_EDAR[0]!, id: 'NIE-UJI', namaAlkes: 'Produk A', nomorIzinEdar: 'NIE-UJI', skuCode: 'SKU-A', tanggalKedaluwarsa: '2030-01-01', status: 'Aktif' }]);
    db.saveSuratJalan([]);
    db.saveTransaksi([]);
    db.savePenjualan([pesanan]);
    const hasil = db.catatPengirimanSalesOrder(pesanan.id, new Date('2026-06-15T12:00:00'));

    expect(hasil.boleh).toBe(false);
    expect(hasil.keterangan.toLowerCase()).toContain('komponen foc');
    expect(db.getStokGudang().find((item) => item.id === 'STK-MAIN-UJI')?.jumlahStok).toBe(3);
    expect(db.getSuratJalan()).toEqual([]);
    expect(db.getTransaksi()).toEqual([]);
  });

  it('mengurangi stok komponen FEFO dan menerbitkan baris kit Rp0 di faktur serta surat jalan', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: new MemoryStorage() });
    const base = INITIAL_STOK_GUDANG[0];
    const bin = INITIAL_LOKASI_BIN.find((item) => item.id === base?.binId);
    if (!base || !bin) throw new Error('fixture lokasi stok tidak tersedia');
    const stok: StokGudang[] = [
      {
        ...base,
        id: 'STK-MAIN-UJI',
        kodeSKU: 'SKU-A',
        namaAlkes: 'Produk A',
        nomorIzinEdar: 'NIE-A-UJI',
        nomorBatch: 'LOT-A',
        jumlahStok: 3,
        qtyDipesan: 1,
        tanggalKedaluwarsa: '2030-01-01',
        statusStok: 'AVAILABLE',
        binId: bin.id,
        gudangId: bin.gudangId
      },
      {
        ...base,
        id: 'STK-KOMP-UJI',
        kodeSKU: 'SKU-B',
        namaAlkes: 'Produk B',
        nomorIzinEdar: 'NIE-B-UJI',
        nomorBatch: 'LOT-B',
        jumlahStok: 3,
        qtyDipesan: 1,
        tanggalKedaluwarsa: '2030-02-01',
        statusStok: 'AVAILABLE',
        binId: bin.id,
        gudangId: bin.gudangId
      }
    ];
    const pesanan: PenjualanAlkes = {
      id: 'SO-FOC-SUKSES',
      nomorPesanan: 'SP-KLINIK-2026-902',
      fasyankes: 'Klinik Uji',
      jalurPenjualan: 'Klinik & Laboratorium',
      namaAlkes: 'Produk A',
      kodeSKU: 'SKU-A',
      nomorBatch: 'LOT-A',
      jumlah: 1,
      satuan: 'Unit',
      totalHarga: 10000,
      statusVerifikasiEtikaIklan: 'Memenuhi Etika Promosi',
      statusKirim: 'Menunggu Alokasi FEFO',
      tanggalPesanan: '2026-06-15',
      promosiFoc: {
        promosiId: 'FOC-UJI',
        namaPromosi: 'Promo Uji',
        paketId: 'KIT-UJI',
        namaPaket: 'Paket Complimentary',
        jumlahKit: 1,
        komponen: [{ kodeSKU: 'SKU-B', namaAlkes: 'Produk B', qtyPerKit: 2, satuan: 'Unit' }]
      }
    };

    db.saveStokGudang(stok);
    db.saveIzinEdar([
      { ...INITIAL_IZIN_EDAR[0]!, id: 'NIE-A-UJI', namaAlkes: 'Produk A', nomorIzinEdar: 'NIE-A-UJI', skuCode: 'SKU-A', tanggalKedaluwarsa: '2030-01-01', status: 'Aktif' },
      { ...INITIAL_IZIN_EDAR[0]!, id: 'NIE-B-UJI', namaAlkes: 'Produk B', nomorIzinEdar: 'NIE-B-UJI', skuCode: 'SKU-B', tanggalKedaluwarsa: '2030-01-01', status: 'Aktif' }
    ]);
    db.saveSuratJalan([]);
    db.saveTransaksi([]);
    db.savePenjualan([pesanan]);
    const hasil = db.catatPengirimanSalesOrder(pesanan.id, new Date('2026-06-15T12:00:00'));

    expect(hasil.boleh).toBe(true);
    expect(db.getStokGudang().find((item) => item.id === 'STK-MAIN-UJI')).toMatchObject({ jumlahStok: 2, qtyDipesan: 1 });
    expect(db.getStokGudang().find((item) => item.id === 'STK-KOMP-UJI')).toMatchObject({ jumlahStok: 1, qtyDipesan: 1 });
    expect(db.getSuratJalan()[0]?.promosiFoc?.komponen[0]?.alokasi).toEqual([{ nomorBatch: 'LOT-B', qty: 2, binId: bin.id }]);
    expect(db.getTransaksi()[0]?.jumlah).toBe(10000);
    expect(db.getTransaksi()[0]?.barisFaktur).toEqual([expect.objectContaining({ subtotal: 0, tarifPpnPersen: 0, nilaiPpn: 0, jenis: 'FOC' })]);
  });

  it('menolak FOC dengan SKU yang sama bila sisa stok bebas tidak cukup setelah alokasi utama', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: new MemoryStorage() });
    const base = INITIAL_STOK_GUDANG[0];
    const bin = INITIAL_LOKASI_BIN.find((item) => item.id === base?.binId);
    if (!base || !bin) throw new Error('fixture lokasi stok tidak tersedia');
    db.saveStokGudang([{
      ...base, id: 'STK-SAMA', kodeSKU: 'SKU-A', namaAlkes: 'Produk A',
      nomorIzinEdar: 'NIE-A-UJI', nomorBatch: 'LOT-A', jumlahStok: 5, qtyDipesan: 3,
      tanggalKedaluwarsa: '2030-01-01', statusStok: 'AVAILABLE', binId: bin.id, gudangId: bin.gudangId
    }]);
    db.saveIzinEdar([{ ...INITIAL_IZIN_EDAR[0]!, id: 'NIE-A-UJI', namaAlkes: 'Produk A', nomorIzinEdar: 'NIE-A-UJI', skuCode: 'SKU-A', tanggalKedaluwarsa: '2030-01-01', status: 'Aktif' }]);
    db.saveSuratJalan([]);
    db.saveTransaksi([]);
    db.savePenjualan([{
      id: 'SO-FOC-SAMA', nomorPesanan: 'SP-KLINIK-2026-903', fasyankes: 'Klinik Uji',
      jalurPenjualan: 'Klinik & Laboratorium', namaAlkes: 'Produk A', kodeSKU: 'SKU-A',
      nomorBatch: 'LOT-A', jumlah: 1, satuan: 'Unit', totalHarga: 10000,
      statusVerifikasiEtikaIklan: 'Memenuhi Etika Promosi', statusKirim: 'Menunggu Alokasi FEFO',
      tanggalPesanan: '2026-06-15',
      promosiFoc: {
        promosiId: 'FOC-UJI', namaPromosi: 'Promo Uji', paketId: 'KIT-UJI',
        namaPaket: 'Paket Complimentary', jumlahKit: 1,
        komponen: [{ kodeSKU: 'SKU-A', namaAlkes: 'Produk A', qtyPerKit: 2, satuan: 'Unit' }]
      }
    }]);
    const hasil = db.catatPengirimanSalesOrder('SO-FOC-SAMA', new Date('2026-06-15T12:00:00'));

    expect(hasil.boleh).toBe(false);
    expect(hasil.keterangan).toContain('Komponen FOC');
    expect(db.getStokGudang()[0]).toMatchObject({ jumlahStok: 5, qtyDipesan: 3 });
    expect(db.getSuratJalan()).toEqual([]);
    expect(db.getTransaksi()).toEqual([]);
  });
});
