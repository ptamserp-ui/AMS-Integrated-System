import type { RiwayatPenjualanBulanan } from '../types';

export interface AnalyticSale {
  id: string;
  nomorPesanan: string;
  namaAlkes: string;
  produkId?: string;
  kodeSKU?: string;
  tanggalPesanan: string;
  jumlah: number;
  totalHarga: number;
  pelangganId?: string;
  jalurPenjualan?: string;
  kanalMarketing?: string;
  statusKirim?: string;
  hargaSatuan?: number;
  diskonNilai?: number;
  hppSatuan?: number;
  biayaPromosi?: number;
  tipeProduk?: 'Consumables' | 'Equipment';
  kategoriProduk?: string;
}

export interface AnalyticProduct {
  id: string;
  nama: string;
  kategori: string;
  kodeSKU?: string;
  varianSku?: { kodeSKU: string }[];
}

export interface AnalyticInventory {
  kodeSKU?: string;
  namaAlkes: string;
  stokTersedia: number;
  tanggalKedaluwarsa?: string;
  tipeProduk?: 'Consumables' | 'Equipment';
}

export interface AnalyticLicense {
  namaAlkes: string;
  nomorIzinEdar: string;
  status: string;
  tanggalKedaluwarsa: string;
  jenis?: 'AKD' | 'AKL';
}

export interface AnalyticCampaign {
  nama: string;
  biaya: number;
  nilaiKonversi: number;
  kategori?: string;
  tanggal?: string;
}

export interface AnalyticTender {
  status: string;
  alasanKalah?: string;
  tanggal?: string;
}

export interface AnalyticSupportData {
  marketTrend?: { kategori: string; pertumbuhanPasarPersen: number; pertumbuhanPenjualanPersen: number }[];
  pageTraffic?: { kodeSKU: string; namaProduk: string; kunjungan: number; pesanan: number }[];
  tenderLossReasons?: { alasan: string; jumlah: number }[];
}

export interface AnalyticMetricRow {
  label: string;
  value: string;
  detail?: string;
  nilaiGrafik?: number;
  unitGrafik?: number;
}

export interface AnalyticMetric {
  id: string;
  pilar: string;
  nama: string;
  deskripsi: string;
  status: 'tersedia' | 'parsial' | 'belum-tersedia';
  alasan: string;
  baris: AnalyticMetricRow[];
}

export interface DataAnalitik {
  sales: readonly AnalyticSale[];
  produk: readonly AnalyticProduct[];
  riwayat: readonly RiwayatPenjualanBulanan[];
  stok: readonly AnalyticInventory[];
  izin: readonly AnalyticLicense[];
  kampanye: readonly AnalyticCampaign[];
  tender: readonly AnalyticTender[];
  dukungan?: AnalyticSupportData;
  tanggalAcuan?: string;
}

export interface PeriodeAnalitik {
  bulanMulai: string;
  bulanAkhir: string;
}

export interface TrenPenjualanBulanan {
  bulan: string;
  unit: number;
  nilai: number;
}

const FORMAT_RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});
const FORMAT_ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const FORMAT_PERSEN = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const formatRupiah = (nilai: number) => FORMAT_RUPIAH.format(nilai);
const formatAngka = (nilai: number) => FORMAT_ANGKA.format(nilai);
const formatPersen = (nilai: number) => `${FORMAT_PERSEN.format(nilai)}%`;
const nilaiValid = (nilai: number | undefined) => typeof nilai === 'number' && Number.isFinite(nilai);
const idBulan = (tanggal: string) => tanggal.slice(0, 7);
const skuPenjualan = (sale: AnalyticSale) => sale.kodeSKU?.trim() || sale.produkId?.trim() || sale.namaAlkes;
const namaSku = (sale: AnalyticSale) =>
  sale.kodeSKU?.trim() ? `${sale.namaAlkes} (${sale.kodeSKU.trim()})` : sale.namaAlkes;
const PENJUALAN_VALID = (sale: AnalyticSale) => sale.statusKirim !== 'Dibatalkan' && sale.jumlah > 0;

function dataBulanSales(sales: readonly AnalyticSale[]) {
  const bulan = new Map<string, { unit: number; nilai: number }>();
  sales.filter(PENJUALAN_VALID).forEach((sale) => {
    const key = idBulan(sale.tanggalPesanan);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const sebelum = bulan.get(key) ?? { unit: 0, nilai: 0 };
    bulan.set(key, {
      unit: sebelum.unit + sale.jumlah,
      nilai: sebelum.nilai + sale.totalHarga
    });
  });
  return bulan;
}

function dataBulanRiwayat(riwayat: readonly RiwayatPenjualanBulanan[]) {
  const bulan = new Map<string, { unit: number; nilai: number }>();
  riwayat.forEach((row) => {
    const sebelum = bulan.get(row.bulan) ?? { unit: 0, nilai: 0 };
    bulan.set(row.bulan, {
      unit: sebelum.unit + row.unitTerjual,
      nilai: sebelum.nilai + row.nilaiPenjualan
    });
  });
  return bulan;
}

function dataBulanGabungan(sales: readonly AnalyticSale[], riwayat: readonly RiwayatPenjualanBulanan[]) {
  const bulan = dataBulanSales(sales);
  dataBulanRiwayat(riwayat).forEach((angka, key) => bulan.set(key, angka));
  return bulan;
}

function akhirBulan(bulan: string) {
  const [tahun, nomorBulan] = bulan.split('-').map(Number);
  return new Date(Date.UTC(tahun, nomorBulan, 0)).toISOString().slice(0, 10);
}

