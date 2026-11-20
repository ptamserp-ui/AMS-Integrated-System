import type {
  AnalyticCampaign,
  AnalyticInventory,
  AnalyticProduct,
  AnalyticSale,
  AnalyticSupportData,
  AnalyticTender
} from '../utils/salesMarketingAnalytics';

const PRODUK = [
  {
    sku: 'DEMO-GLUCO-A',
    family: 'DEMO-FAMILY-GLUCO',
    nama: 'Glukometer Klinik Prima - Generasi A',
    kategori: 'Diagnostik In Vitro',
    tipe: 'Consumables' as const,
    harga: 185000,
    hpp: 99000,
    unitDasar: 24,
    kanal: 'Marketplace Tokopedia',
    customerIndex: 0
  },
  {
    sku: 'DEMO-GLUCO-B',
    family: 'DEMO-FAMILY-GLUCO',
    nama: 'Glukometer Klinik Prima - Generasi B',
    kategori: 'Diagnostik In Vitro',
    tipe: 'Consumables' as const,
    harga: 219000,
    hpp: 112000,
    unitDasar: 5,
    kanal: 'Marketplace Shopee',
    customerIndex: 1
  },
  {
    sku: 'DEMO-STRIP-25',
    family: 'DEMO-FAMILY-STRIP',
    nama: 'Strip Tes Glukosa 25T',
    kategori: 'Diagnostik In Vitro',
    tipe: 'Consumables' as const,
    harga: 78000,
    hpp: 39000,
    unitDasar: 62,
    kanal: 'Distributor',
    customerIndex: 2
  },
  {
    sku: 'DEMO-GLOVE-S',
    family: 'DEMO-FAMILY-GLOVE',
    nama: 'Sarung Tangan Nitril Medis - Ukuran S',
    kategori: 'Non Elektromedik Non Steril',
    tipe: 'Consumables' as const,
    harga: 58000,
    hpp: 27000,
    unitDasar: 80,
    kanal: 'Marketplace Shopee',
    customerIndex: 3
  },
  {
    sku: 'DEMO-GLOVE-M',
    family: 'DEMO-FAMILY-GLOVE',
    nama: 'Sarung Tangan Nitril Medis - Ukuran M',
    kategori: 'Non Elektromedik Non Steril',
    tipe: 'Consumables' as const,
    harga: 58000,
    hpp: 27000,
    unitDasar: 96,
    kanal: 'Distributor',
    customerIndex: 4
  },
  {
    sku: 'DEMO-MONITOR-10',
    family: 'DEMO-FAMILY-MONITOR',
    nama: 'Patient Monitor Multi-Parameter - Layar 10 inci',
    kategori: 'Elektromedik Non Radiasi',
    tipe: 'Equipment' as const,
    harga: 48500000,
    hpp: 33700000,
    unitDasar: 3,
    kanal: 'e-Katalog LKPP',
    customerIndex: 5
  },
  {
    sku: 'DEMO-MONITOR-12',
    family: 'DEMO-FAMILY-MONITOR',
    nama: 'Patient Monitor Multi-Parameter - Layar 12 inci',
    kategori: 'Elektromedik Non Radiasi',
    tipe: 'Equipment' as const,
    harga: 62500000,
    hpp: 41800000,
    unitDasar: 1,
    kanal: 'Tender RS Pemerintah',
    customerIndex: 6
  }
];

