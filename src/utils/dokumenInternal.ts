import type {
  DetailHargaPoUmum,
  DokumenInternal,
  ItemAlkesDokumenInternal,
  JenisDokumenInternal,
  KategoriDokumenInternal,
  LangkahPersetujuanDokumen,
  RevisiDokumenInternal,
  SkemaJenisDokumen,
  StatusDokumenInternal,
  TingkatPeranDokumen,
  UserRole
} from '../types';
import type { SesiLogin } from './autentikasi';
import type { DokumenQuotation } from './quotationPdf';

export const KUNCI_DOKUMEN_INTERNAL = 'dokumen_internal_v1';
export const KUNCI_IDENTITAS_DOKUMEN_INTERNAL = 'dokumen_internal_identitas_v1';

export const KATEGORI_DOKUMEN_META: Record<
  KategoriDokumenInternal,
  { label: string; warnaAksen: string; deskripsi: string }
> = {
  komersial_penawaran: {
    label: 'Komersial & Penawaran',
    warnaAksen: '#0f766e',
    deskripsi: 'Quotation / Surat Penawaran Harga Alkes B2B, e-Katalog LKPP, dan Tender Fasyankes.'
  },
  operasional_logistik: {
    label: 'Operasional & Logistik',
    warnaAksen: '#b45309',
    deskripsi: 'Permintaan material, Surat Jalan (DO), BAST, Kartu Stok, Suhu, serta Retur/Recall CDAKB.'
  },
  pengadaan: {
    label: 'Pengadaan',
    warnaAksen: '#1d4ed8',
    deskripsi: 'Purchase Requisition (PR), Purchase Order (PO) Alkes, PO Umum (Non-Alkes), dan Evaluasi Supplier.'
  },
  teknis_after_sales: {
    label: 'Teknis & After-Sales',
    warnaAksen: '#0f766e',
    deskripsi: 'Permintaan Unit Demo, Berita Acara Instalasi & Uji Fungsi, serta Maintenance & Kalibrasi.'
  },
  keuangan_umum: {
    label: 'Keuangan & Umum',
    warnaAksen: '#4338ca',
    deskripsi: 'Cash Advance, Reimbursement biaya operasional, serta Formulir Administrasi HRD/Personil.'
  },
  mutu_qa: {
    label: 'Mutu (QA)',
    warnaAksen: '#be123c',
    deskripsi: 'Non-Conformance Report (NCR) dan Corrective & Preventive Action (CAPA) ISO 13485.'
  }
};

export const LABEL_TINGKAT_PERAN: Record<TingkatPeranDokumen, string> = {
  staff: 'Staff / Pelaksana',
  kepala_gudang: 'Kepala Gudang',
  pjt: 'Penanggung Jawab Teknis (PJT)',
  manager: 'Manager Divisi / QA',
  direktur: 'Direktur / Eksekutif'
};

export const STATUS_DOKUMEN_URUT: StatusDokumenInternal[] = [
  'Draft',
  'Submitted',
  'Reviewed',
  'Approved',
  'Rejected',
  'Closed'
];

export interface MatriksHakDokumen {
  tingkat: TingkatPeranDokumen;
  labelPeran: string;
  bisaBuatDraft: boolean;
  bisaSubmit: boolean;
  bisaReview: boolean;
  bisaApproveFinal: boolean;
  bisaReject: boolean;
  bisaClose: boolean;
  bisaRevisi: boolean;
  bisaExportPdf: boolean;
  cakupanKategori: string;
}

export const MATRIKS_RBAC_DOKUMEN: MatriksHakDokumen[] = [
  {
    tingkat: 'staff',
    labelPeran: 'Staff (MedRep / QC / Teknisi / Purchasing / HR)',
    bisaBuatDraft: true,
    bisaSubmit: true,
    bisaReview: false,
    bisaApproveFinal: false,
    bisaReject: false,
    bisaClose: false,
    bisaRevisi: true,
    bisaExportPdf: true,
    cakupanKategori: 'Semua draft dokumen unit kerja terkait'
  },
  {
    tingkat: 'kepala_gudang',
    labelPeran: 'Kepala Gudang',
    bisaBuatDraft: true,
    bisaSubmit: true,
    bisaReview: true,
    bisaApproveFinal: false,
    bisaReject: true,
    bisaClose: false,
    bisaRevisi: true,
    bisaExportPdf: true,
    cakupanKategori: 'Review tahap 1 Operasional, Logistik & Penerimaan Barang'
  },
  {
    tingkat: 'pjt',
    labelPeran: 'Penanggung Jawab Teknis (PJT)',
    bisaBuatDraft: true,
    bisaSubmit: true,
    bisaReview: true,
    bisaApproveFinal: true,
    bisaReject: true,
    bisaClose: true,
    bisaRevisi: true,
    bisaExportPdf: true,
    cakupanKategori: 'Otoritas penuh kepatuhan CDAKB, NIE AKL/AKD, Recall, NCR & CAPA'
  },
  {
    tingkat: 'manager',
    labelPeran: 'Manager (QA / Sales / Produksi / IT)',
    bisaBuatDraft: true,
    bisaSubmit: true,
    bisaReview: true,
    bisaApproveFinal: true,
    bisaReject: true,
    bisaClose: true,
    bisaRevisi: true,
    bisaExportPdf: true,
    cakupanKategori: 'Review & approval dokumen departemen, QA, pengadaan & keuangan operasional'
  },
  {
    tingkat: 'direktur',
    labelPeran: 'Direktur / Eksekutif Sistem',
    bisaBuatDraft: true,
    bisaSubmit: true,
    bisaReview: true,
    bisaApproveFinal: true,
    bisaReject: true,
    bisaClose: true,
    bisaRevisi: true,
    bisaExportPdf: true,
    cakupanKategori: 'Approval akhir PO bernilai tinggi, Cash Advance besar & penutupan arsip'
  }
];

export function petakanPeranKeTingkat(role: UserRole): TingkatPeranDokumen {
  switch (role) {
    case 'pjt':
      return 'pjt';
    case 'kepala_gudang':
      return 'kepala_gudang';
    case 'developer_it_support':
      return 'direktur';
    case 'qa_manager':
    case 'sales_manager':
    case 'manajer_produksi':
    case 'it_admin':
    case 'auditor_internal':
      return 'manager';
    default:
      return 'staff';
  }
}

export function hakAksesPeranDokumen(role: UserRole, sesi?: Pick<SesiLogin, 'permissions'> | null): MatriksHakDokumen {
  const tingkat = petakanPeranKeTingkat(role);
  const dasar = MATRIKS_RBAC_DOKUMEN.find((m) => m.tingkat === tingkat) || MATRIKS_RBAC_DOKUMEN[0];
  if (role === 'auditor_internal') {
    return {
      ...dasar,
      labelPeran: 'Auditor Internal ISO 13485 (Baca & Audit)',
      bisaBuatDraft: false,
      bisaSubmit: false,
      bisaReview: false,
      bisaApproveFinal: false,
      bisaReject: false,
      bisaClose: false,
      bisaRevisi: false,
      bisaExportPdf: true,
      cakupanKategori: 'Audit baca-saja lintas seluruh dokumen & cetak PDF'
    };
  }
  if (sesi?.permissions?.['dokumen-internal']) {
    const perms = sesi.permissions['dokumen-internal'];
    return {
      ...dasar,
      bisaBuatDraft: dasar.bisaBuatDraft && (perms.includes('create') || perms.includes('update')),
      bisaSubmit: dasar.bisaSubmit && (perms.includes('create') || perms.includes('update')),
      bisaReview: dasar.bisaReview && (perms.includes('approve') || perms.includes('update')),
      bisaApproveFinal: dasar.bisaApproveFinal && perms.includes('approve'),
      bisaReject: dasar.bisaReject && (perms.includes('approve') || perms.includes('update')),
      bisaClose: dasar.bisaClose && perms.includes('approve'),
      bisaRevisi: dasar.bisaRevisi && (perms.includes('create') || perms.includes('update')),
      bisaExportPdf: perms.includes('export') || perms.includes('view')
    };
  }
  return dasar;
}