function dataDalamPeriode(data: DataAnalitik, periode?: PeriodeAnalitik) {
  const tanggalAcuan = data.tanggalAcuan ?? new Date().toISOString().slice(0, 10);
  const bulanDefault = tanggalBatas(tanggalAcuan, 24).slice(0, 7);
  const bulanMulai = periode?.bulanMulai ?? bulanDefault;
  const bulanAkhir = periode?.bulanAkhir ?? tanggalAcuan.slice(0, 7);
  const tanggalMulai = `${bulanMulai}-01`;
  const tanggalAkhir = periode
    ? [akhirBulan(bulanAkhir), tanggalAcuan].sort()[0]
    : tanggalAcuan;
  const dalamRentangTanggal = (tanggal: string) =>
    tanggal >= tanggalMulai && tanggal <= tanggalAkhir;

  return {
    tanggalAcuan,
    sales: data.sales.filter((sale) => dalamRentangTanggal(sale.tanggalPesanan)),
    riwayat: data.riwayat.filter((row) => row.bulan >= bulanMulai && row.bulan <= bulanAkhir && row.bulan <= tanggalAcuan.slice(0, 7)),
    kampanye: data.kampanye.filter((row) => !row.tanggal || dalamRentangTanggal(row.tanggal)),
    tender: data.tender.filter((row) => !row.tanggal || dalamRentangTanggal(row.tanggal))
  };
}

export function hitungTrenPenjualanBulanan(data: DataAnalitik, periode?: PeriodeAnalitik): TrenPenjualanBulanan[] {
  const { sales, riwayat } = dataDalamPeriode(data, periode);
  return Array.from(dataBulanGabungan(sales, riwayat), ([bulan, angka]) => ({
    bulan,
    unit: angka.unit,
    nilai: angka.nilai
  })).sort((a, b) => a.bulan.localeCompare(b.bulan));
}

function bulanRiwayat(riwayat: readonly RiwayatPenjualanBulanan[]) {
  return new Set(riwayat.map((row) => row.bulan));
}

function labelPeriode(sales: readonly AnalyticSale[], riwayat: readonly RiwayatPenjualanBulanan[]) {
  const months = Array.from(new Set([
    ...riwayat.map((row) => row.bulan),
    ...sales.filter(PENJUALAN_VALID).map((sale) => idBulan(sale.tanggalPesanan))
  ])).sort();
  return months.length ? `Periode ${months[0]}–${months[months.length - 1]}. ` : '';
}

function produkCocokDenganSale(sale: AnalyticSale, produk: readonly AnalyticProduct[]) {
  return produk.find((item) =>
    item.id === sale.produkId ||
    item.kodeSKU === sale.kodeSKU ||
    item.varianSku?.some((variant) => variant.kodeSKU === sale.kodeSKU) ||
    item.nama.trim().toLocaleLowerCase('id-ID') === sale.namaAlkes.trim().toLocaleLowerCase('id-ID')
  );
}

function tanggalBatas(tanggal: string, jumlahBulan: number) {
  const hasil = new Date(`${tanggal}T00:00:00.000Z`);
  hasil.setUTCMonth(hasil.getUTCMonth() - jumlahBulan);
  return hasil.toISOString().slice(0, 10);
}

function korelasiHargaUnit(sales: readonly AnalyticSale[]) {
  const bulanan = new Map<string, { unit: number; nilai: number }>();
  sales.filter(PENJUALAN_VALID).forEach((sale) => {
    const harga = sale.totalHarga / sale.jumlah;
    if (!Number.isFinite(harga) || harga <= 0) return;
    const key = `${skuPenjualan(sale)}|${idBulan(sale.tanggalPesanan)}`;
    const sebelum = bulanan.get(key) ?? { unit: 0, nilai: 0 };
    bulanan.set(key, { unit: sebelum.unit + sale.jumlah, nilai: sebelum.nilai + sale.totalHarga });
  });

  const perSku = new Map<string, { harga: number; unit: number }[]>();
  bulanan.forEach((angka, key) => {
    const sku = key.slice(0, key.lastIndexOf('|'));
    const daftar = perSku.get(sku) ?? [];
    daftar.push({ harga: angka.nilai / angka.unit, unit: angka.unit });
    perSku.set(sku, daftar);
  });

  return Array.from(perSku.entries())
    .map(([sku, points]) => {
      if (points.length < 4) return null;
      const xs = points.map((point) => Math.log(point.harga));
      const ys = points.map((point) => Math.log(point.unit));
      const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
      const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
      const variance = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
      if (variance === 0) return null;
      const elasticity =
        xs.reduce((sum, value, index) => sum + (value - xMean) * (ys[index] - yMean), 0) / variance;
      return { sku, elasticity, points: points.length };
    })
    .filter((point): point is { sku: string; elasticity: number; points: number } => point !== null)
    .sort((a, b) => a.elasticity - b.elasticity);
}

