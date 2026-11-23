import { useEffect, useMemo, useState } from 'react';
import { useDbTick } from '../../../../hooks/useDbSync';
import { db } from '../../../../services/pocketbase';
import { PenjualanAlkes, PurchaseOrderAlkes } from '../../../../types';
import { proyeksikanPermintaan, statusLimitKredit } from '../../../../utils/sales';
import { stokBebas } from '../../../../utils/gudang';
import {
  DUKUNGAN_ANALITIK_DEMO,
  KAMPANYE_ANALITIK_DEMO,
  PENJUALAN_ANALITIK_DEMO,
  PRODUK_ANALITIK_DEMO,
  STOK_ANALITIK_DEMO,
  TENDER_ANALITIK_DEMO
} from '../../../../data/salesAnalyticsDemo';
import { hitungAnalitikMarketing, hitungTrenPenjualanBulanan } from '../../../../utils/salesMarketingAnalytics';
import {
  ChartColumn,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Gauge,
  ShoppingCart,
  Boxes,
  ArrowRight,
  MapPinned,
  FlaskConical,
  RefreshCw
} from 'lucide-react';
import { Badge, Panel, Stat, BarCapaian, formatRupiah, formatTanggal, formatPersen, inputClass, labelClass, tombolPrimer, type Tone } from '../../../ui';

const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

const KUNCI_PREFERENSI_ANALITIK = 'ams.sales-marketing.analytics.enabled.v1';
const PILAR_ANALITIK = [
  'Performa Produk & Varian (SKU)',
  'Pelanggan & Kanal Penjualan',
  'Pasar, Harga & Tender',
  'Efektivitas Promosi & Akuisisi',
  'Parameter Khusus Alkes'
];

function bacaPreferensiAnalitik(): Record<string, boolean> {
  const tersimpan = window.localStorage.getItem(KUNCI_PREFERENSI_ANALITIK);
  if (!tersimpan) return {};
  try {
    const parsed: unknown = JSON.parse(tersimpan);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, boolean>>((hasil, [key, value]) => {
      if (typeof value === 'boolean') hasil[key] = value;
      return hasil;
    }, {});
  } catch (error) {
    console.error('Gagal membaca preferensi Analitik & Dashboard:', error);
    return {};
  }
}

const tonePeramalan = (status: 'Risiko Stockout' | 'Aman' | 'Risiko Overstock'): Tone =>
  status === 'Risiko Stockout' ? 'rose' : status === 'Risiko Overstock' ? 'amber' : 'emerald';

const labelBulan = (bulan: string) => {
  const [tahun, nomor] = bulan.split('-');
  return `${NAMA_BULAN[Number(nomor) - 1] ?? bulan} ${tahun ? `'${tahun.slice(2)}` : ''}`;
};

const bulanInput = (tanggal: Date) =>
  `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, '0')}`;