const PELANGGAN = ['PLG-001', 'PLG-002', 'PLG-003', 'PLG-004', 'PLG-005', 'PLG-006', 'PLG-007', 'PLG-008'];
const BULAN = Array.from({ length: 24 }, (_, index) => {
  const date = new Date(Date.UTC(2024, 10 + index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
});

function unitTerjual(productIndex: number, monthIndex: number) {
  const produk = PRODUK[productIndex];
  if (produk.sku === 'DEMO-GLUCO-A') return Math.max(4, Math.round(produk.unitDasar - monthIndex * 0.7));
  if (produk.sku === 'DEMO-GLUCO-B') return monthIndex < 9 ? 0 : Math.round(3 + (monthIndex - 9) * 1.8);
  if (produk.sku === 'DEMO-MONITOR-10') return Math.max(1, Math.round(3 + monthIndex * 0.15));
  if (produk.sku === 'DEMO-MONITOR-12') return monthIndex < 8 ? 0 : Math.max(1, Math.round(1 + (monthIndex - 8) * 0.14));
  const seasonal = monthIndex % 6 === 4 ? 1.25 : monthIndex % 6 === 1 ? 0.85 : 1;
  return Math.max(1, Math.round(produk.unitDasar * seasonal));
}

export const PENJUALAN_ANALITIK_DEMO: AnalyticSale[] = BULAN.flatMap((bulan, monthIndex) =>
  PRODUK.flatMap((produk, productIndex) => {
    const units = unitTerjual(productIndex, monthIndex);
    if (units === 0) return [];
    const diskonPersen = [0, 0.03, 0.05, 0.08][(monthIndex + productIndex) % 4];
    const diskonNilai = Math.round(produk.harga * units * diskonPersen);
    const nominalOrder = `DEMO-${bulan.replace('-', '')}-${produk.family}`;
    const isBundle = produk.family === 'DEMO-FAMILY-GLUCO' || produk.family === 'DEMO-FAMILY-STRIP';
    const customerId = isBundle
      ? PELANGGAN[monthIndex % PELANGGAN.length]
      : PELANGGAN[(produk.customerIndex + monthIndex) % PELANGGAN.length];
    const nomorPesanan = isBundle
      ? `DEMO-${bulan.replace('-', '')}-BUNDLE-${customerId}`
      : `${nominalOrder}-${produk.sku}`;
    const jalurPenjualan = produk.kanal.startsWith('e-Katalog')
      ? 'e-Katalog LKPP'
      : produk.kanal.startsWith('Tender')
        ? 'Tender RS Pemerintah'
        : 'Klinik & Laboratorium';
    const tanggalPesanan = `${bulan}-${String(8 + ((monthIndex + productIndex) % 18)).padStart(2, '0')}`;
    return [{
      id: `DEMO-SO-${bulan}-${produk.sku}`,
      nomorPesanan,
      namaAlkes: produk.nama,
      produkId: produk.family,
      kodeSKU: produk.sku,
      kategoriProduk: produk.kategori,
      tanggalPesanan,
      jumlah: units,
      totalHarga: produk.harga * units - diskonNilai,
      pelangganId: customerId,
      jalurPenjualan,
      kanalMarketing: produk.kanal,
      statusKirim: 'Diterima Fasyankes',
      hargaSatuan: produk.harga,
      diskonNilai,
      hppSatuan: produk.hpp,
      biayaPromosi: Math.round(produk.harga * units * (monthIndex % 3 === 0 ? 0.025 : 0.01)),
      tipeProduk: produk.tipe
    }];
  })
);

export const PRODUK_ANALITIK_DEMO: AnalyticProduct[] = [
  ...Array.from(
    new Map(
      PENJUALAN_ANALITIK_DEMO.map((sale) => [
        sale.kodeSKU,
        {
          id: sale.produkId ?? sale.kodeSKU ?? sale.namaAlkes,
          nama: sale.namaAlkes,
          kategori: sale.kategoriProduk ?? 'Tidak diklasifikasikan',
          kodeSKU: sale.kodeSKU
        }
      ])
    ).values()
  ),
  {
    id: 'DEMO-PRODUCT-UNSOLD',
    nama: 'Mobile X-Ray Digital Portabel (Belum Terjual)',
    kategori: 'Elektromedik Radiasi',
    kodeSKU: 'DEMO-XRAY-UNSOLD'
  }
];

export const STOK_ANALITIK_DEMO: AnalyticInventory[] = [
  { kodeSKU: 'DEMO-GLUCO-A', namaAlkes: PRODUK[0].nama, stokTersedia: 38, tanggalKedaluwarsa: '2027-02-15', tipeProduk: 'Consumables' },
  { kodeSKU: 'DEMO-GLUCO-B', namaAlkes: PRODUK[1].nama, stokTersedia: 68, tanggalKedaluwarsa: '2027-07-20', tipeProduk: 'Consumables' },
  { kodeSKU: 'DEMO-STRIP-25', namaAlkes: PRODUK[2].nama, stokTersedia: 420, tanggalKedaluwarsa: '2027-04-30', tipeProduk: 'Consumables' },
  { kodeSKU: 'DEMO-GLOVE-S', namaAlkes: PRODUK[3].nama, stokTersedia: 640, tanggalKedaluwarsa: '2027-09-10', tipeProduk: 'Consumables' },
  { kodeSKU: 'DEMO-GLOVE-M', namaAlkes: PRODUK[4].nama, stokTersedia: 780, tanggalKedaluwarsa: '2027-12-05', tipeProduk: 'Consumables' },
  { kodeSKU: 'DEMO-MONITOR-10', namaAlkes: PRODUK[5].nama, stokTersedia: 7, tanggalKedaluwarsa: '2031-06-01', tipeProduk: 'Equipment' },
  { kodeSKU: 'DEMO-MONITOR-12', namaAlkes: PRODUK[6].nama, stokTersedia: 4, tanggalKedaluwarsa: '2031-08-01', tipeProduk: 'Equipment' }
];

export const KAMPANYE_ANALITIK_DEMO: AnalyticCampaign[] = [
  { nama: 'Bundling Glukometer & Strip', biaya: 18000000, nilaiKonversi: 75600000, kategori: 'Diagnostik In Vitro', tanggal: '2026-03-15' },
  { nama: 'Promo Sarung Tangan Medis', biaya: 12500000, nilaiKonversi: 48200000, kategori: 'Non Elektromedik Non Steril', tanggal: '2026-06-20' },
  { nama: 'Demo Patient Monitor', biaya: 32000000, nilaiKonversi: 125000000, kategori: 'Elektromedik Non Radiasi', tanggal: '2026-10-10' }
];

export const TENDER_ANALITIK_DEMO: AnalyticTender[] = [
  { status: 'Dimenangkan', tanggal: '2026-02-01' },
  { status: 'Dimenangkan', tanggal: '2026-04-15' },
  { status: 'Kalah', alasanKalah: 'Kalah harga', tanggal: '2026-05-01' },
  { status: 'Kalah', alasanKalah: 'Kalah spesifikasi teknis', tanggal: '2026-08-20' },
  { status: 'Kalah', alasanKalah: 'Stok tidak tersedia', tanggal: '2026-10-05' }
];

export const DUKUNGAN_ANALITIK_DEMO: AnalyticSupportData = {
  marketTrend: [
    { kategori: 'Diagnostik In Vitro', pertumbuhanPasarPersen: 14, pertumbuhanPenjualanPersen: 21 },
    { kategori: 'Non Elektromedik Non Steril', pertumbuhanPasarPersen: 8, pertumbuhanPenjualanPersen: 4 },
    { kategori: 'Elektromedik Non Radiasi', pertumbuhanPasarPersen: 11, pertumbuhanPenjualanPersen: 16 }
  ],
  pageTraffic: [
    { kodeSKU: 'DEMO-GLUCO-A', namaProduk: PRODUK[0].nama, kunjungan: 4200, pesanan: 168 },
    { kodeSKU: 'DEMO-STRIP-25', namaProduk: PRODUK[2].nama, kunjungan: 2800, pesanan: 196 },
    { kodeSKU: 'DEMO-GLOVE-S', namaProduk: PRODUK[3].nama, kunjungan: 3500, pesanan: 91 },
    { kodeSKU: 'DEMO-MONITOR-10', namaProduk: PRODUK[5].nama, kunjungan: 980, pesanan: 31 }
  ],
  tenderLossReasons: [
    { alasan: 'Kalah harga', jumlah: 1 },
    { alasan: 'Kalah spesifikasi teknis', jumlah: 1 },
    { alasan: 'Stok tidak tersedia', jumlah: 1 }
  ]
};