function hitungPareto(
  sales: readonly AnalyticSale[],
  riwayat: readonly RiwayatPenjualanBulanan[],
  produk: readonly AnalyticProduct[]
): AnalyticMetric {
  const bySku = new Map<string, { nama: string; unit: number; nilai: number }>();
  const valid = sales.filter(PENJUALAN_VALID);
  const monthsInHistory = bulanRiwayat(riwayat);
  riwayat.forEach((row) => {
    const master = produk.find((item) =>
      item.nama.trim().toLocaleLowerCase('id-ID') === row.namaAlkes.trim().toLocaleLowerCase('id-ID')
    );
    const key = master?.id ?? row.namaAlkes;
    const sebelum = bySku.get(key) ?? { nama: master?.nama ?? row.namaAlkes, unit: 0, nilai: 0 };
    bySku.set(key, {
      nama: sebelum.nama,
      unit: sebelum.unit + row.unitTerjual,
      nilai: sebelum.nilai + row.nilaiPenjualan
    });
  });
  const incrementalSales = valid.filter((sale) => !monthsInHistory.has(idBulan(sale.tanggalPesanan)));
  incrementalSales.forEach((sale) => {
    const master = produkCocokDenganSale(sale, produk);
    const key = riwayat.length ? master?.id ?? skuPenjualan(sale) : skuPenjualan(sale);
    const sebelum = bySku.get(key) ?? {
      nama: !riwayat.length && sale.kodeSKU ? `${sale.namaAlkes} (${sale.kodeSKU})` : master?.nama ?? namaSku(sale),
      unit: 0,
      nilai: 0
    };
    bySku.set(key, {
      nama: sebelum.nama,
      unit: sebelum.unit + sale.jumlah,
      nilai: sebelum.nilai + sale.totalHarga
    });
  });
  const total = Array.from(bySku.values()).reduce((sum, row) => sum + row.nilai, 0);
  const ranked = Array.from(bySku.entries())
    .map(([sku, row]) => ({ sku, ...row }))
    .sort((a, b) => b.nilai - a.nilai);
  const rankedByUnits = [...ranked].sort((a, b) => b.unit - a.unit);
  const banyakPemenang = Math.max(1, Math.ceil(ranked.length * 0.2));
  const sharePemenang =
    total > 0 ? (ranked.slice(0, banyakPemenang).reduce((sum, row) => sum + row.nilai, 0) / total) * 100 : 0;
  const adaSku = incrementalSales.some((sale) => Boolean(sale.kodeSKU));
  const memakaiRiwayat = riwayat.length > 0;
  const periode = labelPeriode(incrementalSales, riwayat);
  return {
    id: 'pareto',
    pilar: 'Performa Produk & Varian (SKU)',
    nama: 'Pareto 80/20 & top performers',
    deskripsi: 'Kontribusi pendapatan per SKU/produk, dari transaksi yang tidak dibatalkan.',
    status: !ranked.length ? 'belum-tersedia' : adaSku ? 'tersedia' : 'parsial',
    alasan: periode + (!ranked.length
      ? 'Belum ada transaksi penjualan yang dapat dianalisis.'
      : memakaiRiwayat
        ? 'Riwayat bulanan menjadi sumber untuk bulan yang sama; Sales Order hanya menambah bulan di luar riwayat agar tidak terjadi hitung ganda.'
        : adaSku
          ? 'Mengikuti kode SKU pada transaksi.'
          : 'Kode SKU belum tercatat; hasil sementara dikelompokkan per nama produk.'),
    baris: [
      ...(rankedByUnits[0]
        ? [{
            label: 'Produk terlaris berdasarkan unit',
            value: rankedByUnits[0].nama,
            detail: `${formatAngka(rankedByUnits[0].unit)} unit`
          }]
        : []),
      { label: `Kontribusi ${banyakPemenang} SKU/produk teratas`, value: formatPersen(sharePemenang), detail: `Total penjualan ${formatRupiah(total)}` },
      ...ranked.map((row, index) => ({
        label: `${index + 1}. ${row.nama}`,
        value: formatRupiah(row.nilai),
        detail: `${formatPersen(total > 0 ? (row.nilai / total) * 100 : 0)} kontribusi • ${formatAngka(row.unit)} unit`,
        nilaiGrafik: row.nilai,
        unitGrafik: row.unit
      }))
    ]
  };
}

function hitungKategori(
  sales: readonly AnalyticSale[],
  produk: readonly AnalyticProduct[],
  riwayat: readonly RiwayatPenjualanBulanan[]
): AnalyticMetric {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('id-ID');
  const categoryBySku = new Map<string, string>();
  const categoryByName = new Map<string, string>();
  const categories = new Map<string, { unit: number; revenue: number; products: Set<string>; soldProducts: Set<string> }>();
  const recentSales = sales.filter(PENJUALAN_VALID);
  const ensureCategory = (category: string) => {
    if (!categories.has(category)) {
      categories.set(category, { unit: 0, revenue: 0, products: new Set(), soldProducts: new Set() });
    }
  };

  produk.forEach((item) => {
    if (!item.kategori.trim()) return;
    ensureCategory(item.kategori);
    categoryByName.set(normalize(item.nama), item.kategori);
    if (item.kodeSKU) {
      categoryBySku.set(item.kodeSKU, item.kategori);
    }
    categories.get(item.kategori)?.products.add(item.id);
    item.varianSku?.forEach((variant) => {
      categoryBySku.set(variant.kodeSKU, item.kategori);
    });
  });
  riwayat.forEach((row) => {
    ensureCategory(row.kategoriProduk);
    categoryByName.set(normalize(row.namaAlkes), row.kategoriProduk);
    const master = produk.find((item) => normalize(item.nama) === normalize(row.namaAlkes));
    if (!master) categories.get(row.kategoriProduk)?.products.add(row.namaAlkes);
    categories.get(row.kategoriProduk)?.soldProducts.add(master?.id ?? row.namaAlkes);
  });

  riwayat.forEach((sale) => {
    const row = categories.get(sale.kategoriProduk)!;
    row.unit += sale.unitTerjual;
    row.revenue += sale.nilaiPenjualan;
  });
  const monthsInHistory = bulanRiwayat(riwayat);
  recentSales.filter((sale) => !monthsInHistory.has(idBulan(sale.tanggalPesanan))).forEach((sale) => {
    const category =
      sale.kategoriProduk ??
      (sale.kodeSKU ? categoryBySku.get(sale.kodeSKU) : undefined) ??
      (sale.produkId ? produk.find((item) => item.id === sale.produkId)?.kategori : undefined) ??
      categoryByName.get(normalize(sale.namaAlkes)) ??
      'Belum diklasifikasikan';
    ensureCategory(category);
    const row = categories.get(category)!;
    row.unit += sale.jumlah;
    row.revenue += sale.totalHarga;
    row.soldProducts.add(produkCocokDenganSale(sale, produk)?.id ?? sale.kodeSKU ?? sale.namaAlkes);
  });

  const rows = Array.from(categories.entries())
    .map(([category, row]) => ({ category, ...row }))
    .sort((a, b) => a.unit - b.unit || a.revenue - b.revenue);
  const kategoriTerlaris = rows[rows.length - 1];
  const hasCatalog = produk.length > 0;
  const hasSalesCoverage = recentSales.length > 0 || riwayat.length > 0;
  const periode = labelPeriode(recentSales, riwayat);
  const tidakTerjual = hasSalesCoverage ? produk.filter((item) => {
    const category = categories.get(item.kategori);
    return category && !category.soldProducts.has(item.id);
  }) : [];
  return {
    id: 'category-demand',
    pilar: 'Performa Produk & Varian (SKU)',
    nama: 'Produk terlaris & kategori kurang laku',
    deskripsi: 'Mengurutkan produk dan kategori berdasarkan unit/nilai; penetapan produk tanpa transaksi hanya dilakukan jika data penjualan tersedia.',
    status: rows.length
      ? recentSales.length || riwayat.length ? 'tersedia' : 'parsial'
      : 'belum-tersedia',
    alasan: periode + (hasCatalog
      ? hasSalesCoverage
        ? 'Kategori bersumber dari master Product Catalog; penjualan dipadankan lewat SKU, ID, atau nama produk.'
        : 'Master Product Catalog tersedia, tetapi belum ada sumber penjualan untuk menyimpulkan produk tidak laku.'
      : rows.length
        ? 'Kategori bersumber dari riwayat penjualan; master katalog belum tersedia untuk menampilkan kategori nol.'
        : 'Perlu master katalog produk atau riwayat penjualan.'),
    baris: [
      ...(hasSalesCoverage && kategoriTerlaris?.unit
        ? [{
            label: 'Kategori terlaris',
            value: kategoriTerlaris.category,
            detail: `${formatAngka(kategoriTerlaris.unit)} unit • ${formatRupiah(kategoriTerlaris.revenue)}`
          }]
        : []),
      ...rows.map((row) => ({
        label: row.category,
        value: hasSalesCoverage ? `${formatAngka(row.unit)} unit` : 'Belum ada data',
        detail: hasSalesCoverage
          ? `${formatRupiah(row.revenue)} • ${row.soldProducts.size} dari ${Math.max(row.products.size, row.soldProducts.size)} produk master terjual`
          : `${row.products.size} produk master • sumber penjualan belum tersedia`,
        nilaiGrafik: row.revenue,
        unitGrafik: row.unit
      })),
      ...tidakTerjual.map((item) => ({
        label: `Tidak terjual: ${item.nama}${item.kodeSKU ? ` • ${item.kodeSKU}` : ''}`,
        value: '0 unit',
        detail: `${item.kategori} • belum ada transaksi yang dipadankan dalam periode analisis`
      }))
    ]
  };
}