export const SKEMA_DOKUMEN_INTERNAL: SkemaJenisDokumen[] = [
  // ==================== 0. KOMERSIAL & PENAWARAN ====================
  {
    jenis: 'quotation',
    kategori: 'komersial_penawaran',
    nama: 'Quotation (Surat Penawaran Harga)',
    kodeNomor: 'QT',
    kodeFormIso: 'FRM-COM-01',
    versiForm: 'Rev.03',
    departemenDefault: 'Sales & Komersial B2B',
    deskripsi:
      'Surat Penawaran Harga resmi alkes & BMHP untuk fasyankes/tender LKPP dengan harga, diskon, PPN 11%, NIE Kemenkes RI, dan approval QR berjenjang.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: true,
    labelPihakTerkait: 'Kepada Yth. (Instansi / Fasyankes)',
    fields: [
      {
        key: 'jalurPengadaan',
        label: 'Jalur Pengadaan',
        type: 'select',
        options: ['e-Katalog LKPP', 'Tender Terbuka / LPSE', 'Penunjukan Langsung', 'B2B Swasta / Klinik'],
        defaultValue: 'e-Katalog LKPP',
        required: true
      },
      {
        key: 'berlakuHingga',
        label: 'Masa Berlaku Penawaran Hingga',
        type: 'date',
        required: true
      },
      {
        key: 'pakaiPpn',
        label: 'Kenakan Pajak PPN',
        type: 'boolean',
        defaultValue: true
      },
      {
        key: 'persenPpn',
        label: 'Tarif PPN (%)',
        type: 'number',
        defaultValue: 11
      },
      {
        key: 'diskonGlobalRp',
        label: 'Diskon Global Tambahan (Rp)',
        type: 'currency',
        defaultValue: 0
      },
      {
        key: 'biayaLainRp',
        label: 'Biaya Pengiriman / Instalasi (Rp)',
        type: 'currency',
        defaultValue: 0
      },
      {
        key: 'labelBiayaLain',
        label: 'Label Biaya Tambahan',
        type: 'text',
        defaultValue: 'Biaya Pengiriman & Instalasi',
        fullWidth: true
      },
      {
        key: 'syaratKetentuan',
        label: 'Syarat & Ketentuan Penawaran',
        type: 'textarea',
        defaultValue:
          '1. Pembayaran TOP 30 Hari setelah Berita Acara Serah Terima (BAST) & Uji Fungsi.\n2. Garansi resmi unit 1 tahun termasuk kalibrasi awal & pelatihan operator.\n3. Seluruh produk dijamin keaslian serta memiliki Izin Edar Kemenkes RI aktif.',
        required: true,
        fullWidth: true
      },
      {
        key: 'catatanTambahan',
        label: 'Catatan Khusus Penawaran',
        type: 'textarea',
        placeholder: 'Catatan pengiriman, jadwal presentasi/demo unit, atau dokumen pendukung LKPP...',
        fullWidth: true
      }
    ],
    tahapPersetujuan: [
      {
        urutan: 1,
        labelTahap: 'Review Kepatuhan NIE & Skema Harga oleh Manager / PJT',
        peranWajib: ['manager', 'pjt'],
        targetStatusSetelahAksi: 'Reviewed'
      },
      {
        urutan: 2,
        labelTahap: 'Pengesahan Resmi Quotation oleh Manager / Direktur / PJT',
        peranWajib: ['manager', 'direktur', 'pjt'],
        targetStatusSetelahAksi: 'Approved'
      }
    ]
  },

  // ==================== 1. OPERASIONAL & LOGISTIK ====================
  {
    jenis: 'material_requisition',
    kategori: 'operasional_logistik',
    nama: 'Material Requisition (MR)',
    kodeNomor: 'MR',
    kodeFormIso: 'FRM-LOG-01',
    versiForm: 'Rev.02',
    departemenDefault: 'Operasional & Gudang',
    deskripsi: 'Permintaan pengeluaran barang / bahan alkes dari gudang utama sesuai alokasi FEFO.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Unit / Pemohon Pengambilan',
    fields: [
      { key: 'gudangAsal', label: 'Gudang Asal Pengeluaran', type: 'select', options: ['Gudang Utama Cikarang', 'Cold Room 2–8°C', 'Gudang Karantina / Sampel'], required: true },
      { key: 'tujuanPenggunaan', label: 'Keperluan / Proyek / Order', type: 'text', placeholder: 'Contoh: Pemenuhan SO RSUP Persahabatan', required: true },
      { key: 'tanggalDibutuhkan', label: 'Target Tanggal Siap Ambil', type: 'date', required: true },
      { key: 'catatanPengeluaran', label: 'Instruksi Penyiapan FEFO', type: 'textarea', placeholder: 'Prioritaskan batch ED terpendek minimal sisa shelf life > 12 bulan...', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Stok oleh Kepala Gudang', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Persetujuan Rilis oleh PJT / Manager', peranWajib: ['pjt', 'manager', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'surat_jalan',
    kategori: 'operasional_logistik',
    nama: 'Surat Jalan / Delivery Order (DO)',
    kodeNomor: 'DO',
    kodeFormIso: 'FRM-LOG-02',
    versiForm: 'Rev.03',
    departemenDefault: 'Logistik & Distribusi CDAKB',
    deskripsi: 'Dokumen pengiriman resmi alkes ke fasyankes lengkap dengan nomor batch, NIE, dan verifikasi muat.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Fasyankes / Instansi Tujuan',
    fields: [
      { key: 'nomorSO', label: 'Nomor Referensi SO / Kontrak', type: 'text', placeholder: 'SO/AMS/2026/...', required: true },
      { key: 'metodeKirim', label: 'Armada / Ekspedisi', type: 'select', options: ['Armada Internal Box Berpendingin', 'Ekspedisi Medis Terkualifikasi', 'Kurir Khusus Cold Chain'], required: true },
      { key: 'nomorKendaraan', label: 'No. Polisi / Resi & No. Segel', type: 'text', placeholder: 'B 9412 AMS • Segel #SG-8821' },
      { key: 'suhuMuat', label: 'Suhu Awal Pengiriman (°C)', type: 'text', placeholder: 'Contoh: 20.5°C (Ambient) / 4.2°C (Cool Box)', required: true },
      { key: 'instruksiKirim', label: 'Instruksi Penyerahan di Lokasi', type: 'textarea', placeholder: 'Wajib tanda tangan Farmasi/Logistik RS dan pemeriksaan segel kemasan.', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Pemeriksaan Muat & Batch oleh Kepala Gudang', peranWajib: ['kepala_gudang'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Otorisasi Pelepasan Distribusi oleh PJT', peranWajib: ['pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'bast',
    kategori: 'operasional_logistik',
    nama: 'Berita Acara Serah Terima (BAST)',
    kodeNomor: 'BAST',
    kodeFormIso: 'FRM-LOG-03',
    versiForm: 'Rev.02',
    departemenDefault: 'Distribusi & Layanan Pelanggan',
    deskripsi: 'Bukti serah terima fisik alkes beserta kelengkapan AKL/AKD, CoA, dan kartu garansi kepada penerima.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: true,
    labelPihakTerkait: 'Pejabat Penerima / Fasyankes',
    fields: [
      { key: 'nomorKontrakPo', label: 'Nomor PO / SPK / ID Paket LKPP', type: 'text', placeholder: 'SPK-PPK/2026/...', required: true },
      { key: 'tanggalSerahTerima', label: 'Tanggal Serah Terima Aktual', type: 'date', required: true },
      { key: 'kelengkapanDokumen', label: 'Kelengkapan Dokumen Penyerta', type: 'select', options: ['Lengkap (Faktur + CoA + Manual + NIE)', 'Lengkap + Sertifikat Kalibrasi', 'Bersyarat (Catatan Terlampir)'], required: true },
      { key: 'kondisiBarang', label: 'Hasil Pemeriksaan Fisik di Lokasi', type: 'textarea', placeholder: 'Kemasan utuh, segel aman, nomor batch dan tanggal kedaluwarsa sesuai Surat Jalan.', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Logistik oleh Kepala Gudang', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Pengesahan Resmi oleh Manager / PJT', peranWajib: ['pjt', 'manager', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'kartu_stok',
    kategori: 'operasional_logistik',
    nama: 'Kartu Stok Alkes (Bin Card)',
    kodeNomor: 'KS',
    kodeFormIso: 'FRM-LOG-04',
    versiForm: 'Rev.01',
    departemenDefault: 'Manajemen Persediaan Gudang',
    deskripsi: 'Rekaman fisik mutasi keluar-masuk batch alkes per lokasi rak/bin dengan pemantauan FEFO.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Penanggung Jawab Rak / Bin',
    fields: [
      { key: 'kodeGudangRak', label: 'Zona / Lokasi Rak / Bin', type: 'text', placeholder: 'Zona B • Rak R04-L2', required: true },
      { key: 'syaratSuhuPenyimpanan', label: 'Persyaratan Suhu Label Prinsipal', type: 'select', options: ['Suhu Kamar (15–25°C)', 'Sejuk (8–15°C)', 'Rantai Dingin (2–8°C)'], required: true },
      { key: 'periodeKartu', label: 'Periode Pencatatan', type: 'text', placeholder: 'November 2026', required: true },
      { key: 'selisihOpname', label: 'Catatan Verifikasi Fisik vs Sistem', type: 'textarea', placeholder: 'Tidak ada selisih fisik vs saldo kartu stok digital.', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Rekonsiliasi Harian oleh Kepala Gudang', peranWajib: ['kepala_gudang'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Audit Kepatuhan FEFO oleh PJT / QA', peranWajib: ['pjt', 'manager', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'pemantauan_suhu',
    kategori: 'operasional_logistik',
    nama: 'Form Pemantauan Suhu & Kelembaban',
    kodeNomor: 'SUHU',
    kodeFormIso: 'FRM-LOG-05',
    versiForm: 'Rev.02',
    departemenDefault: 'Cold Chain & Fasilitas Gudang',
    deskripsi: 'Log kontrol suhu & %RH harian ruang simpan alkes / chiller terkalibrasi sesuai Bab III CDAKB.',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Petugas Pemeriksa Area',
    fields: [
      { key: 'areaPenyimpanan', label: 'Area / Ruang / Chiller', type: 'select', options: ['Gudang Utama Ambient (15–25°C)', 'Chiller Reagen 01 (2–8°C)', 'Ruang Karantina & Retur'], required: true },
      { key: 'idSensor', label: 'ID Data Logger & Tgl Kalibrasi Terakhir', type: 'text', placeholder: 'DL-CR01 • Kalibrasi s.d. Mei 2027', required: true },
      { key: 'suhuTercatat', label: 'Suhu Min / Maks Tercatat (°C)', type: 'text', placeholder: 'Min 3.4°C / Maks 5.8°C', required: true },
      { key: 'kelembabanRh', label: 'Kelembaban Relatif (%RH)', type: 'text', placeholder: '52% RH (Standar 40–60%)' },
      { key: 'statusEkskursi', label: 'Terjadi Ekskursi Suhu?', type: 'select', options: ['Normal (Dalam Batas)', 'Peringatan Ringan (< 30 menit)', 'Ekskursi Kritis (Buka NCR)'], required: true },
      { key: 'tindakanSegera', label: 'Catatan Pengamatan & Koreksi', type: 'textarea', placeholder: 'Alarm logger normal, pintu chiller tertutup rapat.', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Harian oleh Kepala Gudang', peranWajib: ['kepala_gudang'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Validasi Kepatuhan CDAKB oleh PJT', peranWajib: ['pjt', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'retur_recall',
    kategori: 'operasional_logistik',
    nama: 'Form Retur / Penarikan Produk (Recall)',
    kodeNomor: 'RET',
    kodeFormIso: 'FRM-LOG-06',
    versiForm: 'Rev.02',
    departemenDefault: 'Karantina & Vigilance CDAKB',
    deskripsi: 'Pencatatan penerimaan produk kembalian pelanggan atau eksekusi recall terkoordinasi dengan PJT.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Pengirim Retur / Fasyankes Terdampak',
    fields: [
      { key: 'jenisPenanganan', label: 'Jenis Kasus', type: 'select', options: ['Retur Komersial / Kelebihan Kirim', 'Produk Rusak / Kemasan Cacat', 'Recall Kelas I/II Kemenkes / Prinsipal'], required: true },
      { key: 'referensiKtd', label: 'No. Laporan KTD / Keluhan / Surat Recall', type: 'text', placeholder: 'KTD/2026/... atau Surat Prinsipal #...' },
      { key: 'lokasiKarantina', label: 'Penempatan Ruang Karantina Terkunci', type: 'text', placeholder: 'Zona Karantina Terkunci K-01', required: true },
      { key: 'rekomendasiDisposisi', label: 'Rekomendasi Disposisi Awal', type: 'select', options: ['Evaluasi QC Ulang', 'Kembalikan ke Prinsipal', 'Pemusnahan Disaksikan PJT/BAPOM'], required: true },
      { key: 'uraianKondisi', label: 'Uraian Alasan Retur / Recall', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Pemeriksaan Fisik Karantina oleh Kepala Gudang', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Keputusan Disposisi Final oleh PJT', peranWajib: ['pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },

  // ==================== 2. PENGADAAN ====================
  {
    jenis: 'purchase_requisition',
    kategori: 'pengadaan',
    nama: 'Purchase Requisition (PR)',
    kodeNomor: 'PR',
    kodeFormIso: 'FRM-PRC-01',
    versiForm: 'Rev.02',
    departemenDefault: 'Perencanaan Stok & Pengadaan',
    deskripsi: 'Pengajuan kebutuhan pembelian alkes atau aset operasional sebelum penerbitan PO resmi.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: true,
    labelPihakTerkait: 'User / Unit Peminta Anggaran',
    fields: [
      { key: 'alasanPengadaan', label: 'Dasar Kebutuhan Pengadaan', type: 'select', options: ['Reorder Point (ROP) Minimum Gudang', 'Pesanan Tender / Kontrak Khusus', 'Kebutuhan Operasional & Kalibrasi'], required: true },
      { key: 'targetTiba', label: 'Target Barang Tiba di Gudang', type: 'date', required: true },
      { key: 'estimasiAnggaran', label: 'Estimasi Pagu Anggaran (Rp)', type: 'currency', placeholder: '25000000' },
      { key: 'justifikasiTeknis', label: 'Justifikasi Spesifikasi & Sisa Stok Saat Ini', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Kebutuhan Stok oleh Kepala Gudang / Manager', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Persetujuan Pengadaan & Izin Edar oleh PJT / Direktur', peranWajib: ['pjt', 'direktur', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'purchase_order',
    kategori: 'pengadaan',
    nama: 'Purchase Order (PO) Internal / Prinsipal',
    kodeNomor: 'PO',
    kodeFormIso: 'FRM-PRC-02',
    versiForm: 'Rev.03',
    departemenDefault: 'Purchasing & Procurement',
    deskripsi: 'Surat pemesanan resmi kepada prinsipal/supplier terkualifikasi dengan syarat CoA, NIE AKL/AKD, dan shelf life.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: true,
    labelPihakTerkait: 'Prinsipal / Pemasok Terpilih',
    fields: [
      { key: 'referensiPR', label: 'Nomor Referensi PR', type: 'text', placeholder: 'PR/AMS/2026/...', required: true },
      { key: 'syaratPembayaran', label: 'Syarat Pembayaran (TOP)', type: 'select', options: ['Cash Before Delivery (CBD)', 'Net 30 Hari setelah BAST', 'Net 45 Hari setelah BAST', 'LC / TT Impor'], required: true },
      { key: 'minShelfLife', label: 'Syarat Minimal Expired Date Saat Tiba', type: 'text', placeholder: 'Minimal 18 bulan sebelum Expired Date', required: true },
      { key: 'syaratRegulasi', label: 'Ketentuan Mutu & Dokumen Wajib', type: 'textarea', placeholder: 'Wajib melampirkan Certificate of Analysis (CoA), salinan AKL/AKD berlaku, dan Packing List per nomor batch.', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Review Teknis & Regulasi AKL/AKD oleh PJT / Manager', peranWajib: ['pjt', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Otorisasi Komitmen Pembelian oleh Direktur / Manager', peranWajib: ['direktur', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'evaluasi_supplier',
    kategori: 'pengadaan',
    nama: 'Form Evaluasi Supplier / Prinsipal',
    kodeNomor: 'EVS',
    kodeFormIso: 'FRM-PRC-03',
    versiForm: 'Rev.02',
    departemenDefault: 'Purchasing & Quality Assurance',
    deskripsi: 'Penilaian kualifikasi berkala pemasok alkes mencakup legalitas CDAKB/CPAKB, ketepatan kirim, dan kualitas batch.',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Nama Pemasok / Prinsipal yang Dievaluasi',
    fields: [
      { key: 'izinPemasok', label: 'Nomor Sertifikat CDAKB / CPAKB / ISO 13485 Pemasok', type: 'text', placeholder: 'FK.01.01/...', required: true },
      { key: 'periodeEvaluasi', label: 'Periode Penilaian', type: 'text', placeholder: 'Semester II 2026', required: true },
      { key: 'skorKualitas', label: 'Skor Mutu & Kelengkapan CoA (0–100)', type: 'number', placeholder: '95', required: true },
      { key: 'skorPengiriman', label: 'Skor Ketepatan Lead Time Kirim (0–100)', type: 'number', placeholder: '90', required: true },
      { key: 'hasilKualifikasi', label: 'Status Kualifikasi Pemasok', type: 'select', options: ['Lulus — Approved Vendor List (AVL)', 'Lulus Bersyarat (Butuh Perbaikan)', 'Ditangguhkan / Tidak Direkomendasikan'], required: true },
      { key: 'catatanAuditVendor', label: 'Ringkasan Temuan & Rekomendasi', type: 'textarea', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Review Pengadaan & Riwayat Kirim oleh Kepala Gudang / Manager', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Pengesahan Approved Vendor List oleh PJT / QA Manager', peranWajib: ['pjt', 'manager', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'purchase_order_umum',
    kategori: 'pengadaan',
    nama: 'Purchase Order (PO) Umum',
    kodeNomor: 'POU',
    kodeFormIso: 'FRM-PRC-04',
    versiForm: 'Rev.01',
    departemenDefault: 'Purchasing & Umum',
    deskripsi: 'Pembelian barang dan jasa di luar kebutuhan alkes (contoh: pembelian komputer, pembayaran hosting website, pembayaran jasa Event Organizer, dll.).',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: true,
    labelPihakTerkait: 'Requested by:',
    fields: [
      {
        key: 'metodePembayaran',
        label: 'Metode Pembayaran',
        type: 'text',
        placeholder: 'Contoh: Transfer Bank BCA / Virtual Account / Kartu Kredit / Tunai',
        fullWidth: true
      }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Review Spesifikasi & Anggaran oleh Manager / PJT', peranWajib: ['manager', 'pjt'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Otorisasi Pembelian Umum oleh Direktur / Manager', peranWajib: ['direktur', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },

  // ==================== 3. TEKNIS & AFTER-SALES ====================
  {
    jenis: 'permintaan_demo',
    kategori: 'teknis_after_sales',
    nama: 'Form Permintaan Unit Demo Alkes',
    kodeNomor: 'DEMO',
    kodeFormIso: 'FRM-TKN-01',
    versiForm: 'Rev.01',
    departemenDefault: 'Sales & Dukungan Aplikasi Klinis',
    deskripsi: 'Peminjaman unit demo elektromedik/alkes ke fasyankes dengan pengawasan serial number dan jadwal kembali.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Fasyankes / Dokter Pemohon Demo',
    fields: [
      { key: 'picSalesTeknisi', label: 'Penanggung Jawab Demo (MedRep / Teknisi)', type: 'text', required: true },
      { key: 'tanggalMulaiDemo', label: 'Tanggal Mulai Demo', type: 'date', required: true },
      { key: 'tanggalEstimasiKembali', label: 'Batas Pengembalian Unit ke Gudang', type: 'date', required: true },
      { key: 'lokasiRuanganRs', label: 'Ruangan Tujuan di RS (IGD / ICU / OK)', type: 'text', placeholder: 'Instalasi Gawat Darurat Lt. 1', required: true },
      { key: 'kelengkapanAksesori', label: 'Daftar Aksesori & Kabel Penyerta', type: 'textarea', fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Pengecekan Kesiapan & Pelepasan Unit oleh Kepala Gudang', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Persetujuan Peminjaman Unit Demo oleh Manager / PJT', peranWajib: ['manager', 'pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'ba_instalasi',
    kategori: 'teknis_after_sales',
    nama: 'Berita Acara Instalasi & Uji Fungsi',
    kodeNomor: 'BA-INST',
    kodeFormIso: 'FRM-TKN-02',
    versiForm: 'Rev.02',
    departemenDefault: 'Teknisi Elektromedik Ber-STR',
    deskripsi: 'Dokumentasi pemasangan alat kesehatan, uji fungsi kelistrikan/parameter klinis, dan pelatihan operator RS.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Fasyankes & Kepala Ruangan / IPSRS',
    fields: [
      { key: 'namaTeknisiStr', label: 'Nama Teknisi Elektromedik & No. STR', type: 'text', placeholder: 'Dian Nugraha • STR 14 02 5 2 1-...', required: true },
      { key: 'lokasiRuangan', label: 'Ruangan Pemasangan di Fasyankes', type: 'text', placeholder: 'Ruang ICU Bed 04', required: true },
      { key: 'hasilUjiFungsi', label: 'Kesimpulan Uji Fungsi & Keamanan Listrik', type: 'select', options: ['Lulus & Laik Pakai Klinis', 'Lulus dengan Catatan Minor', 'Tidak Lulus — Unit Ditahan'], required: true },
      { key: 'jumlahPesertaTraining', label: 'Jumlah Operator / Perawat Terlatih', type: 'number', placeholder: '5' },
      { key: 'catatanTeknisInstalasi', label: 'Parameter Uji Terukur & Keterangan', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Berita Acara oleh Manager Layanan / QA', peranWajib: ['manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Pengesahan Mulai Masa Garansi oleh PJT', peranWajib: ['pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'maintenance_kalibrasi',
    kategori: 'teknis_after_sales',
    nama: 'Form Maintenance & Kalibrasi Berkala',
    kodeNomor: 'MNT',
    kodeFormIso: 'FRM-TKN-03',
    versiForm: 'Rev.02',
    departemenDefault: 'Teknisi Elektromedik & Kalibrasi',
    deskripsi: 'Laporan pemeliharaan preventif/korektif serta kalibrasi berkala sesuai Bab VI CDAKB dan ISO 13485 7.6.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Lokasi Alat / Instansi Pemilik',
    fields: [
      { key: 'jenisPekerjaan', label: 'Jenis Tindakan', type: 'select', options: ['Preventive Maintenance', 'Corrective Maintenance (Perbaikan)', 'Kalibrasi Berkala Tertelusur BPFK'], required: true },
      { key: 'alatUkurStandar', label: 'Alat Ukur Kalibrator & No. Sertifikat', type: 'text', placeholder: 'Fluke ProSim 8 • Cal #FLK-2026-09', required: true },
      { key: 'jadwalBerikutnya', label: 'Jadwal Maintenance / Kalibrasi Berikutnya', type: 'date', required: true },
      { key: 'statusLaik', label: 'Status Kelayakan Operasi', type: 'select', options: ['Laik Pakai (Stiker Hijau)', 'Perlu Penggantian Suku Cadang', 'Karantina / Tidak Laik (Stiker Merah)'], required: true },
      { key: 'rincianTindakan', label: 'Uraian Pengukuran & Penggantian Sparepart', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Review Sertifikat & Deviasi oleh Manager Teknis/QA', peranWajib: ['manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Validasi Akhir oleh PJT', peranWajib: ['pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },

  // ==================== 4. KEUANGAN & UMUM ====================
  {
    jenis: 'cash_advance',
    kategori: 'keuangan_umum',
    nama: 'Form Cash Advance (Kasbon Operasional)',
    kodeNomor: 'CA',
    kodeFormIso: 'FRM-FIN-01',
    versiForm: 'Rev.01',
    departemenDefault: 'Keuangan & Operasional Lapangan',
    deskripsi: 'Pengajuan uang muka dinas, instalasi luar kota, atau operasional lapangan dengan batas LPJ.',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Karyawan Pemohon Dana',
    fields: [
      { key: 'keperluanDana', label: 'Tujuan Perjalanan / Kegiatan', type: 'text', placeholder: 'Kunjungan instalasi & training RSUD Bandung', required: true },
      { key: 'nominalPengajuan', label: 'Total Dana Diajukan (Rp)', type: 'currency', placeholder: '3500000', required: true },
      { key: 'batasLpj', label: 'Batas Waktu Pertanggungjawaban (LPJ)', type: 'date', required: true },
      { key: 'rekeningTujuan', label: 'Bank & Nomor Rekening Penerima', type: 'text', placeholder: 'BCA 5210-xxxx-xx a.n. Pemohon', required: true },
      { key: 'rincianAnggaran', label: 'Rincian Estimasi Biaya', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Pemeriksaan Atasan Langsung / Manager', peranWajib: ['manager', 'kepala_gudang'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Otorisasi Pencairan oleh Direktur / PJT', peranWajib: ['direktur', 'pjt', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'reimbursement',
    kategori: 'keuangan_umum',
    nama: 'Form Reimbursement (Klaim Biaya)',
    kodeNomor: 'RMB',
    kodeFormIso: 'FRM-FIN-02',
    versiForm: 'Rev.01',
    departemenDefault: 'Keuangan & Akuntansi',
    deskripsi: 'Pengajuan penggantian biaya operasional lapangan yang telah dibayarkan karyawan dilengkapi bukti kuitansi.',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Karyawan Pengaju Klaim',
    fields: [
      { key: 'kategoriBiaya', label: 'Kategori Pengeluaran', type: 'select', options: ['Transportasi & BBM', 'Akomodasi Dinas Luar Kota', 'Biaya Pengiriman Darurat', 'Alat Tulis / Operasional Gudang'], required: true },
      { key: 'totalKlaim', label: 'Total Nilai Klaim (Rp)', type: 'currency', placeholder: '1250000', required: true },
      { key: 'jumlahBukti', label: 'Jumlah Lampiran Kuitansi Asli', type: 'number', placeholder: '4', required: true },
      { key: 'rekeningPenerima', label: 'Rekening Pembayaran', type: 'text', required: true },
      { key: 'keteranganKlaim', label: 'Daftar Tanggal & Uraian Pengeluaran', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Kelengkapan Nota oleh Manager', peranWajib: ['manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Persetujuan Pembayaran oleh Direktur / PJT', peranWajib: ['direktur', 'pjt', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'form_hrd',
    kategori: 'keuangan_umum',
    nama: 'Formulir Administrasi HRD & Kompetensi',
    kodeNomor: 'HRD',
    kodeFormIso: 'FRM-HRD-01',
    versiForm: 'Rev.02',
    departemenDefault: 'HRD & General Affairs',
    deskripsi: 'Pengajuan pelatihan CDAKB/CPAKB, pengurusan STR/SIK personil, mutasi, maupun izin administrasi HRD.',
    wajibTraceabilityAlkes: false,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Karyawan / Personil Terkait',
    fields: [
      { key: 'jenisPermohonan', label: 'Jenis Pengajuan HRD', type: 'select', options: ['Usulan Pelatihan CDAKB / ISO 13485', 'Perpanjangan STR / SIPA / SIK', 'Permintaan Penambahan Personil', 'Cuti Khusus / Tugas Luar Kantor'], required: true },
      { key: 'tanggalEfektif', label: 'Tanggal Efektif / Pelaksanaan', type: 'date', required: true },
      { key: 'estimasiBiayaHrd', label: 'Estimasi Biaya Sertifikasi/Pelatihan (Rp)', type: 'currency', placeholder: '0' },
      { key: 'uraianHrd', label: 'Uraian Kebutuhan & Dampak Kepatuhan CDAKB', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Review HRD / Manager Divisi', peranWajib: ['manager', 'kepala_gudang'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Persetujuan Akhir oleh PJT / Direktur', peranWajib: ['pjt', 'direktur', 'manager'], targetStatusSetelahAksi: 'Approved' }
    ]
  },

  // ==================== 5. MUTU (QA) ====================
  {
    jenis: 'ncr',
    kategori: 'mutu_qa',
    nama: 'Non-Conformance Report (NCR)',
    kodeNomor: 'NCR',
    kodeFormIso: 'FRM-QA-01',
    versiForm: 'Rev.03',
    departemenDefault: 'Quality Assurance (QA)',
    deskripsi: 'Laporan ketidaksesuaian produk alkes, dokumen izin edar, penyimpanan suhu, atau proses distribusi CDAKB.',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'Area / Pemasok / Pihak Penemu',
    fields: [
      { key: 'sumberTemuan', label: 'Sumber Ketidaksesuaian', type: 'select', options: ['Inspeksi QC Inbound', 'Pemantauan Gudang / Suhu', 'Keluhan Fasyankes / PMS', 'Audit Internal ISO 13485'], required: true },
      { key: 'klasifikasiNcr', label: 'Tingkat Keparahan (Severity)', type: 'select', options: ['Minor', 'Major', 'Critical (Wajib Hold Stok & CAPA)'], required: true },
      { key: 'klausulTerkait', label: 'Klausul CDAKB / ISO 13485 Terkait', type: 'text', placeholder: 'CDAKB Bab IV / ISO 13485:2016 8.3', required: true },
      { key: 'deskripsiTemuan', label: 'Fakta Objektif Ketidaksesuaian', type: 'textarea', required: true, fullWidth: true },
      { key: 'koreksiSegera', label: 'Tindakan Penahanan / Koreksi Segera (Containment)', type: 'textarea', required: true, fullWidth: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Investigasi & Penahanan Stok oleh Kepala Gudang / QA Manager', peranWajib: ['kepala_gudang', 'manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Pengesahan Disposisi Mutu oleh PJT / QA Manager', peranWajib: ['pjt', 'manager', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  },
  {
    jenis: 'capa',
    kategori: 'mutu_qa',
    nama: 'Corrective & Preventive Action (CAPA)',
    kodeNomor: 'CAPA',
    kodeFormIso: 'FRM-QA-02',
    versiForm: 'Rev.03',
    departemenDefault: 'Quality Assurance & Regulatory Affairs',
    deskripsi: 'Tindakan perbaikan akar masalah dan pencegahan terulang (ISO 13485 Klausul 8.5.2 & 8.5.3).',
    wajibTraceabilityAlkes: true,
    tampilkanNilaiFinansial: false,
    labelPihakTerkait: 'PIC Penanggung Jawab CAPA',
    fields: [
      { key: 'referensiNcrAudit', label: 'Nomor Referensi NCR / Audit / KTD', type: 'text', placeholder: 'NCR/AMS/2026/...', required: true },
      { key: 'metodeAkarMasalah', label: 'Metode Analisis Akar Masalah', type: 'select', options: ['5-Why Analysis', 'Fishbone (Ishikawa)', 'FMEA Risiko'], required: true },
      { key: 'akarMasalah', label: 'Hasil Analisis Akar Masalah (Root Cause)', type: 'textarea', required: true, fullWidth: true },
      { key: 'tindakanKorektif', label: 'Rencana Tindakan Korektif (Corrective)', type: 'textarea', required: true, fullWidth: true },
      { key: 'tindakanPreventif', label: 'Rencana Tindakan Preventif Sistemik', type: 'textarea', required: true, fullWidth: true },
      { key: 'targetSelesai', label: 'Batas Waktu Penyelesaian & Verifikasi Efektivitas', type: 'date', required: true }
    ],
    tahapPersetujuan: [
      { urutan: 1, labelTahap: 'Verifikasi Efektivitas Tindakan oleh QA Manager', peranWajib: ['manager'], targetStatusSetelahAksi: 'Reviewed' },
      { urutan: 2, labelTahap: 'Penutupan & Pengesahan Regulasi CAPA oleh PJT', peranWajib: ['pjt', 'direktur'], targetStatusSetelahAksi: 'Approved' }
    ]
  }
];

export function ambilSkemaDokumen(jenis: JenisDokumenInternal): SkemaJenisDokumen {
  return SKEMA_DOKUMEN_INTERNAL.find((s) => s.jenis === jenis) || SKEMA_DOKUMEN_INTERNAL[0];
}

export function buatNomorDokumenOtomatis(
  jenis: JenisDokumenInternal,
  daftarAda: Pick<DokumenInternal, 'nomorDokumen' | 'jenisDokumen'>[],
  tanggalIso?: string
): string {
  const skema = ambilSkemaDokumen(jenis);
  const tgl = tanggalIso ? new Date(tanggalIso) : new Date();
  const valid = !Number.isNaN(tgl.getTime()) ? tgl : new Date();
  const tahun = valid.getFullYear();
  const bulan = String(valid.getMonth() + 1).padStart(2, '0');
  const prefix = `${skema.kodeNomor}/AMS/${tahun}/${bulan}/`;

  let maxUrut = 0;
  for (const doc of daftarAda) {
    if (doc.nomorDokumen.startsWith(prefix)) {
      const buntut = doc.nomorDokumen.slice(prefix.length);
      const angka = parseInt(buntut, 10);
      if (Number.isFinite(angka) && angka > maxUrut) {
        maxUrut = angka;
      }
    }
  }
  const urutBaru = maxUrut + 1;
  return `${prefix}${String(urutBaru).padStart(3, '0')}`;
}

export function buatRingkasanHashDokumen(seed: {
  nomorDokumen: string;
  jenisDokumen: string;
  revisiKe: number;
  status: string;
  waktu: string;
  aktor: string;
}): string {
  const bahan = `${seed.nomorDokumen}|${seed.jenisDokumen}|R${seed.revisiKe}|${seed.status}|${seed.waktu}|${seed.aktor}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bahan.length; i++) {
    const ch = bahan.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const segA = (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const segB = (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `AMS-${segA}-${segB}`;
}

export function buatPayloadQrVerifikasi(doc: {
  nomorDokumen: string;
  kodeFormIso: string;
  status: StatusDokumenInternal;
  revisiKe: number;
  sha256Ringkas: string;
  penandatanganUtama?: string;
  ditandatanganiPada?: string;
}): string {
  return JSON.stringify({
    sistem: 'AMS-CDAKB',
    no: doc.nomorDokumen,
    form: doc.kodeFormIso,
    status: doc.status,
    rev: doc.revisiKe,
    sig: doc.sha256Ringkas,
    by: doc.penandatanganUtama || 'Menunggu Pengesahan',
    at: doc.ditandatanganiPada || '-'
  });
}

export function buatAlurPersetujuanAwal(jenis: JenisDokumenInternal): LangkahPersetujuanDokumen[] {
  const skema = ambilSkemaDokumen(jenis);
  return skema.tahapPersetujuan.map((tahap) => ({
    urutan: tahap.urutan,
    labelTahap: tahap.labelTahap,
    peranWajib: [...tahap.peranWajib],
    status: 'Menunggu'
  }));
}

export function buatDataDinamisAwal(jenis: JenisDokumenInternal): Record<string, string | number | boolean> {
  const skema = ambilSkemaDokumen(jenis);
  const out: Record<string, string | number | boolean> = {};
  const today = new Date().toISOString().split('T')[0];
  for (const field of skema.fields) {
    if (field.defaultValue !== undefined) {
      out[field.key] = field.defaultValue;
    } else if (field.type === 'select' && field.options?.length) {
      out[field.key] = field.options[0];
    } else if (field.type === 'date') {
      out[field.key] = today;
    } else if (field.type === 'boolean') {
      out[field.key] = false;
    } else if (field.type === 'number' || field.type === 'currency') {
      out[field.key] = '';
    } else {
      out[field.key] = '';
    }
  }
  return out;
}

export function buatDokumenInternalBaru(params: {
  jenis: JenisDokumenInternal;
  daftarAda: Pick<DokumenInternal, 'nomorDokumen' | 'jenisDokumen'>[];
  namaPembuat: string;
  peranPembuat: UserRole;
  tanggalIso?: string;
}): DokumenInternal {
  const skema = ambilSkemaDokumen(params.jenis);
  const tanggal = params.tanggalIso || new Date().toISOString().split('T')[0];
  const nomorDokumen = buatNomorDokumenOtomatis(params.jenis, params.daftarAda, tanggal);
  const nowIso = new Date().toISOString();
  const sha = buatRingkasanHashDokumen({
    nomorDokumen,
    jenisDokumen: skema.jenis,
    revisiKe: 0,
    status: 'Draft',
    waktu: nowIso,
    aktor: params.namaPembuat
  });

  return {
    id: `doc-int-${crypto.randomUUID().slice(0, 12)}`,
    nomorDokumen,
    kodeFormIso: skema.kodeFormIso,
    versiForm: skema.versiForm,
    kategori: skema.kategori,
    jenisDokumen: skema.jenis,
    judul: `${skema.nama} — Baru`,
    departemen: skema.departemenDefault,
    tanggalDokumen: tanggal,
    tanggalBerlaku: tanggal,
    status: 'Draft',
    revisiKe: 0,
    prioritas: skema.kategori === 'mutu_qa' ? 'Kritis CDAKB' : 'Normal',
    referensiDokumen: '',
    ringkasan: skema.deskripsi,
    pihakTerkait: {
      namaPihak: '',
      instansi: '',
      jabatan: '',
      kontak: '',
      alamat: ''
    },
    dataDinamis: buatDataDinamisAwal(skema.jenis),
    ...(skema.jenis === 'purchase_order_umum'
      ? {
          detailHargaPoUmum: [
            {
              id: `po-det-${crypto.randomUUID().slice(0, 8)}`,
              detail: '',
              harga: 0
            }
          ]
        }
      : {}),
    items: [],
    alurPersetujuan: buatAlurPersetujuanAwal(skema.jenis),
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: nowIso,
        oleh: params.namaPembuat,
        peran: params.peranPembuat,
        aksi: 'Draft Dibuat',
        statusSesudah: 'Draft',
        catatan: `Inisialisasi ${skema.nama} (${skema.kodeFormIso})`
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: sha.slice(4, 12),
      sha256Ringkas: sha,
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen,
        kodeFormIso: skema.kodeFormIso,
        status: 'Draft',
        revisiKe: 0,
        sha256Ringkas: sha
      })
    },
    dibuatOleh: params.namaPembuat,
    dibuatPeran: params.peranPembuat,
    dibuatPada: nowIso,
    diperbaruiOleh: params.namaPembuat,
    diperbaruiPada: nowIso
  };
}

export interface AksiWorkflowTersedia {
  dapatEditKonten: boolean;
  dapatSubmit: boolean;
  dapatReview: boolean;
  dapatApprove: boolean;
  dapatReject: boolean;
  dapatRevisi: boolean;
  dapatClose: boolean;
  tahapAktif?: LangkahPersetujuanDokumen;
  alasanTerkunci?: string;
}

export function evaluasiAksiWorkflow(
  doc: DokumenInternal,
  role: UserRole,
  sesi?: Pick<SesiLogin, 'permissions'> | null
): AksiWorkflowTersedia {
  const hak = hakAksesPeranDokumen(role, sesi);
  const tingkat = petakanPeranKeTingkat(role);
  const isFullExecutive = role === 'pjt' || role === 'developer_it_support';

  if (doc.status === 'Closed') {
    return {
      dapatEditKonten: false,
      dapatSubmit: false,
      dapatReview: false,
      dapatApprove: false,
      dapatReject: false,
      dapatRevisi: false,
      dapatClose: false,
      alasanTerkunci: 'Dokumen berstatus Closed (arsip terkunci permanen untuk integritas audit CDAKB).'
    };
  }

  const langkahReview = doc.alurPersetujuan[0];
  const langkahApprove = doc.alurPersetujuan[doc.alurPersetujuan.length - 1];

  const bolehTahap = (langkah?: LangkahPersetujuanDokumen) => {
    if (!langkah) return false;
    return isFullExecutive || langkah.peranWajib.includes(tingkat);
  };

  if (doc.status === 'Draft') {
    return {
      dapatEditKonten: hak.bisaBuatDraft,
      dapatSubmit: hak.bisaSubmit,
      dapatReview: false,
      dapatApprove: false,
      dapatReject: false,
      dapatRevisi: false,
      dapatClose: false,
      tahapAktif: langkahReview
    };
  }

  if (doc.status === 'Submitted') {
    return {
      dapatEditKonten: false,
      dapatSubmit: false,
      dapatReview: hak.bisaReview && bolehTahap(langkahReview),
      dapatApprove: false,
      dapatReject: hak.bisaReject && bolehTahap(langkahReview),
      dapatRevisi: false,
      dapatClose: false,
      tahapAktif: langkahReview,
      alasanTerkunci: 'Menunggu peninjauan tahap 1 sebelum persetujuan final.'
    };
  }

  if (doc.status === 'Reviewed') {
    return {
      dapatEditKonten: false,
      dapatSubmit: false,
      dapatReview: false,
      dapatApprove: hak.bisaApproveFinal && bolehTahap(langkahApprove),
      dapatReject: hak.bisaReject && bolehTahap(langkahApprove),
      dapatRevisi: false,
      dapatClose: false,
      tahapAktif: langkahApprove,
      alasanTerkunci: 'Dokumen telah ditinjau dan menunggu pengesahan akhir.'
    };
  }

  if (doc.status === 'Approved') {
    return {
      dapatEditKonten: false,
      dapatSubmit: false,
      dapatReview: false,
      dapatApprove: false,
      dapatReject: false,
      dapatRevisi: false,
      dapatClose: hak.bisaClose,
      alasanTerkunci: 'Dokumen telah disetujui resmi dengan QR verifikasi digital.'
    };
  }

  // Rejected
  return {
    dapatEditKonten: false,
    dapatSubmit: false,
    dapatReview: false,
    dapatApprove: false,
    dapatReject: false,
    dapatRevisi: hak.bisaRevisi,
    dapatClose: false,
    alasanTerkunci: 'Dokumen ditolak. Buat revisi baru untuk memperbaiki dan mengajukan ulang.'
  };
}

export function validasiSebelumSubmit(doc: DokumenInternal): string | null {
  if (!doc.judul.trim()) return 'Judul / perihal dokumen wajib diisi sebelum diajukan.';
  const skema = ambilSkemaDokumen(doc.jenisDokumen);
  for (const field of skema.fields) {
    if (!field.required) continue;
    const val = doc.dataDinamis[field.key];
    if (val === undefined || val === null || String(val).trim() === '') {
      return `Kolom wajib "${field.label}" belum diisi.`;
    }
  }
  if (doc.jenisDokumen === 'purchase_order_umum') {
    const groups = ambilDetailHargaPoUmum(doc);
    if (groups.length === 0 || groups.every((g) => !g.detail.trim())) {
      return 'Isi minimal 1 group Detail & Harga pada bagian Spesifikasi Purchase Order (PO) Umum sebelum diajukan.';
    }
    const emptyDetail = groups.find((g) => !g.detail.trim());
    if (emptyDetail) {
      return 'Kolom Detail wajib diisi pada setiap group Detail & Harga di bagian Spesifikasi.';
    }
  }
  if (skema.wajibTraceabilityAlkes && doc.items.length > 0) {
    const perluBatchWajib = doc.jenisDokumen !== 'quotation';
    const invalid = doc.items.find(
      (item) =>
        !item.namaProduk.trim() ||
        !item.nomorIzinEdar.trim() ||
        (perluBatchWajib && !item.nomorBatch.trim())
    );
    if (invalid) {
      return perluBatchWajib
        ? `Ketertelusuran CDAKB wajib diisi lengkap (Nama Alkes, NIE AKL/AKD, dan Nomor Batch) pada item "${invalid.namaProduk || 'tanpa nama'}".`
        : `Nama Alkes dan Nomor Izin Edar (NIE AKL/AKD) wajib diisi pada item "${invalid.namaProduk || 'tanpa nama'}".`;
    }
  }
  return null;
}

export type JenisAksiWorkflow =
  | 'submit'
  | 'review'
  | 'approve'
  | 'reject'
  | 'revisi'
  | 'close';

export function jalankanTransisiWorkflow(
  doc: DokumenInternal,
  aksi: JenisAksiWorkflow,
  aktor: { nama: string; role: UserRole; sesi?: Pick<SesiLogin, 'permissions'> | null },
  catatan = ''
): { ok: true; dokumen: DokumenInternal } | { ok: false; pesan: string } {
  const evaluasi = evaluasiAksiWorkflow(doc, aktor.role, aktor.sesi);
  const nowIso = new Date().toISOString();
  const tingkat = petakanPeranKeTingkat(aktor.role);

  const hasilError = (pesan: string): { ok: false; pesan: string } => ({ ok: false, pesan });

  if (aksi === 'submit') {
    if (!evaluasi.dapatSubmit) return hasilError('Peran Anda tidak diizinkan mengajukan dokumen dari status Draft.');
    const validMsg = validasiSebelumSubmit(doc);
    if (validMsg) return hasilError(validMsg);

    const revisi: RevisiDokumenInternal = {
      revisiKe: doc.revisiKe,
      waktu: nowIso,
      oleh: aktor.nama,
      peran: aktor.role,
      aksi: 'Diajukan',
      statusSebelum: doc.status,
      statusSesudah: 'Submitted',
      catatan: catatan.trim() || 'Dokumen diajukan untuk tahap peninjauan (Review).'
    };
    const nextSha = buatRingkasanHashDokumen({
      nomorDokumen: doc.nomorDokumen,
      jenisDokumen: doc.jenisDokumen,
      revisiKe: doc.revisiKe,
      status: 'Submitted',
      waktu: nowIso,
      aktor: aktor.nama
    });
    return {
      ok: true,
      dokumen: {
        ...doc,
        status: 'Submitted',
        alurPersetujuan: buatAlurPersetujuanAwal(doc.jenisDokumen),
        riwayatRevisi: [revisi, ...doc.riwayatRevisi],
        tandaTanganDigital: {
          ...doc.tandaTanganDigital,
          sha256Ringkas: nextSha,
          qrPayload: buatPayloadQrVerifikasi({
            nomorDokumen: doc.nomorDokumen,
            kodeFormIso: doc.kodeFormIso,
            status: 'Submitted',
            revisiKe: doc.revisiKe,
            sha256Ringkas: nextSha
          })
        },
        diperbaruiOleh: aktor.nama,
        diperbaruiPada: nowIso
      }
    };
  }

  if (aksi === 'review') {
    if (!evaluasi.dapatReview) {
      return hasilError('Hanya peran peninjau yang ditunjuk pada tahap ini yang dapat menandai Reviewed.');
    }
    const sigLangkah = buatRingkasanHashDokumen({
      nomorDokumen: doc.nomorDokumen,
      jenisDokumen: doc.jenisDokumen,
      revisiKe: doc.revisiKe,
      status: 'Reviewed',
      waktu: nowIso,
      aktor: aktor.nama
    });
    const alur = doc.alurPersetujuan.map((l, idx) =>
      idx === 0
        ? {
            ...l,
            status: 'Disetujui' as const,
            disetujuiOleh: aktor.nama,
            peranAktual: aktor.role,
            tingkatAktual: tingkat,
            waktu: nowIso,
            catatan: catatan.trim() || 'Diverifikasi & layak lanjut ke persetujuan final.',
            hashTandaTangan: sigLangkah
          }
        : l
    );
    const revisi: RevisiDokumenInternal = {
      revisiKe: doc.revisiKe,
      waktu: nowIso,
      oleh: aktor.nama,
      peran: aktor.role,
      aksi: 'Ditinjau',
      statusSebelum: 'Submitted',
      statusSesudah: 'Reviewed',
      catatan: catatan.trim() || 'Peninjauan tahap 1 selesai.'
    };
    return {
      ok: true,
      dokumen: {
        ...doc,
        status: 'Reviewed',
        alurPersetujuan: alur,
        riwayatRevisi: [revisi, ...doc.riwayatRevisi],
        tandaTanganDigital: {
          ...doc.tandaTanganDigital,
          sha256Ringkas: sigLangkah,
          qrPayload: buatPayloadQrVerifikasi({
            nomorDokumen: doc.nomorDokumen,
            kodeFormIso: doc.kodeFormIso,
            status: 'Reviewed',
            revisiKe: doc.revisiKe,
            sha256Ringkas: sigLangkah
          })
        },
        diperbaruiOleh: aktor.nama,
        diperbaruiPada: nowIso
      }
    };
  }

  if (aksi === 'approve') {
    if (!evaluasi.dapatApprove) {
      return hasilError('Hanya pejabat berwenang (PJT / Manager / Direktur sesuai matriks) yang dapat menyetujui dokumen berstatus Reviewed.');
    }
    const sigFinal = buatRingkasanHashDokumen({
      nomorDokumen: doc.nomorDokumen,
      jenisDokumen: doc.jenisDokumen,
      revisiKe: doc.revisiKe,
      status: 'Approved',
      waktu: nowIso,
      aktor: aktor.nama
    });
    const alur = doc.alurPersetujuan.map((l, idx) =>
      idx === doc.alurPersetujuan.length - 1
        ? {
            ...l,
            status: 'Disetujui' as const,
            disetujuiOleh: aktor.nama,
            peranAktual: aktor.role,
            tingkatAktual: tingkat,
            waktu: nowIso,
            catatan: catatan.trim() || 'Disetujui resmi dengan tanda tangan digital QR.',
            hashTandaTangan: sigFinal
          }
        : l
    );
    const revisi: RevisiDokumenInternal = {
      revisiKe: doc.revisiKe,
      waktu: nowIso,
      oleh: aktor.nama,
      peran: aktor.role,
      aksi: 'Disetujui',
      statusSebelum: 'Reviewed',
      statusSesudah: 'Approved',
      catatan: catatan.trim() || 'Persetujuan akhir & tanda tangan digital QR diterbitkan.'
    };
    const jabatanUtama = LABEL_TINGKAT_PERAN[tingkat];
    return {
      ok: true,
      dokumen: {
        ...doc,
        status: 'Approved',
        alurPersetujuan: alur,
        riwayatRevisi: [revisi, ...doc.riwayatRevisi],
        tandaTanganDigital: {
          kodeVerifikasi: sigFinal.slice(4, 12),
          sha256Ringkas: sigFinal,
          ditandatanganiPada: nowIso,
          penandatanganUtama: aktor.nama,
          jabatanUtama,
          qrPayload: buatPayloadQrVerifikasi({
            nomorDokumen: doc.nomorDokumen,
            kodeFormIso: doc.kodeFormIso,
            status: 'Approved',
            revisiKe: doc.revisiKe,
            sha256Ringkas: sigFinal,
            penandatanganUtama: aktor.nama,
            ditandatanganiPada: nowIso
          })
        },
        diperbaruiOleh: aktor.nama,
        diperbaruiPada: nowIso
      }
    };
  }

  if (aksi === 'reject') {
    if (!evaluasi.dapatReject) return hasilError('Anda tidak memiliki izin menolak dokumen pada tahap ini.');
    if (!catatan.trim()) return hasilError('Alasan penolakan wajib diisi untuk audit trail CDAKB.');
    const targetIdx = doc.status === 'Submitted' ? 0 : doc.alurPersetujuan.length - 1;
    const alur = doc.alurPersetujuan.map((l, idx) =>
      idx === targetIdx
        ? {
            ...l,
            status: 'Ditolak' as const,
            disetujuiOleh: aktor.nama,
            peranAktual: aktor.role,
            tingkatAktual: tingkat,
            waktu: nowIso,
            catatan: catatan.trim()
          }
        : l
    );
    const revisi: RevisiDokumenInternal = {
      revisiKe: doc.revisiKe,
      waktu: nowIso,
      oleh: aktor.nama,
      peran: aktor.role,
      aksi: 'Ditolak',
      statusSebelum: doc.status,
      statusSesudah: 'Rejected',
      catatan: catatan.trim()
    };
    return {
      ok: true,
      dokumen: {
        ...doc,
        status: 'Rejected',
        alurPersetujuan: alur,
        riwayatRevisi: [revisi, ...doc.riwayatRevisi],
        diperbaruiOleh: aktor.nama,
        diperbaruiPada: nowIso
      }
    };
  }

  if (aksi === 'revisi') {
    if (!evaluasi.dapatRevisi) return hasilError('Dokumen hanya dapat direvisi ulang jika berstatus Rejected.');
    const revBaru = doc.revisiKe + 1;
    const revisi: RevisiDokumenInternal = {
      revisiKe: revBaru,
      waktu: nowIso,
      oleh: aktor.nama,
      peran: aktor.role,
      aksi: 'Revisi Baru',
      statusSebelum: 'Rejected',
      statusSesudah: 'Draft',
      catatan: catatan.trim() || `Membuka Revisi ke-${revBaru} untuk perbaikan.`
    };
    const nextSha = buatRingkasanHashDokumen({
      nomorDokumen: doc.nomorDokumen,
      jenisDokumen: doc.jenisDokumen,
      revisiKe: revBaru,
      status: 'Draft',
      waktu: nowIso,
      aktor: aktor.nama
    });
    return {
      ok: true,
      dokumen: {
        ...doc,
        status: 'Draft',
        revisiKe: revBaru,
        alurPersetujuan: buatAlurPersetujuanAwal(doc.jenisDokumen),
        riwayatRevisi: [revisi, ...doc.riwayatRevisi],
        tandaTanganDigital: {
          kodeVerifikasi: nextSha.slice(4, 12),
          sha256Ringkas: nextSha,
          qrPayload: buatPayloadQrVerifikasi({
            nomorDokumen: doc.nomorDokumen,
            kodeFormIso: doc.kodeFormIso,
            status: 'Draft',
            revisiKe: revBaru,
            sha256Ringkas: nextSha
          })
        },
        diperbaruiOleh: aktor.nama,
        diperbaruiPada: nowIso
      }
    };
  }

  // close
  if (!evaluasi.dapatClose) return hasilError('Hanya dokumen Approved yang dapat ditutup (Closed) oleh pejabat berwenang.');
  const sigClose = doc.tandaTanganDigital.sha256Ringkas;
  const revisi: RevisiDokumenInternal = {
    revisiKe: doc.revisiKe,
    waktu: nowIso,
    oleh: aktor.nama,
    peran: aktor.role,
    aksi: 'Ditutup',
    statusSebelum: 'Approved',
    statusSesudah: 'Closed',
    catatan: catatan.trim() || 'Implementasi selesai dan dokumen dikunci permanen (Closed).'
  };
  return {
    ok: true,
    dokumen: {
      ...doc,
      status: 'Closed',
      riwayatRevisi: [revisi, ...doc.riwayatRevisi],
      tandaTanganDigital: {
        ...doc.tandaTanganDigital,
        qrPayload: buatPayloadQrVerifikasi({
          nomorDokumen: doc.nomorDokumen,
          kodeFormIso: doc.kodeFormIso,
          status: 'Closed',
          revisiKe: doc.revisiKe,
          sha256Ringkas: sigClose,
          penandatanganUtama: doc.tandaTanganDigital.penandatanganUtama,
          ditandatanganiPada: doc.tandaTanganDigital.ditandatanganiPada
        })
      },
      diperbaruiOleh: aktor.nama,
      diperbaruiPada: nowIso
    }
  };
}

function ubahItemKeDetailHargaPoUmum(item: ItemAlkesDokumenInternal, id: string): DetailHargaPoUmum {
  return {
    id,
    detail: [item.namaProduk, `${item.qty || 0} ${item.satuan || 'Unit'}`].filter(Boolean).join(' — '),
    harga: Math.max(0, hitungNilaiTotalItems([item]))
  };
}

export function ambilDetailHargaPoUmum(
  doc: Pick<DokumenInternal, 'detailHargaPoUmum' | 'dataDinamis' | 'items'>
): DetailHargaPoUmum[] {
  if (Array.isArray(doc.detailHargaPoUmum) && doc.detailHargaPoUmum.length > 0) {
    return doc.detailHargaPoUmum.map((g, idx) => ({
      id: g.id || `po-det-${idx + 1}`,
      detail: String(g.detail ?? ''),
      harga: Math.max(0, Math.round(Number(g.harga) || 0))
    }));
  }

  const legacyDetails = String(doc.dataDinamis?.details ?? '').trim();
  const legacyTerms = String(doc.dataDinamis?.syaratPembayaran ?? '').trim();
  const legacyNotes = [
    legacyDetails ? `Spesifikasi sebelumnya: ${legacyDetails}` : '',
    legacyTerms ? `Syarat pembayaran sebelumnya: ${legacyTerms}` : ''
  ].filter(Boolean).join('\n');
  const legacyItems = (doc.items || []).map((item, idx) =>
    ubahItemKeDetailHargaPoUmum(item, item.id || `po-det-legacy-${idx + 1}`)
  );
  if (legacyNotes || legacyItems.length > 0) {
    return [
      ...(legacyNotes ? [{ id: 'po-det-legacy-notes', detail: legacyNotes, harga: 0 }] : []),
      ...legacyItems
    ];
  }

  return [
    {
      id: 'po-det-1',
      detail: '',
      harga: 0
    }
  ];
}

export function hitungSubtotalPoUmum(groups: DetailHargaPoUmum[]): number {
  return groups.reduce((total, g) => total + Math.max(0, Math.round(Number(g.harga) || 0)), 0);
}

export function hitungNilaiTotalItems(items: ItemAlkesDokumenInternal[]): number {
  return items.reduce((total, it) => {
    const kotor = (it.qty || 0) * (it.hargaSatuan || 0);
    const bersih = kotor * (1 - (it.diskonPersen || 0) / 100);
    return total + Math.round(bersih);
  }, 0);
}

export interface RingkasanFinansialDokumen {
  subtotal: number;
  diskonGlobal: number;
  dpp: number;
  pakaiPpn: boolean;
  persenPpn: number;
  ppn: number;
  biayaLain: number;
  labelBiayaLain: string;
  total: number;
}

export function hitungRingkasanFinansialDokumen(
  doc: Pick<DokumenInternal, 'items' | 'dataDinamis' | 'jenisDokumen' | 'detailHargaPoUmum'>
): RingkasanFinansialDokumen {
  const subtotal =
    doc.jenisDokumen === 'purchase_order_umum'
      ? hitungSubtotalPoUmum(ambilDetailHargaPoUmum(doc))
      : hitungNilaiTotalItems(doc.items);
  const rawDiskon = Number(doc.dataDinamis.diskonGlobalRp || 0);
  const diskonGlobal = Number.isFinite(rawDiskon) ? Math.max(0, Math.min(subtotal, rawDiskon)) : 0;
  const dpp = Math.max(0, subtotal - diskonGlobal);
  const pakaiPpn =
    doc.jenisDokumen === 'quotation'
      ? doc.dataDinamis.pakaiPpn !== false
      : Boolean(doc.dataDinamis.pakaiPpn);
  const rawPersen = Number(doc.dataDinamis.persenPpn ?? 11);
  const persenPpn = Number.isFinite(rawPersen) && rawPersen > 0 ? rawPersen : 11;
  const ppn = pakaiPpn ? Math.round((dpp * persenPpn) / 100) : 0;
  const rawBiaya = Number(doc.dataDinamis.biayaLainRp || 0);
  const biayaLain = Number.isFinite(rawBiaya) ? Math.max(0, rawBiaya) : 0;
  const labelBiayaLain = String(doc.dataDinamis.labelBiayaLain || 'Biaya Pengiriman & Instalasi');
  const total = dpp + ppn + biayaLain;
  return { subtotal, diskonGlobal, dpp, pakaiPpn, persenPpn, ppn, biayaLain, labelBiayaLain, total };
}

export const TARGET_KONVERSI_DOKUMEN: Partial<
  Record<JenisDokumenInternal, Array<{ jenis: JenisDokumenInternal; label: string }>>
> = {
  quotation: [
    { jenis: 'material_requisition', label: 'Buat Material Requisition (MR)' },
    { jenis: 'surat_jalan', label: 'Buat Surat Jalan (DO)' },
    { jenis: 'bast', label: 'Buat BAST' },
    { jenis: 'purchase_requisition', label: 'Buat Purchase Requisition (PR)' }
  ],
  material_requisition: [
    { jenis: 'surat_jalan', label: 'Buat Surat Jalan (DO)' }
  ],
  surat_jalan: [
    { jenis: 'bast', label: 'Buat BAST' },
    { jenis: 'ba_instalasi', label: 'Buat BA Instalasi' }
  ],
  purchase_requisition: [
    { jenis: 'purchase_order', label: 'Terbitkan Purchase Order (PO)' },
    { jenis: 'purchase_order_umum', label: 'Terbitkan PO Umum (Non-Alkes)' }
  ],
  ncr: [
    { jenis: 'capa', label: 'Buka Tindakan CAPA' }
  ]
};

export function konversiDokumenKeTurunan(params: {
  sumber: DokumenInternal;
  targetJenis: JenisDokumenInternal;
  daftarAda: Pick<DokumenInternal, 'nomorDokumen' | 'jenisDokumen'>[];
  namaPembuat: string;
  peranPembuat: UserRole;
  tanggalIso?: string;
}): DokumenInternal {
  const base = buatDokumenInternalBaru({
    jenis: params.targetJenis,
    daftarAda: params.daftarAda,
    namaPembuat: params.namaPembuat,
    peranPembuat: params.peranPembuat,
    tanggalIso: params.tanggalIso
  });
  const skemaTarget = ambilSkemaDokumen(params.targetJenis);
  const nowIso = new Date().toISOString();

  const dataDinamisBaru = { ...base.dataDinamis };
  if (params.targetJenis === 'surat_jalan') {
    dataDinamisBaru.nomorSO = params.sumber.nomorDokumen;
  }
  if (params.targetJenis === 'bast') {
    dataDinamisBaru.nomorKontrakPo = params.sumber.nomorDokumen;
  }
  if (params.targetJenis === 'purchase_order') {
    dataDinamisBaru.referensiPR = params.sumber.nomorDokumen;
  }
  if (params.targetJenis === 'capa') {
    dataDinamisBaru.referensiNcrAudit = params.sumber.nomorDokumen;
  }
  if (params.targetJenis === 'material_requisition') {
    dataDinamisBaru.tujuanPenggunaan = `${params.sumber.nomorDokumen} — ${params.sumber.pihakTerkait.instansi || params.sumber.judul}`;
  }

  const isTargetPoUmum = params.targetJenis === 'purchase_order_umum';
  const detailHargaPoUmumBaru = isTargetPoUmum
    ? params.sumber.items.length > 0
      ? params.sumber.items.map((item) =>
          ubahItemKeDetailHargaPoUmum(item, `po-det-${crypto.randomUUID().slice(0, 8)}`)
        )
      : base.detailHargaPoUmum
    : undefined;

  return {
    ...base,
    judul: `${skemaTarget.nama} (${params.sumber.pihakTerkait.instansi || params.sumber.nomorDokumen})`,
    referensiDokumen: params.sumber.nomorDokumen,
    prioritas: params.sumber.prioritas,
    pihakTerkait: { ...params.sumber.pihakTerkait },
    dataDinamis: dataDinamisBaru,
    ...(detailHargaPoUmumBaru ? { detailHargaPoUmum: detailHargaPoUmumBaru } : {}),
    items: isTargetPoUmum
      ? []
      : params.sumber.items.map((it) => ({
          ...it,
          id: `item-${crypto.randomUUID().slice(0, 8)}`
        })),
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: nowIso,
        oleh: params.namaPembuat,
        peran: params.peranPembuat,
        aksi: 'Draft Dibuat',
        statusSesudah: 'Draft',
        catatan: `Dibuat otomatis dari dokumen referensi ${params.sumber.nomorDokumen} (${ambilSkemaDokumen(params.sumber.jenisDokumen).kodeNomor})`
      }
    ]
  };
}

export function konversiQuotationLegacyKeDokumenInternal(
  q: DokumenQuotation,
  peranFallback: UserRole = 'sales_manager'
): DokumenInternal {
  const statusMap: Record<DokumenQuotation['status'], StatusDokumenInternal> = {
    Draft: 'Draft',
    Terkirim: 'Submitted',
    Disetujui: 'Approved'
  };
  const status = statusMap[q.status] || 'Draft';
  const nowIso = q.dibuatPada || new Date().toISOString();
  const aktor = q.upPenerima ? 'Tim Sales & Komersial AMS' : 'Sales e-Katalog';
  const sha = buatRingkasanHashDokumen({
    nomorDokumen: q.nomorQuotation,
    jenisDokumen: 'quotation',
    revisiKe: 0,
    status,
    waktu: nowIso,
    aktor
  });

  const alur = buatAlurPersetujuanAwal('quotation').map((step) => {
    if (status === 'Approved') {
      return {
        ...step,
        status: 'Disetujui' as const,
        disetujuiOleh: aktor,
        peranAktual: peranFallback,
        waktu: nowIso,
        catatan: 'Dimigrasikan dari arsip Quotation Sales.',
        hashTandaTangan: sha
      };
    }
    return step;
  });

  return {
    id: q.id.startsWith('doc-int-') ? q.id : `doc-int-qt-${q.id}`,
    nomorDokumen: q.nomorQuotation,
    kodeFormIso: 'FRM-COM-01',
    versiForm: 'Rev.03',
    kategori: 'komersial_penawaran',
    jenisDokumen: 'quotation',
    judul: q.perihal || `Penawaran Harga ${q.namaPenerima || 'Fasyankes'}`,
    departemen: 'Sales & Komersial B2B',
    tanggalDokumen: q.tanggalTerbit || nowIso.split('T')[0],
    tanggalBerlaku: q.berlakuHingga || q.tanggalTerbit || nowIso.split('T')[0],
    status,
    revisiKe: 0,
    prioritas: 'Normal',
    referensiDokumen: q.jalurPengadaan || '',
    ringkasan: q.catatanTambahan || q.perihal || 'Surat Penawaran Harga Alkes B2B',
    pihakTerkait: {
      namaPihak: q.upPenerima || '',
      instansi: q.namaPenerima || '',
      jabatan: 'Pejabat Pengadaan / PPK',
      kontak: [q.teleponPenerima, q.emailPenerima].filter(Boolean).join(' • '),
      alamat: q.alamatPenerima || ''
    },
    dataDinamis: {
      jalurPengadaan: q.jalurPengadaan || 'e-Katalog LKPP',
      berlakuHingga: q.berlakuHingga || q.tanggalTerbit || '',
      pakaiPpn: q.pakaiPpn ?? true,
      persenPpn: q.persenPpn ?? 11,
      diskonGlobalRp: q.diskonGlobalRp ?? 0,
      biayaLainRp: q.biayaLainRp ?? 0,
      labelBiayaLain: q.labelBiayaLain || 'Biaya Pengiriman & Instalasi',
      syaratKetentuan: q.syaratKetentuan || '',
      catatanTambahan: q.catatanTambahan || ''
    },
    items: (q.items || []).map((it) => ({
      id: it.id,
      produkId: it.produkId,
      namaProduk: it.namaProduk,
      tipeModel: it.tipeModel || '-',
      nomorIzinEdar: it.nomorIzinEdar || 'Dalam Verifikasi',
      nomorBatch: 'Alokasi FEFO saat DO',
      expiredDate: '-',
      qty: it.qty || 1,
      satuan: it.satuan || 'Unit',
      hargaSatuan: it.hargaSatuan || 0,
      diskonPersen: it.diskonPersen || 0,
      spesifikasi: it.spesifikasi || ''
    })),
    alurPersetujuan: alur,
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: nowIso,
        oleh: aktor,
        peran: peranFallback,
        aksi: status === 'Approved' ? 'Disetujui' : status === 'Submitted' ? 'Diajukan' : 'Draft Dibuat',
        statusSesudah: status,
        catatan: 'Terintegrasi dari Modul Quotation Sales ke Internal Document.'
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: sha.slice(4, 12),
      sha256Ringkas: sha,
      ditandatanganiPada: status === 'Approved' ? nowIso : undefined,
      penandatanganUtama: status === 'Approved' ? aktor : undefined,
      jabatanUtama: status === 'Approved' ? 'Manager / PJT Komersial' : undefined,
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen: q.nomorQuotation,
        kodeFormIso: 'FRM-COM-01',
        status,
        revisiKe: 0,
        sha256Ringkas: sha,
        penandatanganUtama: status === 'Approved' ? aktor : undefined,
        ditandatanganiPada: status === 'Approved' ? nowIso : undefined
      })
    },
    dibuatOleh: aktor,
    dibuatPeran: peranFallback,
    dibuatPada: nowIso,
    diperbaruiOleh: aktor,
    diperbaruiPada: nowIso
  };
}

export function buatContohDokumenInternalAwal(): DokumenInternal[] {
  const now = new Date();
  const tahun = now.getFullYear();
  const bulan = String(now.getMonth() + 1).padStart(2, '0');
  const today = now.toISOString().split('T')[0];
  const berlaku30Hari = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];

  const contohQt: DokumenInternal = {
    id: 'doc-int-seed-qt-001',
    nomorDokumen: `QT/AMS/${tahun}/${bulan}/001`,
    kodeFormIso: 'FRM-COM-01',
    versiForm: 'Rev.03',
    kategori: 'komersial_penawaran',
    jenisDokumen: 'quotation',
    judul: 'Penawaran Harga Patient Monitor & Ventilator ICU e-Katalog LKPP',
    departemen: 'Sales & Komersial B2B',
    tanggalDokumen: today,
    tanggalBerlaku: berlaku30Hari,
    status: 'Approved',
    revisiKe: 0,
    prioritas: 'Prioritas',
    referensiDokumen: 'e-Katalog LKPP v6',
    ringkasan: 'Penawaran resmi paket pengadaan alat elektromedik IGD & ICU RSUD Pasar Minggu.',
    pihakTerkait: {
      namaPihak: 'drg. Hendrawan, MARS',
      instansi: 'RSUD Pasar Minggu Jakarta Selatan',
      jabatan: 'Pejabat Pembuat Komitmen (PPK)',
      kontak: '(021) 29059999 • ppk@rsudpasarminggu.go.id',
      alamat: 'Jl. TB Simatupang No. 1, Ragunan, Jakarta Selatan'
    },
    dataDinamis: {
      jalurPengadaan: 'e-Katalog LKPP',
      berlakuHingga: berlaku30Hari,
      pakaiPpn: true,
      persenPpn: 11,
      diskonGlobalRp: 0,
      biayaLainRp: 2500000,
      labelBiayaLain: 'Biaya Pengiriman, Instalasi & Uji Fungsi',
      syaratKetentuan:
        '1. Pembayaran TOP 30 Hari setelah Berita Acara Serah Terima (BAST) & Uji Fungsi.\n2. Garansi resmi unit 1 tahun termasuk kalibrasi awal & pelatihan operator.\n3. Seluruh produk dijamin keaslian serta memiliki Izin Edar Kemenkes RI aktif.',
      catatanTambahan: 'Siap konversi langsung menjadi Material Requisition (MR) dan Surat Jalan (DO) setelah SPK terbit.'
    },
    items: [
      {
        id: 'item-seed-qt-1',
        namaProduk: 'Patient Monitor 5 Parameter Mindray uMEC12',
        tipeModel: 'uMEC12',
        nomorIzinEdar: 'KEMENKES RI AKL 20502124901',
        nomorBatch: 'BCH-UM12-2610A',
        expiredDate: '-',
        qty: 4,
        satuan: 'Unit',
        hargaSatuan: 58500000,
        diskonPersen: 5,
        spesifikasi: 'Layar TFT 12.1", ECG 5-lead, NIBP, SpO2, Temp, Resp + baterai Li-ion'
      }
    ],
    alurPersetujuan: [
      {
        urutan: 1,
        labelTahap: 'Review Kepatuhan NIE & Skema Harga oleh Manager / PJT',
        peranWajib: ['manager', 'pjt'],
        status: 'Disetujui',
        disetujuiOleh: 'Farhan Maulana - Sales e-Katalog',
        peranAktual: 'sales_manager',
        tingkatAktual: 'manager',
        waktu: now.toISOString(),
        catatan: 'Harga sesuai pagu e-Katalog LKPP & margin komersial terjaga.',
        hashTandaTangan: 'AMS-55D21A0E-9910F8B2'
      },
      {
        urutan: 2,
        labelTahap: 'Pengesahan Resmi Quotation oleh Manager / Direktur / PJT',
        peranWajib: ['manager', 'direktur', 'pjt'],
        status: 'Disetujui',
        disetujuiOleh: 'apt. Dewi Kartika - PJT Alkes',
        peranAktual: 'pjt',
        tingkatAktual: 'pjt',
        waktu: now.toISOString(),
        catatan: 'NIE AKL aktif & klaim brosur sesuai izin edar Kemenkes.',
        hashTandaTangan: 'AMS-88A102CC-4012DE77'
      }
    ],
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: now.toISOString(),
        oleh: 'apt. Dewi Kartika - PJT Alkes',
        peran: 'pjt',
        aksi: 'Disetujui',
        statusSebelum: 'Reviewed',
        statusSesudah: 'Approved',
        catatan: 'Penawaran resmi disahkan dengan tanda tangan QR.'
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: '88A102CC',
      sha256Ringkas: 'AMS-88A102CC-4012DE77',
      ditandatanganiPada: now.toISOString(),
      penandatanganUtama: 'apt. Dewi Kartika - PJT Alkes',
      jabatanUtama: LABEL_TINGKAT_PERAN.pjt,
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen: `QT/AMS/${tahun}/${bulan}/001`,
        kodeFormIso: 'FRM-COM-01',
        status: 'Approved',
        revisiKe: 0,
        sha256Ringkas: 'AMS-88A102CC-4012DE77',
        penandatanganUtama: 'apt. Dewi Kartika - PJT Alkes',
        ditandatanganiPada: now.toISOString()
      })
    },
    dibuatOleh: 'Farhan Maulana - Sales e-Katalog',
    dibuatPeran: 'sales_manager',
    dibuatPada: now.toISOString(),
    diperbaruiOleh: 'apt. Dewi Kartika - PJT Alkes',
    diperbaruiPada: now.toISOString()
  };

  const contohDo: DokumenInternal = {
    id: 'doc-int-seed-do-001',
    nomorDokumen: `DO/AMS/${tahun}/${bulan}/001`,
    kodeFormIso: 'FRM-LOG-02',
    versiForm: 'Rev.03',
    kategori: 'operasional_logistik',
    jenisDokumen: 'surat_jalan',
    judul: 'Pengiriman Patient Monitor & Syringe Pump ke RSUP Persahabatan',
    departemen: 'Logistik & Distribusi CDAKB',
    tanggalDokumen: today,
    tanggalBerlaku: today,
    status: 'Approved',
    revisiKe: 0,
    prioritas: 'Prioritas',
    referensiDokumen: `SO/AMS/${tahun}/041`,
    ringkasan: 'Pengiriman alkes elektromedik non-radiasi terkalibrasi lengkap dengan sertifikat garansi & copy izin edar.',
    pihakTerkait: {
      namaPihak: 'apt. Rahmawati, S.Farm',
      instansi: 'RSUP Persahabatan Jakarta Timur',
      jabatan: 'Kepala Instalasi Farmasi & Logistik Medis',
      kontak: '(021) 4891708',
      alamat: 'Jl. Persahabatan Raya No. 1, Rawamangun, Jakarta Timur'
    },
    dataDinamis: {
      nomorSO: `SO/AMS/${tahun}/041`,
      metodeKirim: 'Armada Internal Box Berpendingin',
      nomorKendaraan: 'B 9412 AMS • Segel #SG-2026-119',
      suhuMuat: '20.4°C (Ambient Stabil)',
      instruksiKirim: 'Wajib BAST rangkap 2 dan verifikasi segel kemasan serta nomor seri oleh IPSRS.'
    },
    items: [
      {
        id: 'item-seed-1',
        namaProduk: 'Patient Monitor 5 Parameter Mindray uMEC12',
        tipeModel: 'uMEC12',
        nomorIzinEdar: 'KEMENKES RI AKL 20502124901',
        nomorBatch: 'BCH-UM12-2610A',
        expiredDate: '-',
        nomorSerial: 'SN-UM12-88401..88404',
        qty: 4,
        satuan: 'Unit',
        suhuPenyimpanan: '15–25°C',
        kondisiFisik: 'Segel Utuh'
      },
      {
        id: 'item-seed-2',
        namaProduk: 'IV Cannula Steril 20G Safety Winged',
        tipeModel: '20G x 32mm',
        nomorIzinEdar: 'KEMENKES RI AKD 20902220144',
        nomorBatch: 'LOT-IV20-2608C',
        expiredDate: `${tahun + 3}-08-31`,
        qty: 500,
        satuan: 'Pcs',
        suhuPenyimpanan: '15–25°C',
        kondisiFisik: 'Steril Utuh'
      }
    ],
    alurPersetujuan: [
      {
        urutan: 1,
        labelTahap: 'Pemeriksaan Muat & Batch oleh Kepala Gudang',
        peranWajib: ['kepala_gudang'],
        status: 'Disetujui',
        disetujuiOleh: 'Ahmad Fauzi - Kepala Gudang',
        peranAktual: 'kepala_gudang',
        tingkatAktual: 'kepala_gudang',
        waktu: now.toISOString(),
        catatan: 'Batch FEFO dan segel kendaraan sesuai.',
        hashTandaTangan: 'AMS-91A2B4C8-0D3E12F4'
      },
      {
        urutan: 2,
        labelTahap: 'Otorisasi Pelepasan Distribusi oleh PJT',
        peranWajib: ['pjt', 'direktur'],
        status: 'Disetujui',
        disetujuiOleh: 'apt. Dewi Kartika - PJT Alkes',
        peranAktual: 'pjt',
        tingkatAktual: 'pjt',
        waktu: now.toISOString(),
        catatan: 'AKL & AKD aktif terverifikasi Kemenkes RI.',
        hashTandaTangan: 'AMS-44F8C102-8812AB91'
      }
    ],
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: now.toISOString(),
        oleh: 'apt. Dewi Kartika - PJT Alkes',
        peran: 'pjt',
        aksi: 'Disetujui',
        statusSebelum: 'Reviewed',
        statusSesudah: 'Approved',
        catatan: 'Otorisasi rilis pengiriman distribusi CDAKB.'
      },
      {
        revisiKe: 0,
        waktu: now.toISOString(),
        oleh: 'Ahmad Fauzi - Kepala Gudang',
        peran: 'kepala_gudang',
        aksi: 'Ditinjau',
        statusSebelum: 'Submitted',
        statusSesudah: 'Reviewed',
        catatan: 'Pengecekan fisik batch & FEFO selesai.'
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: '44F8C102',
      sha256Ringkas: 'AMS-44F8C102-8812AB91',
      ditandatanganiPada: now.toISOString(),
      penandatanganUtama: 'apt. Dewi Kartika - PJT Alkes',
      jabatanUtama: LABEL_TINGKAT_PERAN.pjt,
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen: `DO/AMS/${tahun}/${bulan}/001`,
        kodeFormIso: 'FRM-LOG-02',
        status: 'Approved',
        revisiKe: 0,
        sha256Ringkas: 'AMS-44F8C102-8812AB91',
        penandatanganUtama: 'apt. Dewi Kartika - PJT Alkes',
        ditandatanganiPada: now.toISOString()
      })
    },
    dibuatOleh: 'Ahmad Fauzi - Kepala Gudang',
    dibuatPeran: 'kepala_gudang',
    dibuatPada: now.toISOString(),
    diperbaruiOleh: 'apt. Dewi Kartika - PJT Alkes',
    diperbaruiPada: now.toISOString()
  };

  const contohNcr: DokumenInternal = {
    id: 'doc-int-seed-ncr-001',
    nomorDokumen: `NCR/AMS/${tahun}/${bulan}/001`,
    kodeFormIso: 'FRM-QA-01',
    versiForm: 'Rev.03',
    kategori: 'mutu_qa',
    jenisDokumen: 'ncr',
    judul: 'Deviasi Suhu Ekskursi Cold Room Reagen IVD Saat Pemadaman Listrik',
    departemen: 'Quality Assurance (QA)',
    tanggalDokumen: today,
    tanggalBerlaku: today,
    status: 'Reviewed',
    revisiKe: 0,
    prioritas: 'Kritis CDAKB',
    referensiDokumen: 'LOG-SUHU-CR01',
    ringkasan: 'Ditemukan kenaikan suhu sementara hingga 9.4°C selama 22 menit saat pergantian genset otomatis.',
    pihakTerkait: {
      namaPihak: 'Hendra Setiawan',
      instansi: 'Area Cold Room 01 — Gudang Cikarang',
      jabatan: 'Lead QC Inspector',
      kontak: 'Ext. 204',
      alamat: 'Gudang Utama Cikarang Blok B-12'
    },
    dataDinamis: {
      sumberTemuan: 'Pemantauan Gudang / Suhu',
      klasifikasiNcr: 'Major',
      klausulTerkait: 'CDAKB Bab III & ISO 13485:2016 7.5.11',
      deskripsiTemuan: 'Data logger DL-CR01 mencatat suhu 9.4°C (batas atas 8.0°C) pukul 03:12–03:34 WIB.',
      koreksiSegera: 'Seluruh batch reagen IVD dipindahkan ke status Karantina Sementara sambil menunggu konfirmasi stabilitas prinsipal.'
    },
    items: [
      {
        id: 'item-seed-ncr-1',
        namaProduk: 'Reagen Hematology Analyzer 5-Diff Diluent',
        tipeModel: 'HEM-DL-20L',
        nomorIzinEdar: 'KEMENKES RI AKL 10203219882',
        nomorBatch: 'LOT-RG26-0911',
        expiredDate: `${tahun + 1}-09-30`,
        qty: 28,
        satuan: 'Galon',
        suhuPenyimpanan: '2–8°C',
        kondisiFisik: 'Karantina Evaluasi Stabilitas'
      }
    ],
    alurPersetujuan: [
      {
        urutan: 1,
        labelTahap: 'Investigasi & Penahanan Stok oleh Kepala Gudang / QA Manager',
        peranWajib: ['kepala_gudang', 'manager'],
        status: 'Disetujui',
        disetujuiOleh: 'Budi Utomo, S.T - QA Manager',
        peranAktual: 'qa_manager',
        tingkatAktual: 'manager',
        waktu: now.toISOString(),
        catatan: 'Stok telah dikarantina fisik di Zona K-01 dan data logger diekspor.',
        hashTandaTangan: 'AMS-77C310D1-19A44B20'
      },
      {
        urutan: 2,
        labelTahap: 'Pengesahan Disposisi Mutu oleh PJT / QA Manager',
        peranWajib: ['pjt', 'manager', 'direktur'],
        status: 'Menunggu'
      }
    ],
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: now.toISOString(),
        oleh: 'Budi Utomo, S.T - QA Manager',
        peran: 'qa_manager',
        aksi: 'Ditinjau',
        statusSebelum: 'Submitted',
        statusSesudah: 'Reviewed',
        catatan: 'Menunggu keputusan disposisi stabilitas dari PJT.'
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: '77C310D1',
      sha256Ringkas: 'AMS-77C310D1-19A44B20',
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen: `NCR/AMS/${tahun}/${bulan}/001`,
        kodeFormIso: 'FRM-QA-01',
        status: 'Reviewed',
        revisiKe: 0,
        sha256Ringkas: 'AMS-77C310D1-19A44B20'
      })
    },
    dibuatOleh: 'Hendra Setiawan - Lead QC Inspector',
    dibuatPeran: 'qc_officer',
    dibuatPada: now.toISOString(),
    diperbaruiOleh: 'Budi Utomo, S.T - QA Manager',
    diperbaruiPada: now.toISOString()
  };

  const contohInst: DokumenInternal = {
    id: 'doc-int-seed-inst-001',
    nomorDokumen: `BA-INST/AMS/${tahun}/${bulan}/001`,
    kodeFormIso: 'FRM-TKN-02',
    versiForm: 'Rev.02',
    kategori: 'teknis_after_sales',
    jenisDokumen: 'ba_instalasi',
    judul: 'Instalasi & Uji Fungsi Ventilator ICU RS Siloam Kebon Jeruk',
    departemen: 'Teknisi Elektromedik Ber-STR',
    tanggalDokumen: today,
    tanggalBerlaku: today,
    status: 'Submitted',
    revisiKe: 0,
    prioritas: 'Normal',
    referensiDokumen: `DO/AMS/${tahun}/${bulan}/001`,
    ringkasan: 'Pemasangan, uji kebocoran sirkuit pernapasan, uji alarm oksigen, dan pelatihan 6 perawat ICU.',
    pihakTerkait: {
      namaPihak: 'Ns. Ratna Sari, S.Kep',
      instansi: 'RS Siloam Kebon Jeruk',
      jabatan: 'Kepala Ruangan ICU',
      kontak: '0812-9988-7712',
      alamat: 'Jl. Perjuangan No. 8, Kebon Jeruk, Jakarta Barat'
    },
    dataDinamis: {
      namaTeknisiStr: 'Dian Nugraha • STR 14 02 5 2 1-4402819',
      lokasiRuangan: 'Ruang ICU Dewasa Bed 02',
      hasilUjiFungsi: 'Lulus & Laik Pakai Klinis',
      jumlahPesertaTraining: 6,
      catatanTeknisInstalasi: 'Tidal Volume 500 mL deviasi 1.8%, PEEP 5 cmH2O stabil, baterai cadangan 100%.'
    },
    items: [
      {
        id: 'item-seed-inst-1',
        namaProduk: 'ICU Mechanical Ventilator Servo-Air',
        tipeModel: 'SA-300',
        nomorIzinEdar: 'KEMENKES RI AKL 20403228190',
        nomorBatch: 'BCH-SA300-2604',
        expiredDate: '-',
        nomorSerial: 'SN-SA300-99104',
        qty: 1,
        satuan: 'Unit',
        kondisiFisik: 'Terpasang & Laik Pakai'
      }
    ],
    alurPersetujuan: buatAlurPersetujuanAwal('ba_instalasi'),
    riwayatRevisi: [
      {
        revisiKe: 0,
        waktu: now.toISOString(),
        oleh: 'Dian Nugraha - Teknisi Elektromedis',
        peran: 'teknisi_elektromedik',
        aksi: 'Diajukan',
        statusSebelum: 'Draft',
        statusSesudah: 'Submitted',
        catatan: 'Berita acara & foto uji fungsi diajukan untuk peninjauan.'
      }
    ],
    tandaTanganDigital: {
      kodeVerifikasi: 'B19D02E3',
      sha256Ringkas: 'AMS-B19D02E3-55C1009A',
      qrPayload: buatPayloadQrVerifikasi({
        nomorDokumen: `BA-INST/AMS/${tahun}/${bulan}/001`,
        kodeFormIso: 'FRM-TKN-02',
        status: 'Submitted',
        revisiKe: 0,
        sha256Ringkas: 'AMS-B19D02E3-55C1009A'
      })
    },
    dibuatOleh: 'Dian Nugraha - Teknisi Elektromedis',
    dibuatPeran: 'teknisi_elektromedik',
    dibuatPada: now.toISOString(),
    diperbaruiOleh: 'Dian Nugraha - Teknisi Elektromedis',
    diperbaruiPada: now.toISOString()
  };

  return [contohQt, contohDo, contohNcr, contohInst];
}