const formatNilaiGrafik = (nilai: number, jenis: 'nilai' | 'unit') => {
  if (jenis === 'unit') return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(nilai)} unit`;
  if (nilai >= 1_000_000_000) return `Rp ${(nilai / 1_000_000_000).toFixed(1)} M`;
  if (nilai >= 1_000_000) return `Rp ${(nilai / 1_000_000).toFixed(1)} jt`;
  if (nilai >= 1_000) return `Rp ${(nilai / 1_000).toFixed(0)} rb`;
  return formatRupiah(nilai);
};

export default function AnalitikSalesModule() {
  const dbTick = useDbTick([
    'sales_riwayat_bulanan',
    'penjualan',
    'sales_teritorial',
    'sales_pelanggan',
    'sales_prospek',
    'sales_kunjungan',
    'stok_gudang',
    'pemasok',
    'sales_tender',
    'sales_kampanye',
    'izin_edar',
    'product_catalog'
  ]);
  const riwayat = useMemo(() => {
    void dbTick;
    return db.getRiwayatPenjualanBulanan();
  }, [dbTick]);
  const pesanan = useMemo<PenjualanAlkes[]>(() => {
    void dbTick;
    return db.getPenjualan();
  }, [dbTick]);
  const teritorial = useMemo(() => {
    void dbTick;
    return db.getTeritorial();
  }, [dbTick]);
  const pelanggan = useMemo(() => {
    void dbTick;
    return db.getPelangganB2B();
  }, [dbTick]);
  const prospek = useMemo(() => {
    void dbTick;
    return db.getProspek();
  }, [dbTick]);
  const stok = useMemo(() => {
    void dbTick;
    return db.getStokGudang();
  }, [dbTick]);
  const pemasok = useMemo(() => {
    void dbTick;
    return db.getPemasok();
  }, [dbTick]);
  const katalog = useMemo(() => {
    void dbTick;
    return db.getProdukKatalog();
  }, [dbTick]);
  const izinEdar = useMemo(() => {
    void dbTick;
    return db.getIzinEdar();
  }, [dbTick]);
  const kampanye = useMemo(() => {
    void dbTick;
    return db.getKampanye();
  }, [dbTick]);
  const tender = useMemo(() => {
    void dbTick;
    return db.getTender();
  }, [dbTick]);
  const [terbitPO, setTerbitPO] = useState<string[]>([]);
  const [simulasiAnalitik, setSimulasiAnalitik] = useState(false);
  const [parameterAktif, setParameterAktif] = useState<Record<string, boolean>>(bacaPreferensiAnalitik);
  const [terakhirDiperbarui, setTerakhirDiperbarui] = useState(() => new Date());
  const [jenisGrafik, setJenisGrafik] = useState<'line' | 'bar'>('line');
  const [ukuranGrafik, setUkuranGrafik] = useState<'nilai' | 'unit'>('nilai');
  const [dimensiGrafik, setDimensiGrafik] = useState<'produk' | 'kategori'>('produk');
  const [periodeMulai, setPeriodeMulai] = useState(() => {
    const tanggal = new Date();
    tanggal.setDate(1);
    tanggal.setMonth(tanggal.getMonth() - 23);
    return bulanInput(tanggal);
  });
  const [periodeAkhir, setPeriodeAkhir] = useState(() => bulanInput(new Date()));

  const [leadTimeHari, setLeadTimeHari] = useState(21);
  const [safetyStockHari, setSafetyStockHari] = useState(14);

  useEffect(() => {
    window.localStorage.setItem(KUNCI_PREFERENSI_ANALITIK, JSON.stringify(parameterAktif));
  }, [parameterAktif]);

  useEffect(() => {
    setTerakhirDiperbarui(new Date());
  }, [dbTick, simulasiAnalitik]);

  const dataAnalitik = useMemo(() => {
    const sales = simulasiAnalitik ? PENJUALAN_ANALITIK_DEMO : pesanan;
    const stokAnalitik = simulasiAnalitik
      ? STOK_ANALITIK_DEMO
      : stok.map((row) => ({
          kodeSKU: row.kodeSKU,
          namaAlkes: row.namaAlkes,
          stokTersedia: stokBebas(row),
          tanggalKedaluwarsa: row.tanggalKedaluwarsa,
          tipeProduk: row.jalur === 'A' ? 'Consumables' as const : row.jalur === 'B' ? 'Equipment' as const : undefined
        }));
    const produkAnalitik = simulasiAnalitik
      ? PRODUK_ANALITIK_DEMO
      : katalog.map((row) => ({
          id: row.id,
          nama: row.nama,
          kategori: row.kategori,
          kodeSKU: row.kodeSKU,
          varianSku: row.varianSku
        }));
    const campaigns = simulasiAnalitik
      ? KAMPANYE_ANALITIK_DEMO
      : kampanye.map((row) => ({
          nama: row.namaKegiatan,
          biaya: row.realisasiBiaya,
          nilaiKonversi: row.nilaiKonversi,
          tanggal: row.tanggalMulai
        }));
    const tenderData = simulasiAnalitik
      ? TENDER_ANALITIK_DEMO
      : tender.map((row) => ({ status: row.statusTender, tanggal: row.batasAkhirPengajuan }));
    return {
      sales,
      produk: produkAnalitik,
      riwayat: simulasiAnalitik ? [] : riwayat,
      stok: stokAnalitik,
      izin: izinEdar.map((row) => ({
        namaAlkes: row.namaAlkes,
        nomorIzinEdar: row.nomorIzinEdar,
        status: row.status,
        tanggalKedaluwarsa: row.tanggalKedaluwarsa,
        jenis: row.aklAkd
      })),
      kampanye: campaigns,
      tender: tenderData,
      dukungan: simulasiAnalitik ? DUKUNGAN_ANALITIK_DEMO : undefined
    };
  }, [simulasiAnalitik, pesanan, katalog, riwayat, stok, izinEdar, kampanye, tender]);
  const periodeAnalitik = useMemo(() => ({ bulanMulai: periodeMulai, bulanAkhir: periodeAkhir }), [periodeMulai, periodeAkhir]);
  const metrikAnalitik = useMemo(
    () => hitungAnalitikMarketing(dataAnalitik, periodeAnalitik),
    [dataAnalitik, periodeAnalitik]
  );
  const trenGrafik = useMemo(
    () => hitungTrenPenjualanBulanan(dataAnalitik, periodeAnalitik),
    [dataAnalitik, periodeAnalitik]
  );
  const metrikBar = metrikAnalitik.find((metrik) => metrik.id === (dimensiGrafik === 'produk' ? 'pareto' : 'category-demand'));
  const dataBar = (metrikBar?.baris ?? [])
    .flatMap((row, rowIndex) => {
      if (row.nilaiGrafik === undefined || row.unitGrafik === undefined) return [];
      const nilai = ukuranGrafik === 'nilai' ? row.nilaiGrafik : row.unitGrafik;
      return [{
        key: `${dimensiGrafik}-${rowIndex}`,
        label: row.label.replace(/^\d+\.\s*/, ''),
        nilai,
        display: ukuranGrafik === 'nilai' ? formatRupiah(nilai) : `${nilai} unit`
      }];
    })
    .filter((row) => row.nilai > 0)
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 10);
  const trenTitik = trenGrafik.map((row, index, rows) => ({
    ...row,
    x: rows.length === 1 ? 420 : 78 + (index * 730) / (rows.length - 1),
    y: row[ukuranGrafik] ?? 0
  }));
  const trenMaksimum = Math.max(...trenTitik.map((row) => row.y), 1);
  const titikSvg = trenTitik.map((row, index) => ({
    ...row,
    svgX: row.x,
    svgY: 28 + 205 - (row.y / trenMaksimum) * 205,
    tampilkanLabel: index === 0 || index === trenTitik.length - 1 || index % Math.ceil(trenTitik.length / 8) === 0
  }));
  const pathGrafik = titikSvg.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.svgX} ${point.svgY}`).join(' ');
  const nilaiMaksBar = Math.max(...dataBar.map((row) => row.nilai), 1);
  const bulanSekarang = bulanInput(new Date());

  const daftarProduk = useMemo(() => Array.from(new Set(riwayat.map((r) => r.namaAlkes))), [riwayat]);

  const perBulan = useMemo(() => {
    const peta = new Map<string, { unit: number; nilai: number }>();
    riwayat.forEach((r) => {
      const sebelumnya = peta.get(r.bulan) ?? { unit: 0, nilai: 0 };
      peta.set(r.bulan, { unit: sebelumnya.unit + r.unitTerjual, nilai: sebelumnya.nilai + r.nilaiPenjualan });
    });
    return Array.from(peta.entries())
      .map(([bulan, angka]) => ({ bulan, ...angka }))
      .sort((a, b) => a.bulan.localeCompare(b.bulan));
  }, [riwayat]);

  const perProduk = useMemo(
    () =>
      daftarProduk
        .map((namaAlkes) => {
          const baris = riwayat.filter((r) => r.namaAlkes === namaAlkes);
          const kategori = baris[0]?.kategoriProduk ?? '-';
          return {
            namaAlkes,
            kategori,
            unit: baris.reduce((total, r) => total + r.unitTerjual, 0),
            nilai: baris.reduce((total, r) => total + r.nilaiPenjualan, 0)
          };
        })
        .sort((a, b) => b.nilai - a.nilai),
    [riwayat, daftarProduk]
  );

  const perRayon = useMemo(() => {
    const peta = new Map<string, { unit: number; nilai: number }>();
    riwayat.forEach((r) => {
      const sebelumnya = peta.get(r.rayonDistribusi) ?? { unit: 0, nilai: 0 };
      peta.set(r.rayonDistribusi, { unit: sebelumnya.unit + r.unitTerjual, nilai: sebelumnya.nilai + r.nilaiPenjualan });
    });
    return peta;
  }, [riwayat]);

  const perMedRep = useMemo(() => {
    void dbTick;
    const nama = new Map<string, { prospek: number; pipeline: number; kunjungan: number }>();
    prospek.forEach((p) => {
      const sebelumnya = nama.get(p.medRep) ?? { prospek: 0, pipeline: 0, kunjungan: 0 };
      nama.set(p.medRep, {
        prospek: sebelumnya.prospek + 1,
        pipeline: sebelumnya.pipeline + (p.nilaiEstimasi * p.probabilitasPersen) / 100,
        kunjungan: sebelumnya.kunjungan
      });
    });
    db.getKunjunganMedRep().forEach((k) => {
      const sebelumnya = nama.get(k.medRep) ?? { prospek: 0, pipeline: 0, kunjungan: 0 };
      nama.set(k.medRep, { ...sebelumnya, kunjungan: sebelumnya.kunjungan + 1 });
    });
    return Array.from(nama.entries())
      .map(([medRep, angka]) => ({ medRep, ...angka }))
      .sort((a, b) => b.pipeline - a.pipeline);
  }, [prospek, dbTick]);

  const totalUnit = riwayat.reduce((total, r) => total + r.unitTerjual, 0);
  const totalNilai = riwayat.reduce((total, r) => total + r.nilaiPenjualan, 0);
  const bulanMax = Math.max(...perBulan.map((b) => b.nilai), 1);
  const produkMax = perProduk[0]?.nilai ?? 1;

  const peramalan = useMemo(
    () => {
      const hariIni = new Date().toISOString().split('T')[0];
      return daftarProduk.map((namaAlkes) => {
        const stokProduk = stok
          .filter((s) => s.namaAlkes === namaAlkes && s.tanggalKedaluwarsa >= hariIni)
          .reduce((total, s) => total + stokBebas(s), 0);
        const hasil = proyeksikanPermintaan(riwayat, namaAlkes, stokProduk, { leadTimeHari, safetyStockHari });
        const alokasiLunak30Hari = Math.ceil(hasil.permintaanHarian * 30);
        return {
          ...hasil,
          alokasiLunak30Hari,
          tersediaSetelahForecast: Math.max(stokProduk - alokasiLunak30Hari, 0)
        };
      });
    },
    [daftarProduk, riwayat, stok, leadTimeHari, safetyStockHari]
  );

  const risikoStockout = peramalan.filter((p) => p.status === 'Risiko Stockout');
  const risikoOverstock = peramalan.filter((p) => p.status === 'Risiko Overstock');

  const rataPiutangRasio = useMemo(() => {
    const aktif = pelanggan.filter((p) => p.statusPelanggan === 'Aktif');
    if (aktif.length === 0) return 0;
    return aktif.reduce((total, p) => total + statusLimitKredit(p).rasioPersen, 0) / aktif.length;
  }, [pelanggan]);

  const ajukanPurchaseOrder = (hasil: (typeof peramalan)[number]) => {
    const acuanHarga = perProduk.find((p) => p.namaAlkes === hasil.namaAlkes);
    const bulanTerjual = riwayat.filter((r) => r.namaAlkes === hasil.namaAlkes).length || 1;
    const rataJualPerUnit = acuanHarga ? acuanHarga.nilai / (acuanHarga.unit || 1) : 0;
    const estimasiHpp = Math.round(rataJualPerUnit * 0.75);
    const pemasokTerpilih = pemasok[0];
    const estimasiTiba = new Date();
    estimasiTiba.setDate(estimasiTiba.getDate() + leadTimeHari);

    const po: PurchaseOrderAlkes = {
      id: 'PO-' + Date.now(),
      nomorPO: `PO-IMP-${new Date().getFullYear()}-${String(db.getPurchaseOrder().length + 101).padStart(3, '0')}`,
      pemasokId: pemasokTerpilih?.id ?? '-',
      namaPemasok: pemasokTerpilih?.namaPemasok ?? 'Prinsipal Belum Terpilih',
      tanggalPO: new Date().toISOString().split('T')[0],
      estimasiTiba: estimasiTiba.toISOString().split('T')[0],
      totalNilai: estimasiHpp * hasil.saranPesanan,
      status: 'Diajukan',
      catatanPJT: `Pengajuan otomatis Demand Forecasting ${bulanTerjual} bulan: proyeksi ${hasil.proyeksiBulanBerikutnya} unit/bulan, titik pesan ulang ${hasil.titikPesanUlang} unit. Jumlah diajukan ${hasil.saranPesanan} unit.`
    };
    db.addPurchaseOrder(po);
    setTerbitPO((sebelumnya) => [...sebelumnya, po.nomorPO]);
    db.logAudit(
      'Sales & Marketing — Analitik',
      'Pengajuan Purchase Order dari hasil peramalan permintaan',
      po.nomorPO,
      'Manajer Penjualan',
      'Sales & Marketing',
      [{ kolom: 'status', nilaiLama: 'belum ada pengajuan', nilaiBaru: 'Diajukan' }]
    );
  };

  const aturSemuaParameter = (aktif: boolean) => {
    setParameterAktif((sebelumnya) => {
      const berikutnya = { ...sebelumnya };
      metrikAnalitik.forEach((metrik) => {
        if (metrik.status !== 'belum-tersedia') berikutnya[metrik.id] = aktif;
      });
      return berikutnya;
    });
  };

  return (
    <div className="space-y-4">
      <Panel
        judul="Kerangka Analisis Marketing Alkes"
        keterangan="Data dihitung ulang saat transaksi, katalog, stok, izin edar, tender, atau kampanye berubah. Pilih metrik yang ingin ditampilkan."
        aksi={
          <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={simulasiAnalitik}
              onChange={(event) => setSimulasiAnalitik(event.target.checked)}
              className="h-4 w-4 accent-amber-600"
            />
            <FlaskConical className="h-4 w-4" />
            Simulasi data dummy
          </label>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {simulasiAnalitik ? 'Mode simulasi aktif' : 'Data operasional'}
              {' • '}diperbarui {terakhirDiperbarui.toLocaleTimeString('id-ID')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="text-xs font-semibold text-emerald-700 hover:text-emerald-900" onClick={() => aturSemuaParameter(true)}>
              Aktifkan semua yang tersedia
            </button>
            <span className="text-slate-300">|</span>
            <button type="button" className="text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => aturSemuaParameter(false)}>
              Nonaktifkan semua
            </button>
          </div>
        </div>

        {simulasiAnalitik && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            Data penjualan, stok simulasi, kampanye, tender, tren pasar, dan traffic pada mode ini adalah dummy untuk
            perancangan. Data tidak disimpan ke Sales Order atau Firebase; master izin edar tetap membaca data aplikasi.
          </div>
        )}

        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Grafik hasil analisis marketing">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {jenisGrafik === 'line' ? <Activity className="h-4 w-4 text-emerald-600" /> : <ChartColumn className="h-4 w-4 text-emerald-600" />}
                Grafik hasil analisis
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {jenisGrafik === 'line'
                  ? `Tren penjualan bulanan • ${periodeMulai} sampai ${periodeAkhir}`
                  : `${dimensiGrafik === 'produk' ? 'Peringkat produk/SKU' : 'Peringkat kategori'} • ${periodeMulai} sampai ${periodeAkhir}`}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-slate-600">
                Dari bulan
                <input
                  type="month"
                  value={periodeMulai}
                  max={bulanSekarang}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
                    setPeriodeMulai(value);
                    if (value > periodeAkhir) setPeriodeAkhir(value);
                  }}
                  className={`${inputClass} mt-1 min-w-36`}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Sampai bulan
                <input
                  type="month"
                  value={periodeAkhir}
                  min={periodeMulai}
                  max={bulanSekarang}
                  onChange={(event) => {
                    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setPeriodeAkhir(event.target.value);
                  }}
                  className={`${inputClass} mt-1 min-w-36`}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Nilai grafik
                <select
                  value={ukuranGrafik}
                  onChange={(event) => setUkuranGrafik(event.target.value === 'unit' ? 'unit' : 'nilai')}
                  className={`${inputClass} mt-1 min-w-36`}
                >
                  <option value="nilai">Nilai penjualan</option>
                  <option value="unit">Unit terjual</option>
                </select>
              </label>
              {jenisGrafik === 'bar' && (
                <label className="text-xs font-medium text-slate-600">
                  Kelompok data
                  <select
                    value={dimensiGrafik}
                    onChange={(event) => setDimensiGrafik(event.target.value === 'kategori' ? 'kategori' : 'produk')}
                    className={`${inputClass} mt-1 min-w-36`}
                  >
                    <option value="produk">Produk / SKU</option>
                    <option value="kategori">Kategori</option>
                  </select>
                </label>
              )}
              <div className="flex rounded-lg border border-slate-200 p-1" role="group" aria-label="Pilih jenis grafik">
                <button
                  type="button"
                  aria-pressed={jenisGrafik === 'line'}
                  onClick={() => setJenisGrafik('line')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${jenisGrafik === 'line' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Line Chart
                </button>
                <button
                  type="button"
                  aria-pressed={jenisGrafik === 'bar'}
                  onClick={() => setJenisGrafik('bar')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${jenisGrafik === 'bar' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <ChartColumn className="h-3.5 w-3.5" />
                  Bar Chart
                </button>
              </div>
            </div>
          </div>

          {jenisGrafik === 'line' ? (
            trenTitik.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg bg-slate-50 p-3">
                <svg
                  viewBox="0 0 840 280"
                  role="img"
                  aria-label={`Line chart ${ukuranGrafik === 'nilai' ? 'nilai penjualan' : 'unit terjual'} per bulan`}
                  className="h-auto min-w-[640px] w-full"
                >
                  {[0, 1, 2, 3, 4].map((step) => {
                    const value = (trenMaksimum * step) / 4;
                    const y = 233 - (205 * step) / 4;
                    return (
                      <g key={step}>
                        <line x1="72" y1={y} x2="818" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                        <text x="64" y={y + 4} textAnchor="end" className="fill-slate-500" fontSize="10">
                          {formatNilaiGrafik(value, ukuranGrafik)}
                        </text>
                      </g>
                    );
                  })}
                  {titikSvg.length > 1 && <path d={pathGrafik} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  {titikSvg.map((point) => (
                    <g key={point.bulan}>
                      <title>{`${labelBulan(point.bulan)}: ${formatNilaiGrafik(point.y, ukuranGrafik)}`}</title>
                      <circle cx={point.svgX} cy={point.svgY} r="4" fill="#059669" stroke="white" strokeWidth="2" />
                      {point.tampilkanLabel && (
                        <text x={point.svgX} y="258" textAnchor="middle" className="fill-slate-500" fontSize="10">
                          {labelBulan(point.bulan)}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                Belum ada data penjualan pada periode {periodeMulai} sampai {periodeAkhir}.
              </p>
            )
          ) : dataBar.length ? (
            <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
              {dataBar.map((row) => (
                <div key={row.key} title={`${row.label}: ${row.display}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-slate-700">{row.label}</span>
                    <span className="shrink-0 font-mono font-semibold text-slate-800">{row.display}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(row.nilai / nilaiMaksBar) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
              Belum ada data penjualan yang dapat dibandingkan pada periode {periodeMulai} sampai {periodeAkhir}.
            </p>
          )}
          <p className="mt-3 text-2xs leading-relaxed text-slate-500">
            Periode memfilter transaksi, riwayat bulanan, kampanye berdasarkan tanggal mulai, dan tender berdasarkan batas pengajuan. Stok, izin edar, tren pasar, atau traffic tanpa riwayat waktu mengikuti data terbaru/yang tersedia.
          </p>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {PILAR_ANALITIK.map((pilar, index) => (
            <section key={pilar} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h4 className="text-sm font-bold text-slate-900">{pilar}</h4>
              </div>
              <div className="space-y-3">
                {metrikAnalitik.filter((metrik) => metrik.pilar === pilar).map((metrik) => {
                  const tersedia = metrik.status !== 'belum-tersedia';
                  const aktif = tersedia && parameterAktif[metrik.id] !== false;
                  const labelStatus = metrik.status === 'tersedia' ? 'Data tersedia' : metrik.status === 'parsial' ? 'Data parsial' : 'Belum tersedia';
                  return (
                    <article key={metrik.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <label className={`flex items-start gap-2 text-xs font-semibold ${tersedia ? 'cursor-pointer text-slate-900' : 'cursor-not-allowed text-slate-400'}`}>
                          <input
                            type="checkbox"
                            checked={aktif}
                            disabled={!tersedia}
                            onChange={(event) => setParameterAktif((previous) => ({ ...previous, [metrik.id]: event.target.checked }))}
                            className="mt-0.5 h-4 w-4 accent-emerald-600"
                          />
                          <span>{metrik.nama}</span>
                        </label>
                        <Badge tone={metrik.status === 'tersedia' ? 'emerald' : metrik.status === 'parsial' ? 'amber' : 'rose'}>
                          {labelStatus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{metrik.deskripsi}</p>
                      <p className={`mt-1 text-2xs leading-relaxed ${tersedia ? 'text-slate-500' : 'text-amber-700'}`}>
                        {metrik.alasan}
                      </p>
                      {aktif && (
                        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-100">
                          {metrik.baris.length ? (
                            <div className="divide-y divide-slate-100">
                              {metrik.baris.map((row, rowIndex) => (
                                <div key={`${metrik.id}-${rowIndex}`} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-700">{row.label}</div>
                                    {row.detail && <div className="mt-0.5 text-2xs leading-relaxed text-slate-500">{row.detail}</div>}
                                  </div>
                                  <span className="shrink-0 text-right font-mono font-semibold text-slate-900">{row.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-2 text-xs text-slate-500">Belum ada baris data untuk periode ini.</p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Nilai Penjualan Historis"
          value={formatRupiah(totalNilai)}
          hint={`${totalUnit} unit tercatat pada ${perBulan.length} periode bulan`}
          tone="emerald"
        />
        <Stat
          label="Sales Order Aktif"
          value={pesanan.filter((s) => s.statusKirim !== 'Dibatalkan' && s.statusKirim !== 'Diterima Fasyankes').length}
          hint={`Dari ${pesanan.length} pesanan terdaftar • nilai ${formatRupiah(pesanan.reduce((t, s) => t + s.totalHarga, 0))}`}
          tone="blue"
        />
        <Stat
          label="Risiko Stok"
          value={`${risikoStockout.length} stockout / ${risikoOverstock.length} overstock`}
          hint="Berdasarkan titik pesan ulang dan proyeksi bulan berikutnya"
          tone={risikoStockout.length ? 'rose' : 'emerald'}
        />
        <Stat
          label="Rata-rata Paparan Kredit"
          value={formatPersen(rataPiutangRasio, 0)}
          hint="Rasio piutang berjalan terhadap pagu kredit pelanggan aktif"
          tone={rataPiutangRasio > 85 ? 'rose' : rataPiutangRasio > 60 ? 'amber' : 'emerald'}
        />
      </div>

      <Panel
        judul="Sales Performance Dashboard"
        keterangan="Capaian bulanan, kontribusi produk, realisasi per rayon terhadap target tahunan, dan peringkat med rep berdasarkan nilai pipeline tertimbang probabilitas."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Tren nilai penjualan per bulan
            </h4>
            <div className="space-y-1.5">
              {perBulan.map((b) => (
                <div key={b.bulan} className="flex items-center gap-2">
                  <span className="w-14 text-2xs font-mono text-slate-500 shrink-0">{labelBulan(b.bulan)}</span>
                  <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded bg-emerald-600/85"
                      style={{ width: `${Math.max((b.nilai / bulanMax) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-2xs font-mono font-semibold text-slate-700 shrink-0">
                    {formatRupiah(b.nilai)}
                  </span>
                  <span className="w-14 text-right text-2xs font-mono text-slate-500 shrink-0">{b.unit} unit</span>
                </div>
              ))}
            </div>
            <p className="text-2xs text-slate-500 mt-2 leading-relaxed">
              Batang memakai skala nilai penjualan relatif terhadap bulan tertinggi pada periode yang sama.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <ChartColumn className="w-3.5 h-3.5 text-emerald-600" />
              Kontribusi produk terhadap pendapatan
            </h4>
            <div className="space-y-2">
              {perProduk.map((p) => (
                <div key={p.namaAlkes} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-800">{p.namaAlkes}</span>
                    <span className="text-2xs font-mono text-slate-500">{formatPersen((p.nilai / produkMax) * 100, 0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max((p.nilai / produkMax) * 100, 2)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-500">
                    <span>{p.kategori}</span>
                    <span className="font-mono">
                      {p.unit} unit • {formatRupiah(p.nilai)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <MapPinned className="w-3.5 h-3.5 text-emerald-600" />
              Capaian target tahunan per rayon
            </h4>
            <div className="space-y-3">
              {teritorial.map((t) => {
                const realisasiRayon = perRayon.get(t.namaRayon)?.nilai ?? 0;
                const capaian = t.targetTahunan > 0 ? (realisasiRayon / t.targetTahunan) * 100 : 0;
                return (
                  <BarCapaian
                    key={t.id}
                    label={`${t.namaRayon} (${t.medRep})`}
                    persen={capaian}
                    hint={`Realisasi riwayat rayon ${formatRupiah(realisasiRayon)} dari target ${formatRupiah(t.targetTahunan)} • Ytd sistem ${formatRupiah(t.realisasiYtd)}`}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              Peringkat med rep
            </h4>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3">Med Rep</th>
                    <th className="py-2.5 px-3">Prospek</th>
                    <th className="py-2.5 px-3">Kunjungan</th>
                    <th className="py-2.5 px-3 text-right">Pipeline Tertimbang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perMedRep.map((m) => (
                    <tr key={m.medRep}>
                      <td className="py-2 px-3 font-semibold text-slate-800">{m.medRep}</td>
                      <td className="py-2 px-3 text-slate-600">{m.prospek}</td>
                      <td className="py-2 px-3 text-slate-600">{m.kunjungan}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{formatRupiah(m.pipeline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Funnel Sales Order berdasarkan status pengiriman
              </div>
              {(['Verifikasi Pesanan', 'Menunggu Alokasi FEFO', 'Terkirim', 'Diterima Fasyankes', 'Dibatalkan'] as const).map((status) => {
                const jumlah = pesanan.filter((s) => s.statusKirim === status).length;
                const persen = pesanan.length > 0 ? (jumlah / pesanan.length) * 100 : 0;
                return (
                  <div key={status} className="flex items-center justify-between text-2xs py-1">
                    <span className="text-slate-600">{status}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {jumlah} <span className="text-slate-400">({formatPersen(persen, 0)})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {terbitPO.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2">
            <ShoppingCart className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Purchase Order berhasil diajukan dari peramalan: {terbitPO.join(', ')}. Status tercatat Diajukan dan
              menunggu persetujuan PJT pada modul Purchasing &amp; Procurement.
            </span>
          </div>
        )}
      </Panel>

      <Panel
        judul="Demand Forecasting"
        keterangan="Proyeksi permintaan moving-average tiga bulan terakhir dengan penyesuaian tren (dibatasi ±25%), titik pesan ulang dari lead time dan safety stock, serta saran pengajuan Purchase Order."
        aksi={
          <div className="flex items-end gap-3">
            <div>
              <label className={labelClass}>Lead Time (hari)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={leadTimeHari}
                onChange={(e) => setLeadTimeHari(Number(e.target.value))}
                className={`${inputClass} w-24`}
              />
            </div>
            <div>
              <label className={labelClass}>Safety Stock (hari)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={safetyStockHari}
                onChange={(e) => setSafetyStockHari(Number(e.target.value))}
                className={`${inputClass} w-24`}
              />
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-3 px-4">Produk</th>
                <th className="py-3 px-4">Rata-rata / Bulan</th>
                <th className="py-3 px-4">Tren</th>
                <th className="py-3 px-4">Proyeksi Bulan Depan</th>
                <th className="py-3 px-4">Titik Pesan Ulang</th>
                <th className="py-3 px-4">Stok Bebas</th>
                <th className="py-3 px-4">Alokasi Lunak 30 Hari</th>
                <th className="py-3 px-4">Tersedia Setelah Forecast</th>
                <th className="py-3 px-4">Status Risiko</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {peramalan.map((h) => (
                <tr key={h.namaAlkes} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{h.namaAlkes}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{h.rataRataBulanan.toFixed(1)} unit</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-2xs font-bold ${h.trenPersen >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {h.trenPersen >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {formatPersen(h.trenPersen, 1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">{h.proyeksiBulanBerikutnya} unit</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{h.titikPesanUlang} unit</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">{h.stokSekarang} unit</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{h.alokasiLunak30Hari} unit</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">{h.tersediaSetelahForecast} unit</td>
                  <td className="py-3 px-4">
                    <Badge tone={tonePeramalan(h.status)}>
                      <Gauge className="w-3 h-3" />
                      {h.status}
                    </Badge>
                    <div className="text-2xs text-slate-500 mt-1 max-w-xs leading-relaxed">{h.keterangan}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {h.status === 'Risiko Stockout' ? (
                      <button type="button" className={tombolPrimer} onClick={() => ajukanPurchaseOrder(h)}>
                        <Boxes className="w-3.5 h-3.5" />
                        Ajukan PO {h.saranPesanan} Unit
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-2xs text-slate-400">
                        {h.status === 'Risiko Overstock' ? 'tekankan penyaluran FEFO' : 'stok seimbang'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-2xs text-slate-500 leading-relaxed">
          Titik pesan ulang = permintaan harian × (lead time + safety stock). Permintaan harian memakai asumsi 26 hari
          kerja per bulan. Stok bebas mengurangi reservasi SO serta mengecualikan batch terkunci/kedaluwarsa. Forecast
          30 hari adalah alokasi lunak (bukan reservasi picking); kolom tersedia setelah forecast membantu perencanaan
          tanpa mengubah saldo fisik.
          Data peramalan per bulan juga tersedia untuk partisi waktu pada skema PostgreSQL produksi.
        </p>
      </Panel>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 leading-relaxed">
        <span className="font-bold text-slate-800">Catatan analitik:</span> Dashboard membaca riwayat penjualan bulanan
        {` (${perBulan.map((b) => labelBulan(b.bulan)).join(', ')}`}) dan Sales Order berjalan{' '}
        {pesanan.length > 0 ? `terakhir ${formatTanggal(pesanan[0].tanggalPesanan)}` : 'belum ada'} — seluruh perubahan
        status pesanan tercatat pada audit trail beserta nilai lama dan baru.
      </div>
    </div>
  );
}