function hitungMargin(sales: readonly AnalyticSale[]): AnalyticMetric {
  const bySku = new Map<string, { nama: string; revenue: number; cost: number; promo: number }>();
  sales.filter(PENJUALAN_VALID).forEach((sale) => {
    if (!nilaiValid(sale.hppSatuan) || !nilaiValid(sale.biayaPromosi)) return;
    const key = skuPenjualan(sale);
    const sebelum = bySku.get(key) ?? { nama: namaSku(sale), revenue: 0, cost: 0, promo: 0 };
    bySku.set(key, {
      nama: sebelum.nama,
      revenue: sebelum.revenue + sale.totalHarga,
      cost: sebelum.cost + sale.hppSatuan! * sale.jumlah,
      promo: sebelum.promo + sale.biayaPromosi!
    });
  });
  const rows = Array.from(bySku.values())
    .map((row) => ({ ...row, margin: row.revenue - row.cost - row.promo }))
    .sort((a, b) => b.margin - a.margin);
  const available = rows.length > 0;
  return {
    id: 'margin',
    pilar: 'Performa Produk & Varian (SKU)',
    nama: 'Margin kotor setelah diskon & promosi',
    deskripsi: 'Pendapatan bersih dikurangi HPP dan biaya promosi yang dicatat pada transaksi.',
    status: available ? 'tersedia' : 'belum-tersedia',
    alasan: available ? 'Hanya transaksi dengan HPP dan biaya promosi yang masuk perhitungan.' : 'Belum ada HPP dan biaya promosi per SKU; angka margin tidak dibuat dari asumsi.',
    baris: rows.map((row) => ({
      label: row.nama,
      value: formatRupiah(row.margin),
      detail: `Margin ${formatPersen(row.revenue > 0 ? (row.margin / row.revenue) * 100 : 0)}`
    }))
  };
}

function hitungKecepatan(
  sales: readonly AnalyticSale[],
  riwayat: readonly RiwayatPenjualanBulanan[],
  stok: readonly AnalyticInventory[]
): AnalyticMetric {
  const monthsInHistory = bulanRiwayat(riwayat);
  const monthlySales = sales.filter(
    (sale) => PENJUALAN_VALID(sale) && !monthsInHistory.has(idBulan(sale.tanggalPesanan))
  );
  const recentMonths = Array.from(new Set([
    ...riwayat.map((row) => row.bulan),
    ...monthlySales.map((sale) => idBulan(sale.tanggalPesanan))
  ])).sort().slice(-3);
  const byProduct = new Map<string, { nama: string; unit: number; sku?: string }>();
  riwayat.filter((row) => recentMonths.includes(row.bulan)).forEach((row) => {
    const sebelum = byProduct.get(row.namaAlkes) ?? { nama: row.namaAlkes, unit: 0 };
    byProduct.set(row.namaAlkes, { ...sebelum, unit: sebelum.unit + row.unitTerjual });
  });
  monthlySales.filter((sale) => recentMonths.includes(idBulan(sale.tanggalPesanan))).forEach((sale) => {
    const key = skuPenjualan(sale);
    const sebelum = byProduct.get(key) ?? { nama: namaSku(sale), unit: 0, sku: sale.kodeSKU };
    byProduct.set(key, { ...sebelum, unit: sebelum.unit + sale.jumlah });
  });
  const rows = Array.from(byProduct.values())
    .map((row) => {
      const stokCocok = stok.filter((item) =>
        row.sku ? item.kodeSKU === row.sku : item.namaAlkes === row.nama
      );
      const jumlahStok = stokCocok.reduce((sum, item) => sum + item.stokTersedia, 0);
      const unitPerMinggu = row.unit / Math.max((recentMonths.length * 30.44) / 7, 1);
      return { ...row, jumlahStok, unitPerMinggu, mingguStok: unitPerMinggu > 0 ? jumlahStok / unitPerMinggu : 0 };
    })
    .filter((row) => row.jumlahStok > 0)
    .sort((a, b) => b.unitPerMinggu - a.unitPerMinggu);
  const usedHistory = riwayat.some((row) => recentMonths.includes(row.bulan));
  const status = !rows.length ? 'belum-tersedia' : usedHistory ? 'parsial' : 'tersedia';
  return {
    id: 'velocity',
    pilar: 'Performa Produk & Varian (SKU)',
    nama: 'Product velocity & cakupan stok',
    deskripsi: 'Rata-rata unit terjual per minggu dibanding stok bebas yang cocok dengan SKU atau nama produk.',
    status,
    alasan: !rows.length
      ? 'Perlu penjualan pada periode terbaru dan stok yang dapat dipadankan.'
      : usedHistory
        ? 'Menggabungkan riwayat bulanan dan transaksi di luar periode riwayat; bagian riwayat belum memiliki SKU.'
        : 'Dihitung dari transaksi 3 bulan terbaru dan stok bebas.',
    baris: rows.map((row) => ({
      label: row.nama,
      value: `${formatAngka(row.unitPerMinggu)} unit/minggu`,
      detail: `${formatAngka(row.jumlahStok)} unit stok • cakupan ${formatAngka(row.mingguStok)} minggu`
    }))
  };
}

