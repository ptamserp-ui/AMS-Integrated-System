import { describe, expect, it } from 'vitest';
import {
  DUKUNGAN_ANALITIK_DEMO,
  KAMPANYE_ANALITIK_DEMO,
  PENJUALAN_ANALITIK_DEMO,
  PRODUK_ANALITIK_DEMO,
  STOK_ANALITIK_DEMO,
  TENDER_ANALITIK_DEMO
} from '../../src/data/salesAnalyticsDemo';
import {
  hitungAnalitikMarketing,
  hitungTrenPenjualanBulanan,
  type DataAnalitik
} from '../../src/utils/salesMarketingAnalytics';

const metrikDenganId = (data: DataAnalitik, id: string) =>
  hitungAnalitikMarketing(data).find((metrik) => metrik.id === id)!;

describe('sales marketing analytics', () => {
  it('uses the isolated demo data to render sales metrics and unsold catalog categories', () => {
    const data: DataAnalitik = {
      sales: PENJUALAN_ANALITIK_DEMO,
      produk: PRODUK_ANALITIK_DEMO,
      riwayat: [],
      stok: STOK_ANALITIK_DEMO,
      izin: [{ namaAlkes: 'Izin demo', nomorIzinEdar: 'AKL-DEMO', status: 'Aktif', tanggalKedaluwarsa: '2027-01-01', jenis: 'AKL' }],
      kampanye: KAMPANYE_ANALITIK_DEMO,
      tender: TENDER_ANALITIK_DEMO,
      dukungan: DUKUNGAN_ANALITIK_DEMO,
      tanggalAcuan: '2026-11-20'
    };

    const pareto = metrikDenganId(data, 'pareto');
    expect(pareto.status).toBe('tersedia');
    expect(pareto.baris[0].label).toBe('Produk terlaris berdasarkan unit');

    const kategori = metrikDenganId(data, 'category-demand');
    expect(kategori.baris.find((row) => row.label === 'Elektromedik Radiasi')).toMatchObject({
      value: '0 unit',
      detail: expect.stringContaining('0 dari 1 produk master')
    });
    expect(kategori.baris.some((row) => row.label.startsWith('Tidak terjual: Mobile X-Ray'))).toBe(true);

    for (const id of ['margin', 'velocity', 'cannibalization', 'retention', 'basket', 'price-sensitivity', 'market-share', 'campaign-roas', 'page-conversion', 'seasonality']) {
      expect(metrikDenganId(data, id).status, id).not.toBe('belum-tersedia');
    }
  });

  it('does not fabricate unavailable metrics and still identifies zero-sale categories', () => {
    const data: DataAnalitik = {
      sales: [],
      produk: [
        { id: 'p-1', nama: 'Produk terjual', kategori: 'Diagnostik In Vitro', kodeSKU: 'SKU-A' },
        { id: 'p-2', nama: 'Produk belum terjual', kategori: 'Non Elektromedik Steril', kodeSKU: 'SKU-B' }
      ],
      riwayat: [{
        id: 'history-1',
        namaAlkes: 'Produk terjual',
        kategoriProduk: 'Diagnostik In Vitro',
        rayonDistribusi: 'Rayon A',
        bulan: '2026-10',
        unitTerjual: 4,
        nilaiPenjualan: 400000
      }],
      stok: [],
      izin: [],
      kampanye: [],
      tender: [],
      tanggalAcuan: '2026-11-20'
    };

    expect(metrikDenganId(data, 'category-demand').baris.find((row) => row.label === 'Non Elektromedik Steril')).toMatchObject({
      value: '0 unit',
      detail: expect.stringContaining('0 dari 1 produk master')
    });
    expect(metrikDenganId(data, 'market-share').status).toBe('belum-tersedia');
    expect(metrikDenganId(data, 'page-conversion').status).toBe('belum-tersedia');
    expect(metrikDenganId(data, 'margin').status).toBe('belum-tersedia');
    expect(metrikDenganId(data, 'seasonality').status).toBe('belum-tersedia');
  });

  it('does not label catalog products unsold when no sales source is available', () => {
    const data: DataAnalitik = {
      sales: [],
      produk: [{ id: 'p-1', nama: 'Produk', kategori: 'Diagnostik In Vitro', kodeSKU: 'SKU-A' }],
      riwayat: [],
      stok: [],
      izin: [],
      kampanye: [],
      tender: [],
      tanggalAcuan: '2026-11-20'
    };
    const kategori = metrikDenganId(data, 'category-demand');

    expect(kategori.baris).toContainEqual(expect.objectContaining({
      label: 'Diagnostik In Vitro',
      value: 'Belum ada data'
    }));
    expect(kategori.baris.some((row) => row.label.startsWith('Tidak terjual:'))).toBe(false);
    expect(kategori.alasan).toContain('belum ada sumber penjualan');
  });

  it('does not double-count Sales Orders for months already covered by monthly sales history', () => {
    const data: DataAnalitik = {
      sales: [{
        id: 'so-oct',
        nomorPesanan: 'SO-OCT',
        namaAlkes: 'Produk terjual',
        produkId: 'p-1',
        kodeSKU: 'SKU-A',
        tanggalPesanan: '2026-10-12',
        jumlah: 2,
        totalHarga: 200000,
        statusKirim: 'Diterima Fasyankes'
      }, {
        id: 'so-nov',
        nomorPesanan: 'SO-NOV',
        namaAlkes: 'Produk terjual',
        produkId: 'p-1',
        kodeSKU: 'SKU-A',
        tanggalPesanan: '2026-11-12',
        jumlah: 12,
        totalHarga: 2000000,
        statusKirim: 'Diterima Fasyankes'
      }],
      produk: [{ id: 'p-1', nama: 'Produk terjual', kategori: 'Diagnostik In Vitro', kodeSKU: 'SKU-A' }],
      riwayat: [{
        id: 'history-1',
        namaAlkes: 'Produk terjual',
        kategoriProduk: 'Diagnostik In Vitro',
        rayonDistribusi: 'Rayon A',
        bulan: '2026-10',
        unitTerjual: 10,
        nilaiPenjualan: 1000000
      }],
      stok: [],
      izin: [],
      kampanye: [
        { nama: 'Kampanye Oktober', biaya: 100, nilaiKonversi: 250, tanggal: '2026-10-15' },
        { nama: 'Kampanye November', biaya: 200, nilaiKonversi: 500, tanggal: '2026-11-15' }
      ],
      tender: [
        { status: 'Dimenangkan', tanggal: '2026-10-15' },
        { status: 'Kalah', tanggal: '2026-11-15' }
      ],
      tanggalAcuan: '2026-11-20'
    };

    expect(metrikDenganId(data, 'pareto').baris.find((row) => row.label.startsWith('1.'))).toMatchObject({
      value: expect.stringContaining('3.000.000'),
      detail: expect.stringContaining('22 unit')
    });
    expect(metrikDenganId(data, 'category-demand').baris[1]).toMatchObject({
      value: '22 unit',
      detail: expect.stringContaining('3.000.000')
    });

    const periodeOktober = { bulanMulai: '2026-10', bulanAkhir: '2026-10' };
    const tren = hitungTrenPenjualanBulanan(data, periodeOktober);
    expect(tren).toEqual([{ bulan: '2026-10', unit: 10, nilai: 1000000 }]);
    expect(metrikDenganId(data, 'pareto').baris.find((row) => row.label.startsWith('1.'))?.unitGrafik).toBe(22);
    expect(hitungAnalitikMarketing(data, periodeOktober)
      .find((metric) => metric.id === 'pareto')
      ?.baris.find((row) => row.label.startsWith('1.'))).toMatchObject({
      value: expect.stringContaining('1.000.000'),
      detail: expect.stringContaining('10 unit')
    });
    expect(hitungAnalitikMarketing(data, periodeOktober)
      .find((metric) => metric.id === 'campaign-roas')
      ?.baris).toContainEqual(expect.objectContaining({ label: 'Kampanye Oktober', value: '2,5x' }));
    expect(hitungAnalitikMarketing(data, periodeOktober)
      .find((metric) => metric.id === 'campaign-roas')
      ?.baris.some((row) => row.label === 'Kampanye November')).toBe(false);
    expect(hitungAnalitikMarketing(data, periodeOktober)
      .find((metric) => metric.id === 'tender-win-loss')
      ?.baris).toContainEqual(expect.objectContaining({ label: 'Kalah', value: '0' }));
  });
});