function hitungCannibalization(sales: readonly AnalyticSale[]): AnalyticMetric {
  const bulan = Array.from(new Set(sales.filter(PENJUALAN_VALID).map((sale) => idBulan(sale.tanggalPesanan)))).sort();
  const before = new Set(bulan.slice(-12, -6));
  const after = new Set(bulan.slice(-6));
  const families = new Map<string, Map<string, { nama: string; before: number; after: number }>>();
  sales.filter((sale) => PENJUALAN_VALID(sale) && sale.produkId && sale.kodeSKU).forEach((sale) => {
    const family = families.get(sale.produkId!) ?? new Map();
    const sku = family.get(sale.kodeSKU!) ?? { nama: sale.kodeSKU!, before: 0, after: 0 };
    if (before.has(idBulan(sale.tanggalPesanan))) sku.before += sale.jumlah;
    if (after.has(idBulan(sale.tanggalPesanan))) sku.after += sale.jumlah;
    family.set(sale.kodeSKU!, sku);
    families.set(sale.produkId!, family);
  });
  const insights = Array.from(families.entries())
    .filter(([, skus]) => skus.size > 1)
    .flatMap(([familyId, skus]) => {
      const rows = Array.from(skus.entries()).map(([sku, row]) => ({ sku, ...row }));
      const beforeTotal = rows.reduce((sum, row) => sum + row.before, 0);
      const afterTotal = rows.reduce((sum, row) => sum + row.after, 0);
      if (!beforeTotal || !afterTotal) return [];
      return rows.map((row) => ({
        familyId,
        ...row,
        deltaShare:
          (afterTotal > 0 ? row.after / afterTotal : 0) -
          (beforeTotal > 0 ? row.before / beforeTotal : 0)
      }));
    })
    .sort((a, b) => a.deltaShare - b.deltaShare);
  return {
    id: 'cannibalization',
    pilar: 'Performa Produk & Varian (SKU)',
    nama: 'Perubahan pangsa antarvarian',
    deskripsi: 'Membandingkan pangsa unit per SKU pada dua periode 6 bulan; perubahan pangsa adalah sinyal, bukan bukti sebab-akibat.',
    status: insights.length && bulan.length >= 12 ? 'tersedia' : 'belum-tersedia',
    alasan: insights.length && bulan.length >= 12 ? 'Dibandingkan antarvarian dalam keluarga produk yang sama.' : 'Perlu minimal 12 bulan data dan beberapa SKU yang terhubung ke produk induk.',
    baris: insights.map((row) => ({
      label: `${row.familyId} • ${row.sku}`,
      value: `${row.deltaShare >= 0 ? '+' : ''}${formatPersen(row.deltaShare * 100)} pangsa`,
      detail: `${formatAngka(row.before)} → ${formatAngka(row.after)} unit`
    }))
  };
}

function hitungKanal(sales: readonly AnalyticSale[]): AnalyticMetric {
  const byChannel = new Map<string, { orders: Set<string>; revenue: number; units: number }>();
  sales.filter(PENJUALAN_VALID).forEach((sale) => {
    const channel = sale.kanalMarketing || sale.jalurPenjualan || 'Kanal tidak dicatat';
    const sebelum = byChannel.get(channel) ?? { orders: new Set<string>(), revenue: 0, units: 0 };
    sebelum.orders.add(sale.nomorPesanan);
    sebelum.revenue += sale.totalHarga;
    sebelum.units += sale.jumlah;
    byChannel.set(channel, sebelum);
  });
  const rows = Array.from(byChannel.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  return {
    id: 'channels',
    pilar: 'Pelanggan & Kanal Penjualan',
    nama: 'Performa kanal penjualan',
    deskripsi: 'Nilai dan jumlah pesanan dikelompokkan berdasarkan kanal atau jalur penjualan yang dicatat.',
    status: rows.length ? 'tersedia' : 'belum-tersedia',
    alasan: rows.length ? 'Sumber kanal mengikuti data Sales Order.' : 'Belum ada transaksi dengan informasi kanal.',
    baris: rows.map(([channel, row]) => ({
      label: channel,
      value: formatRupiah(row.revenue),
      detail: `${row.orders.size} pesanan • ${formatAngka(row.units)} unit`
    }))
  };
}

function hitungRetention(sales: readonly AnalyticSale[]): AnalyticMetric {
  const pelanggan = new Map<string, Set<string>>();
  sales.filter((sale) => PENJUALAN_VALID(sale) && sale.pelangganId).forEach((sale) => {
    const orders = pelanggan.get(sale.pelangganId!) ?? new Set<string>();
    orders.add(sale.nomorPesanan);
    pelanggan.set(sale.pelangganId!, orders);
  });
  const total = pelanggan.size;
  const repeat = Array.from(pelanggan.values()).filter((orders) => orders.size > 1).length;
  return {
    id: 'retention',
    pilar: 'Pelanggan & Kanal Penjualan',
    nama: 'Repeat order & retention pelanggan',
    deskripsi: 'Persentase pelanggan dengan lebih dari satu Sales Order dalam data yang dianalisis.',
    status: total ? (total > 1 ? 'tersedia' : 'parsial') : 'belum-tersedia',
    alasan: total ? 'Hanya pelanggan yang memiliki ID pada Sales Order yang dihitung.' : 'ID pelanggan belum tertaut ke transaksi penjualan.',
    baris: total
      ? [
          { label: 'Customer repeat order', value: formatPersen((repeat / total) * 100), detail: `${repeat} dari ${total} pelanggan` },
          { label: 'Pelanggan dianalisis', value: formatAngka(total), detail: `${sales.filter((sale) => PENJUALAN_VALID(sale)).length} baris transaksi` }
        ]
      : []
  };
}

function hitungBasket(sales: readonly AnalyticSale[]): AnalyticMetric {
  const orders = new Map<string, { revenue: number; skus: Set<string> }>();
  sales.filter(PENJUALAN_VALID).forEach((sale) => {
    const order = orders.get(sale.nomorPesanan) ?? { revenue: 0, skus: new Set<string>() };
    order.revenue += sale.totalHarga;
    order.skus.add(skuPenjualan(sale));
    orders.set(sale.nomorPesanan, order);
  });
  const nilaiPesanan = Array.from(orders.values());
  const pesananBundel = nilaiPesanan.filter((order) => order.skus.size > 1);
  const totalRevenue = nilaiPesanan.reduce((sum, order) => sum + order.revenue, 0);
  return {
    id: 'basket',
    pilar: 'Pelanggan & Kanal Penjualan',
    nama: 'AOV & produk dalam satu keranjang',
    deskripsi: 'AOV adalah nilai penjualan per nomor pesanan; basket membutuhkan beberapa SKU pada pesanan yang sama.',
    status: nilaiPesanan.length ? (pesananBundel.length ? 'tersedia' : 'parsial') : 'belum-tersedia',
    alasan: !nilaiPesanan.length ? 'Belum ada nomor pesanan yang dapat dianalisis.' : pesananBundel.length ? 'Keranjang dihitung dari beberapa SKU dengan nomor pesanan yang sama.' : 'AOV tersedia, tetapi belum ada pesanan multi-SKU untuk analisis bundling.',
    baris: nilaiPesanan.length
      ? [
          { label: 'Average Order Value', value: formatRupiah(totalRevenue / nilaiPesanan.length), detail: `${nilaiPesanan.length} pesanan` },
          { label: 'Pesanan multi-SKU', value: formatAngka(pesananBundel.length), detail: `${formatPersen((pesananBundel.length / nilaiPesanan.length) * 100)} dari seluruh pesanan` },
          ...Array.from(
            pesananBundel.reduce((baskets, order) => {
              const key = Array.from(order.skus).sort().join(' + ');
              baskets.set(key, (baskets.get(key) ?? 0) + 1);
              return baskets;
            }, new Map<string, number>()),
            ([basket, count]) => ({ label: basket, value: `${formatAngka(count)} pesanan`, detail: 'kombinasi SKU bersama' })
          )
        ]
      : []
  };
}

function hitungSensitivitasHarga(sales: readonly AnalyticSale[]): AnalyticMetric {
  const estimates = korelasiHargaUnit(sales);
  return {
    id: 'price-sensitivity',
    pilar: 'Pasar, Harga & Tender',
    nama: 'Sensitivitas harga terhadap volume',
    deskripsi: 'Elastisitas observasional dari perubahan harga bersih dan unit terjual per SKU; bukan estimasi kausal.',
    status: estimates.length ? 'tersedia' : 'belum-tersedia',
    alasan: estimates.length ? 'Memerlukan minimal 4 titik bulanan dan variasi harga per SKU.' : 'Belum cukup periode transaksi dengan harga dan volume yang bervariasi.',
    baris: estimates.map((row) => ({
      label: row.sku,
      value: `Elastisitas ${formatAngka(row.elasticity)}`,
      detail: `${row.points} bulan • nilai negatif berarti harga dan volume bergerak berlawanan`
    }))
  };
}

function hitungTender(
  tender: readonly AnalyticTender[],
  demoReasons?: readonly { alasan: string; jumlah: number }[],
  adaTanggalTidakTersedia = false
): AnalyticMetric {
  const menang = tender.filter((row) => row.status === 'Dimenangkan').length;
  const kalah = tender.filter((row) => row.status === 'Kalah').length;
  const reasons = demoReasons?.length
    ? demoReasons
    : Array.from(
        tender.reduce((counts, row) => {
          if (row.status === 'Kalah' && row.alasanKalah) counts.set(row.alasanKalah, (counts.get(row.alasanKalah) ?? 0) + 1);
          return counts;
        }, new Map<string, number>()),
        ([alasan, jumlah]) => ({ alasan, jumlah })
      );
  return {
    id: 'tender-win-loss',
    pilar: 'Pasar, Harga & Tender',
    nama: 'Win/loss tender & alasan',
    deskripsi: 'Menghitung hasil tender dan merangkum alasan kekalahan yang sudah dicatat.',
    status: tender.length ? (reasons.length && !adaTanggalTidakTersedia ? 'tersedia' : 'parsial') : 'belum-tersedia',
    alasan: !tender.length
      ? 'Belum ada data tender pada periode ini.'
      : adaTanggalTidakTersedia
        ? 'Sebagian data tender tidak memiliki tanggal sehingga tidak dapat dipastikan masuk ke periode pilihan.'
        : reasons.length
          ? 'Status dan alasan hasil tender tersedia pada periode pilihan.'
          : 'Status tender tersedia; alasan kekalahan belum dicatat.',
    baris: tender.length
      ? [
          { label: 'Dimenangkan', value: formatAngka(menang) },
          { label: 'Kalah', value: formatAngka(kalah) },
          ...reasons.map((row) => ({ label: row.alasan, value: formatAngka(row.jumlah), detail: 'alasan kekalahan' }))
        ]
      : []
  };
}

function hitungMarketShare(data?: AnalyticSupportData['marketTrend']): AnalyticMetric {
  return {
    id: 'market-share',
    pilar: 'Pasar, Harga & Tender',
    nama: 'Market share proxy',
    deskripsi: 'Membandingkan pertumbuhan penjualan dengan tren pencarian atau transaksi kategori pasar.',
    status: data?.length ? 'tersedia' : 'belum-tersedia',
    alasan: data?.length ? 'Menggunakan data tren pasar yang disediakan.' : 'Belum ada integrasi atau impor data tren marketplace/kategori eksternal.',
    baris: (data ?? []).map((row) => ({
      label: row.kategori,
      value: `Penjualan ${row.pertumbuhanPenjualanPersen >= 0 ? '+' : ''}${formatPersen(row.pertumbuhanPenjualanPersen)}`,
      detail: `Tren pencarian/pasar ${row.pertumbuhanPasarPersen >= 0 ? '+' : ''}${formatPersen(row.pertumbuhanPasarPersen)}`
    }))
  };
}

function hitungRoas(kampanye: readonly AnalyticCampaign[], adaTanggalTidakTersedia = false): AnalyticMetric {
  const valid = kampanye.filter((row) => row.biaya > 0 && row.nilaiKonversi >= 0);
  const hasKategori = valid.every((row) => Boolean(row.kategori));
  return {
    id: 'campaign-roas',
    pilar: 'Efektivitas Promosi & Akuisisi',
    nama: 'ROAS kampanye',
    deskripsi: 'Nilai konversi tercatat dibagi realisasi biaya kampanye; tanpa atribusi SKU, angka ini adalah proksi tingkat kampanye.',
    status: valid.length ? (hasKategori && !adaTanggalTidakTersedia ? 'tersedia' : 'parsial') : 'belum-tersedia',
    alasan: !valid.length
      ? 'Perlu realisasi biaya dan nilai konversi kampanye pada periode ini.'
      : adaTanggalTidakTersedia
        ? 'Sebagian kampanye tidak memiliki tanggal sehingga tidak dapat dipastikan masuk ke periode pilihan.'
        : hasKategori
          ? 'Kampanye memiliki pengelompokan kategori pada periode pilihan.'
          : 'Data biaya dan konversi tersedia, tetapi atribusi kategori/SKU belum lengkap.',
    baris: valid.map((row) => ({
      label: row.kategori ? `${row.nama} • ${row.kategori}` : row.nama,
      value: `${formatAngka(row.nilaiKonversi / row.biaya)}x`,
      detail: `${formatRupiah(row.nilaiKonversi)} konversi / ${formatRupiah(row.biaya)} biaya`
    }))
  };
}

function hitungKonversi(pageTraffic?: AnalyticSupportData['pageTraffic']): AnalyticMetric {
  return {
    id: 'page-conversion',
    pilar: 'Efektivitas Promosi & Akuisisi',
    nama: 'Conversion rate halaman produk',
    deskripsi: 'Pesanan dibagi kunjungan halaman produk untuk mendeteksi traffic tinggi dengan konversi rendah.',
    status: pageTraffic?.some((row) => row.kunjungan > 0) ? 'tersedia' : 'belum-tersedia',
    alasan: pageTraffic?.length ? 'Menggunakan data kunjungan dan pesanan halaman produk.' : 'Belum ada event analytics kunjungan halaman dan pembelian.',
    baris: (pageTraffic ?? []).filter((row) => row.kunjungan > 0).map((row) => ({
      label: row.namaProduk,
      value: formatPersen((row.pesanan / row.kunjungan) * 100),
      detail: `${formatAngka(row.pesanan)} pesanan / ${formatAngka(row.kunjungan)} kunjungan • ${row.kodeSKU}`
    }))
  };
}

function hitungKedaluwarsa(stok: readonly AnalyticInventory[], tanggalAcuan: string): AnalyticMetric {
  const batas = tanggalBatas(tanggalAcuan, -6);
  const nearExpiry = stok
    .filter((row) => row.tanggalKedaluwarsa && row.tanggalKedaluwarsa <= batas && row.stokTersedia > 0)
    .sort((a, b) => (a.tanggalKedaluwarsa ?? '').localeCompare(b.tanggalKedaluwarsa ?? ''));
  const totalUnit = nearExpiry.reduce((sum, row) => sum + row.stokTersedia, 0);
  return {
    id: 'expiry',
    pilar: 'Parameter Khusus Alkes',
    nama: 'Stok mendekati/kedaluwarsa',
    deskripsi: 'Batch dengan kedaluwarsa dalam 6 bulan ke depan atau sudah lewat, berdasarkan stok yang masih tersedia.',
    status: stok.some((row) => row.tanggalKedaluwarsa) ? 'tersedia' : 'belum-tersedia',
    alasan: stok.some((row) => row.tanggalKedaluwarsa) ? 'Sinyal H-6 bulan dihitung dari tanggal hari ini.' : 'Tanggal kedaluwarsa batch belum tersedia.',
    baris: [
      { label: 'Batch perlu ditindaklanjuti', value: formatAngka(nearExpiry.length), detail: `${formatAngka(totalUnit)} unit` },
      ...nearExpiry.map((row) => ({
        label: `${row.namaAlkes} • ${row.kodeSKU ?? 'tanpa SKU'}`,
        value: formatAngka(row.stokTersedia) + ' unit',
        detail: `Kedaluwarsa ${row.tanggalKedaluwarsa}`
      }))
    ]
  };
}

function hitungIzin(izin: readonly AnalyticLicense[], tanggalAcuan: string): AnalyticMetric {
  const batas = tanggalBatas(tanggalAcuan, -6);
  const segeraBerakhir = izin.filter((row) => row.tanggalKedaluwarsa && row.tanggalKedaluwarsa <= batas);
  const counts = new Map<string, number>();
  izin.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
  return {
    id: 'license',
    pilar: 'Parameter Khusus Alkes',
    nama: 'Status izin edar AKD/AKL',
    deskripsi: 'Menghitung status izin edar dan menandai izin yang kedaluwarsa atau mendekati tanggal berakhir.',
    status: izin.length ? 'tersedia' : 'belum-tersedia',
    alasan: izin.length ? 'Mengikuti master Izin Edar alkes.' : 'Belum ada data izin edar.',
    baris: [
      ...Array.from(counts.entries()).map(([status, jumlah]) => ({ label: status, value: formatAngka(jumlah), detail: 'izin edar' })),
      { label: 'Kedaluwarsa / ≤6 bulan', value: formatAngka(segeraBerakhir.length), detail: 'perlu tinjauan regulasi' },
      ...segeraBerakhir.map((row) => ({
        label: `${row.namaAlkes} • ${row.jenis ?? 'AKD/AKL'}`,
        value: row.status,
        detail: `${row.nomorIzinEdar} • ${row.tanggalKedaluwarsa}`
      }))
    ]
  };
}

function hitungYoY(
  sales: readonly AnalyticSale[],
  riwayat: readonly RiwayatPenjualanBulanan[]
): AnalyticMetric {
  const monthly = dataBulanGabungan(sales, riwayat);
  const months = Array.from(monthly.keys()).sort();
  if (months.length < 24) {
    return {
      id: 'seasonality',
      pilar: 'Parameter Khusus Alkes',
      nama: 'Musiman & tren year-on-year',
      deskripsi: 'Membandingkan unit dan nilai penjualan pada dua periode 12 bulan yang setara.',
      status: 'belum-tersedia',
      alasan: `Perlu 24 bulan data bulanan; saat ini tersedia ${months.length} bulan.`,
      baris: []
    };
  }
  const current = months.slice(-12);
  const previous = months.slice(-24, -12);
  const currentUnits = current.reduce((sum, month) => sum + (monthly.get(month)?.unit ?? 0), 0);
  const previousUnits = previous.reduce((sum, month) => sum + (monthly.get(month)?.unit ?? 0), 0);
  const currentValue = current.reduce((sum, month) => sum + (monthly.get(month)?.nilai ?? 0), 0);
  const previousValue = previous.reduce((sum, month) => sum + (monthly.get(month)?.nilai ?? 0), 0);
  const pct = (now: number, before: number) => before > 0 ? ((now - before) / before) * 100 : 0;
  return {
    id: 'seasonality',
    pilar: 'Parameter Khusus Alkes',
    nama: 'Musiman & tren year-on-year',
    deskripsi: 'Membandingkan unit dan nilai penjualan pada dua periode 12 bulan yang setara.',
    status: 'tersedia',
    alasan: `Periode ${previous[0]}–${previous[11]} dibanding ${current[0]}–${current[11]}.`,
    baris: [
      { label: 'Perubahan unit YoY', value: `${pct(currentUnits, previousUnits) >= 0 ? '+' : ''}${formatPersen(pct(currentUnits, previousUnits))}` },
      { label: 'Perubahan nilai YoY', value: `${pct(currentValue, previousValue) >= 0 ? '+' : ''}${formatPersen(pct(currentValue, previousValue))}` }
    ]
  };
}

function hitungKlasifikasi(sales: readonly AnalyticSale[], stok: readonly AnalyticInventory[]): AnalyticMetric {
  const classes = new Map<string, { stok: number; revenue: number }>();
  stok.forEach((row) => {
    const key = row.tipeProduk;
    if (!key) return;
    const before = classes.get(key) ?? { stok: 0, revenue: 0 };
    classes.set(key, { ...before, stok: before.stok + row.stokTersedia });
  });
  sales.filter((row) => PENJUALAN_VALID(row) && row.tipeProduk).forEach((sale) => {
    const key = sale.tipeProduk!;
    const before = classes.get(key) ?? { stok: 0, revenue: 0 };
    classes.set(key, { ...before, revenue: before.revenue + sale.totalHarga });
  });
  return {
    id: 'classification',
    pilar: 'Parameter Khusus Alkes',
    nama: 'Consumables vs equipment',
    deskripsi: 'Membandingkan stok menurut jalur inventaris dan, bila tersedia, nilai penjualan per klasifikasi.',
    status: classes.size ? (sales.some((row) => row.tipeProduk) ? 'tersedia' : 'parsial') : 'belum-tersedia',
    alasan: classes.size ? sales.some((row) => row.tipeProduk) ? 'Data penjualan klasifikasi tersedia.' : 'Klasifikasi hanya diturunkan dari jalur inventaris A/B; penjualan belum terpetakan.' : 'Belum ada data jalur inventaris atau tipe produk.',
    baris: Array.from(classes.entries()).map(([type, row]) => ({
      label: type,
      value: `${formatAngka(row.stok)} unit stok`,
      detail: `Nilai penjualan ${formatRupiah(row.revenue)}`
    }))
  };
}

export function hitungAnalitikMarketing(data: DataAnalitik, periode?: PeriodeAnalitik): AnalyticMetric[] {
  const { tanggalAcuan, sales, riwayat, kampanye, tender } = dataDalamPeriode(data, periode);
  const source = data.dukungan;
  return [
    hitungPareto(sales, riwayat, data.produk),
    hitungKategori(sales, data.produk, riwayat),
    hitungMargin(sales),
    hitungKecepatan(sales, riwayat, data.stok),
    hitungCannibalization(sales),
    hitungKanal(sales),
    hitungRetention(sales),
    hitungBasket(sales),
    hitungSensitivitasHarga(sales),
    hitungTender(tender, source?.tenderLossReasons, data.tender.some((row) => !row.tanggal)),
    hitungMarketShare(source?.marketTrend),
    hitungRoas(kampanye, data.kampanye.some((row) => !row.tanggal)),
    hitungKonversi(source?.pageTraffic),
    hitungKedaluwarsa(data.stok, tanggalAcuan),
    hitungIzin(data.izin, tanggalAcuan),
    hitungYoY(sales, riwayat),
    hitungKlasifikasi(sales, data.stok)
  ];
}
