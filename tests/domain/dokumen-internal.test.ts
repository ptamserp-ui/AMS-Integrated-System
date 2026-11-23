import { describe, expect, it } from 'vitest';
import type { JenisDokumenInternal, KategoriDokumenInternal } from '../../src/types';
import {
  SKEMA_DOKUMEN_INTERNAL,
  ambilDetailHargaPoUmum,
  ambilSkemaDokumen,
  buatContohDokumenInternalAwal,
  buatDokumenInternalBaru,
  buatNomorDokumenOtomatis,
  buatPayloadQrVerifikasi,
  buatRingkasanHashDokumen,
  evaluasiAksiWorkflow,
  hakAksesPeranDokumen,
  hitungRingkasanFinansialDokumen,
  hitungSubtotalPoUmum,
  jalankanTransisiWorkflow,
  konversiDokumenKeTurunan,
  konversiQuotationLegacyKeDokumenInternal,
  petakanPeranKeTingkat
} from '../../src/utils/dokumenInternal';

const JENIS_WAJIB: Array<{ jenis: JenisDokumenInternal; kategori: KategoriDokumenInternal }> = [
  { jenis: 'quotation', kategori: 'komersial_penawaran' },
  { jenis: 'material_requisition', kategori: 'operasional_logistik' },
  { jenis: 'surat_jalan', kategori: 'operasional_logistik' },
  { jenis: 'bast', kategori: 'operasional_logistik' },
  { jenis: 'kartu_stok', kategori: 'operasional_logistik' },
  { jenis: 'pemantauan_suhu', kategori: 'operasional_logistik' },
  { jenis: 'retur_recall', kategori: 'operasional_logistik' },
  { jenis: 'purchase_requisition', kategori: 'pengadaan' },
  { jenis: 'purchase_order', kategori: 'pengadaan' },
  { jenis: 'purchase_order_umum', kategori: 'pengadaan' },
  { jenis: 'evaluasi_supplier', kategori: 'pengadaan' },
  { jenis: 'permintaan_demo', kategori: 'teknis_after_sales' },
  { jenis: 'ba_instalasi', kategori: 'teknis_after_sales' },
  { jenis: 'maintenance_kalibrasi', kategori: 'teknis_after_sales' },
  { jenis: 'cash_advance', kategori: 'keuangan_umum' },
  { jenis: 'reimbursement', kategori: 'keuangan_umum' },
  { jenis: 'form_hrd', kategori: 'keuangan_umum' },
  { jenis: 'ncr', kategori: 'mutu_qa' },
  { jenis: 'capa', kategori: 'mutu_qa' }
];

describe('Modul Dokumen Internal CDAKB — Skema, Penomoran, RBAC & Workflow', () => {
  it('menyediakan seluruh 19 jenis dokumen lintas 6 kategori beserta kode form ISO dan field dinamis', () => {
    expect(SKEMA_DOKUMEN_INTERNAL).toHaveLength(19);
    expect(SKEMA_DOKUMEN_INTERNAL.filter((skema) => skema.kategori === 'pengadaan').map((skema) => skema.jenis))
      .toEqual(['purchase_requisition', 'purchase_order', 'evaluasi_supplier', 'purchase_order_umum']);
    for (const item of JENIS_WAJIB) {
      const skema = ambilSkemaDokumen(item.jenis);
      expect(skema.jenis).toBe(item.jenis);
      expect(skema.kategori).toBe(item.kategori);
      expect(skema.kodeFormIso).toMatch(/^FRM-/);
      if (item.jenis !== 'purchase_order_umum') {
        expect(skema.fields.length).toBeGreaterThanOrEqual(3);
      } else {
        expect(skema.fields.length).toBeGreaterThanOrEqual(1);
      }
      expect(skema.tahapPersetujuan).toHaveLength(2);
    }
  });

  it('menghasilkan nomor dokumen otomatis berurutan per jenis, tahun, dan bulan tanpa tabrakan', () => {
    const daftarAda = [
      { nomorDokumen: 'DO/AMS/2026/11/001', jenisDokumen: 'surat_jalan' as const },
      { nomorDokumen: 'DO/AMS/2026/11/004', jenisDokumen: 'surat_jalan' as const },
      { nomorDokumen: 'DO/AMS/2026/10/009', jenisDokumen: 'surat_jalan' as const },
      { nomorDokumen: 'PR/AMS/2026/11/012', jenisDokumen: 'purchase_requisition' as const }
    ];

    const nomorBaruDo = buatNomorDokumenOtomatis('surat_jalan', daftarAda, '2026-11-21');
    expect(nomorBaruDo).toBe('DO/AMS/2026/11/005');

    const nomorBaruPr = buatNomorDokumenOtomatis('purchase_requisition', daftarAda, '2026-11-21');
    expect(nomorBaruPr).toBe('PR/AMS/2026/11/013');
  });

  it('memetakan 5 tingkat peran RBAC dengan batas otoritas yang tepat termasuk read-only Auditor Internal', () => {
    expect(petakanPeranKeTingkat('sales_medrep')).toBe('staff');
    expect(petakanPeranKeTingkat('kepala_gudang')).toBe('kepala_gudang');
    expect(petakanPeranKeTingkat('pjt')).toBe('pjt');
    expect(petakanPeranKeTingkat('qa_manager')).toBe('manager');
    expect(petakanPeranKeTingkat('developer_it_support')).toBe('direktur');

    const hakStaff = hakAksesPeranDokumen('purchasing');
    expect(hakStaff.bisaBuatDraft).toBe(true);
    expect(hakStaff.bisaSubmit).toBe(true);
    expect(hakStaff.bisaReview).toBe(false);
    expect(hakStaff.bisaApproveFinal).toBe(false);
    expect(hakStaff.bisaClose).toBe(false);

    const hakGudang = hakAksesPeranDokumen('kepala_gudang');
    expect(hakGudang.bisaReview).toBe(true);
    expect(hakGudang.bisaApproveFinal).toBe(false);
    expect(hakGudang.bisaReject).toBe(true);

    const hakPjt = hakAksesPeranDokumen('pjt');
    expect(hakPjt.bisaApproveFinal).toBe(true);
    expect(hakPjt.bisaClose).toBe(true);

    const hakAuditor = hakAksesPeranDokumen('auditor_internal');
    expect(hakAuditor.bisaBuatDraft).toBe(false);
    expect(hakAuditor.bisaSubmit).toBe(false);
    expect(hakAuditor.bisaReview).toBe(false);
    expect(hakAuditor.bisaApproveFinal).toBe(false);
    expect(hakAuditor.bisaExportPdf).toBe(true);
  });

  it('memvalidasi kolom wajib dan ketertelusuran NIE + Batch sebelum dokumen berstatus Submitted', () => {
    const draftDo = buatDokumenInternalBaru({
      jenis: 'surat_jalan',
      daftarAda: [],
      namaPembuat: 'Dewi Purchasing',
      peranPembuat: 'purchasing',
      tanggalIso: '2026-11-21'
    });

    // Kosongkan required field nomorSO -> submit harus ditolak
    const gagalField = jalankanTransisiWorkflow(draftDo, 'submit', {
      nama: 'Dewi Purchasing',
      role: 'purchasing'
    });
    expect(gagalField.ok).toBe(false);

    // Lengkapi required fields, tapi sertakan item alkes tanpa nomorIzinEdar
    const docDenganItemCacat = {
      ...draftDo,
      dataDinamis: {
        ...draftDo.dataDinamis,
        nomorSO: 'SO/AMS/2026/11/002',
        suhuMuat: '4.5°C'
      },
      items: [
        {
          id: 'item-1',
          kodeSku: 'SKU-01',
          namaProduk: 'Patient Monitor X1',
          tipeModel: 'X1-ICU',
          nomorIzinEdar: '',
          nomorBatch: 'LOT-2611A',
          expiredDate: '2028-11-01',
          qty: 2,
          satuan: 'Unit'
        }
      ]
    };

    const gagalTraceability = jalankanTransisiWorkflow(docDenganItemCacat, 'submit', {
      nama: 'Dewi Purchasing',
      role: 'purchasing'
    });
    expect(gagalTraceability.ok).toBe(false);
    if (!gagalTraceability.ok) {
      expect(gagalTraceability.pesan).toContain('NIE AKL/AKD');
    }
  });

  it('menjalankan siklus penuh Draft -> Submitted -> Reviewed -> Approved -> Closed dengan penegakan RBAC berjenjang', () => {
    const awal = buatDokumenInternalBaru({
      jenis: 'surat_jalan',
      daftarAda: [],
      namaPembuat: 'Staf Logistik',
      peranPembuat: 'qc_officer',
      tanggalIso: '2026-11-21'
    });
    const siapSubmit = {
      ...awal,
      judul: 'Pengiriman Monitor ICU RSUP Persahabatan',
      dataDinamis: {
        ...awal.dataDinamis,
        nomorSO: 'SO/AMS/2026/11/009',
        suhuMuat: '20.5°C'
      },
      items: [
        {
          id: 'item-1',
          kodeSku: 'AMS-PM-01',
          namaProduk: 'Patient Monitor Multiparameter 5-Lead',
          tipeModel: 'PM-5L-Pro',
          nomorIzinEdar: 'KEMENKES RI AKL 20901234567',
          nomorBatch: 'PM-26B04',
          expiredDate: '2029-05-01',
          nomorSerial: 'SN-2026-0091',
          qty: 3,
          satuan: 'Unit'
        }
      ]
    };

    // 1. Submit oleh Staff
    const resSubmit = jalankanTransisiWorkflow(siapSubmit, 'submit', {
      nama: 'Hendra QC',
      role: 'qc_officer'
    });
    expect(resSubmit.ok).toBe(true);
    if (!resSubmit.ok) return;
    expect(resSubmit.dokumen.status).toBe('Submitted');

    // Staff tidak boleh review atau approve
    const resStaffReview = jalankanTransisiWorkflow(resSubmit.dokumen, 'review', {
      nama: 'Hendra QC',
      role: 'qc_officer'
    });
    expect(resStaffReview.ok).toBe(false);

    // 2. Review Tahap 1 oleh Kepala Gudang
    const resReview = jalankanTransisiWorkflow(
      resSubmit.dokumen,
      'review',
      { nama: 'Ahmad Fauzi', role: 'kepala_gudang' },
      'Segel box & batch terverifikasi FEFO'
    );
    expect(resReview.ok).toBe(true);
    if (!resReview.ok) return;
    expect(resReview.dokumen.status).toBe('Reviewed');
    expect(resReview.dokumen.alurPersetujuan[0].status).toBe('Disetujui');

    // Kepala Gudang TIDAK berhak Approval Final pada Surat Jalan
    const resGudangApprove = jalankanTransisiWorkflow(resReview.dokumen, 'approve', {
      nama: 'Ahmad Fauzi',
      role: 'kepala_gudang'
    });
    expect(resGudangApprove.ok).toBe(false);

    // 3. Approval Final oleh PJT (Penanggung Jawab Teknis)
    const resApprove = jalankanTransisiWorkflow(
      resReview.dokumen,
      'approve',
      { nama: 'apt. Dewi Kartika', role: 'pjt' },
      'Otorisasi pelepasan alkes sesuai CDAKB'
    );
    expect(resApprove.ok).toBe(true);
    if (!resApprove.ok) return;
    expect(resApprove.dokumen.status).toBe('Approved');
    expect(resApprove.dokumen.tandaTanganDigital.penandatanganUtama).toBe('apt. Dewi Kartika');

    const qrData = JSON.parse(resApprove.dokumen.tandaTanganDigital.qrPayload);
    expect(qrData.sistem).toBe('AMS-CDAKB');
    expect(qrData.status).toBe('Approved');
    expect(qrData.no).toBe(resApprove.dokumen.nomorDokumen);
    expect(qrData.by).toBe('apt. Dewi Kartika');

    // 4. Penutupan arsip (Closed) oleh PJT -> mengunci seluruh perubahan
    const resClose = jalankanTransisiWorkflow(resApprove.dokumen, 'close', {
      nama: 'apt. Dewi Kartika',
      role: 'pjt'
    });
    expect(resClose.ok).toBe(true);
    if (!resClose.ok) return;
    expect(resClose.dokumen.status).toBe('Closed');

    const aksiSaatClosed = evaluasiAksiWorkflow(resClose.dokumen, 'pjt');
    expect(aksiSaatClosed.dapatEditKonten).toBe(false);
    expect(aksiSaatClosed.dapatSubmit).toBe(false);
    expect(aksiSaatClosed.dapatRevisi).toBe(false);
  });

  it('mendukung penolakan ber-alasan (Rejected) dan pembukaan revisi yang menaikkan revisiKe serta audit trail', () => {
    const contohAwal = buatContohDokumenInternalAwal()[0];
    expect(contohAwal).toBeDefined();

    // Contoh awal [0] adalah Surat Jalan berstatus Approved; uji siklus PR dari Draft -> Submitted -> Rejected -> Revisi
    const pr = buatDokumenInternalBaru({
      jenis: 'purchase_requisition',
      daftarAda: [],
      namaPembuat: 'Dewi Purchasing',
      peranPembuat: 'purchasing',
      tanggalIso: '2026-11-21'
    });
    const prSiap = {
      ...pr,
      judul: 'Pengadaan Reagen Cold Chain Q4',
      dataDinamis: {
        ...pr.dataDinamis,
        justifikasiTeknis: 'Stok mendekati safety stock',
        estimasiAnggaran: 45000000
      }
    };

    const s1 = jalankanTransisiWorkflow(prSiap, 'submit', { nama: 'Dewi Purchasing', role: 'purchasing' });
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;

    // Reject tanpa catatan wajib gagal
    const rTanpaCatatan = jalankanTransisiWorkflow(
      s1.dokumen,
      'reject',
      { nama: 'Ahmad Fauzi', role: 'kepala_gudang' },
      '   '
    );
    expect(rTanpaCatatan.ok).toBe(false);

    // Reject dengan alasan jelas
    const s2 = jalankanTransisiWorkflow(
      s1.dokumen,
      'reject',
      { nama: 'Ahmad Fauzi', role: 'kepala_gudang' },
      'Harap lampirkan rincian item batch target'
    );
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    expect(s2.dokumen.status).toBe('Rejected');

    // Buka revisi baru
    const s3 = jalankanTransisiWorkflow(
      s2.dokumen,
      'revisi',
      { nama: 'Dewi Purchasing', role: 'purchasing' },
      'Menambahkan rincian item batch'
    );
    expect(s3.ok).toBe(true);
    if (!s3.ok) return;
    expect(s3.dokumen.status).toBe('Draft');
    expect(s3.dokumen.revisiKe).toBe(1);
    expect(s3.dokumen.riwayatRevisi[0].aksi).toBe('Revisi Baru');

    // Hash deterministik terhadap input yang sama
    const hashA = buatRingkasanHashDokumen({
      nomorDokumen: 'PR/AMS/2026/11/001',
      jenisDokumen: 'purchase_requisition',
      revisiKe: 1,
      status: 'Draft',
      waktu: '2026-11-21T00:00:00.000Z',
      aktor: 'Dewi Purchasing'
    });
    const hashB = buatRingkasanHashDokumen({
      nomorDokumen: 'PR/AMS/2026/11/001',
      jenisDokumen: 'purchase_requisition',
      revisiKe: 1,
      status: 'Draft',
      waktu: '2026-11-21T00:00:00.000Z',
      aktor: 'Dewi Purchasing'
    });
    expect(hashA).toBe(hashB);

    const qrPayload = buatPayloadQrVerifikasi({
      nomorDokumen: 'PR/AMS/2026/11/001',
      kodeFormIso: 'FRM-PRC-01',
      status: 'Draft',
      revisiKe: 1,
      sha256Ringkas: hashA
    });
    expect(qrPayload).toContain('"rev":1');
  });

  it('menghitung ringkasan finansial Quotation, migrasi Quotation legacy, dan konversi lintas dokumen (QT -> DO)', () => {
    const legacy = konversiQuotationLegacyKeDokumenInternal(
      {
        id: 'qt-legacy-1',
        nomorQuotation: 'QT/AMS/2026/11/009',
        tanggalTerbit: '2026-11-20',
        berlakuHingga: '2026-12-20',
        status: 'Disetujui',
        jalurPengadaan: 'e-Katalog LKPP',
        perihal: 'Penawaran Monitor Pasien IGD',
        namaPenerima: 'RSUD Kebayoran Baru',
        upPenerima: 'PPK Alkes',
        alamatPenerima: 'Jakarta Selatan',
        teleponPenerima: '021-720111',
        emailPenerima: 'ppk@rsudkb.go.id',
        items: [
          {
            id: 'i-1',
            namaProduk: 'Patient Monitor 5 Parameter',
            tipeModel: 'PM-500',
            spesifikasi: 'Layar TFT 12.1", ECG 5-lead, SpO2, NIBP',
            nomorIzinEdar: 'KEMENKES RI AKL 20502124901',
            qty: 2,
            satuan: 'Unit',
            hargaSatuan: 50000000,
            diskonPersen: 10
          }
        ],
        diskonGlobalRp: 5000000,
        pakaiPpn: true,
        persenPpn: 11,
        biayaLainRp: 1500000,
        labelBiayaLain: 'Biaya Pengiriman & Instalasi',
        syaratKetentuan: 'TOP 30 Hari setelah BAST.',
        catatanTambahan: '',
        dibuatPada: '2026-11-20T08:00:00.000Z'
      },
      'sales_manager'
    );

    expect(legacy.jenisDokumen).toBe('quotation');
    expect(legacy.kategori).toBe('komersial_penawaran');
    expect(legacy.status).toBe('Approved');
    expect(legacy.pihakTerkait.instansi).toBe('RSUD Kebayoran Baru');

    const fin = hitungRingkasanFinansialDokumen(legacy);
    // 2 * 50jt * 0.9 = 90jt; diskonGlobal 5jt -> dpp = 85jt; PPN 11% = 9.35jt; biayaLain = 1.5jt -> total = 95.85jt
    expect(fin.subtotal).toBe(90000000);
    expect(fin.dpp).toBe(85000000);
    expect(fin.ppn).toBe(9350000);
    expect(fin.total).toBe(95850000);

    const turunanDo = konversiDokumenKeTurunan({
      sumber: legacy,
      targetJenis: 'surat_jalan',
      daftarAda: [legacy],
      namaPembuat: 'Ahmad Fauzi',
      peranPembuat: 'kepala_gudang',
      tanggalIso: '2026-11-21'
    });
    expect(turunanDo.jenisDokumen).toBe('surat_jalan');
    expect(turunanDo.status).toBe('Draft');
    expect(turunanDo.referensiDokumen).toBe('QT/AMS/2026/11/009');
    expect(turunanDo.dataDinamis.nomorSO).toBe('QT/AMS/2026/11/009');
    expect(turunanDo.pihakTerkait.instansi).toBe('RSUD Kebayoran Baru');
    expect(turunanDo.items).toHaveLength(1);
    expect(turunanDo.items[0].namaProduk).toBe('Patient Monitor 5 Parameter');
  });

  it('mendukung Purchase Order (PO) Umum tanpa Syarat Pembayaran & tabel terlampir, dengan grup Detail + Harga berulang dan Subtotal', () => {
    const skemaPoUmum = ambilSkemaDokumen('purchase_order_umum');
    expect(skemaPoUmum.kategori).toBe('pengadaan');
    expect(skemaPoUmum.wajibTraceabilityAlkes).toBe(false);
    expect(skemaPoUmum.tampilkanNilaiFinansial).toBe(true);
    expect(skemaPoUmum.fields.map((f) => f.key)).toEqual(['metodePembayaran']);
    expect(skemaPoUmum.fields.some((f) => f.key === 'syaratPembayaran')).toBe(false);

    const draft = buatDokumenInternalBaru({
      jenis: 'purchase_order_umum',
      daftarAda: [],
      namaPembuat: 'Dewi Purchasing',
      peranPembuat: 'purchasing',
      tanggalIso: '2026-11-22'
    });
    expect(draft.nomorDokumen).toBe('POU/AMS/2026/11/001');
    expect(draft.kodeFormIso).toBe('FRM-PRC-04');
    expect(draft.items).toEqual([]);
    expect(draft.detailHargaPoUmum).toHaveLength(1);
    expect(ambilDetailHargaPoUmum(draft)).toHaveLength(1);

    // Submit dengan Detail kosong -> ditolak
    const gagalKosong = jalankanTransisiWorkflow(draft, 'submit', {
      nama: 'Dewi Purchasing',
      role: 'purchasing'
    });
    expect(gagalKosong.ok).toBe(false);

    // Lengkapi Prinsipal manual, >1 group Detail & Harga di Spesifikasi, dan Metode Pembayaran (tanpa items terlampir)
    const poSiap = {
      ...draft,
      judul: 'Pengadaan Laptop Kerja & Perpanjangan Hosting Website',
      pihakTerkait: {
        ...draft.pihakTerkait,
        instansi: 'PT Solusi Komputasi & Cloud Nusantara',
        namaPihak: 'Rizky Pratama'
      },
      detailHargaPoUmum: [
        {
          id: 'po-det-1',
          detail: '2 unit Laptop Kerja Core i7 / 16GB / 1TB SSD',
          harga: 29000000
        },
        {
          id: 'po-det-2',
          detail: 'Layanan Hosting & Domain Website Perusahaan (12 Bulan)',
          harga: 4200000
        }
      ],
      dataDinamis: {
        metodePembayaran: 'Transfer bank'
      }
    };

    expect(hitungSubtotalPoUmum(poSiap.detailHargaPoUmum)).toBe(33200000);
    expect(hitungRingkasanFinansialDokumen(poSiap).subtotal).toBe(33200000);

    // Jika salah satu group memiliki Detail kosong -> submit ditolak
    const gagalSebagianKosong = jalankanTransisiWorkflow(
      {
        ...poSiap,
        detailHargaPoUmum: [...poSiap.detailHargaPoUmum, { id: 'po-det-3', detail: '   ', harga: 500000 }]
      },
      'submit',
      { nama: 'Dewi Purchasing', role: 'purchasing' }
    );
    expect(gagalSebagianKosong.ok).toBe(false);

    const resSubmit = jalankanTransisiWorkflow(poSiap, 'submit', {
      nama: 'Dewi Purchasing',
      role: 'purchasing'
    });
    expect(resSubmit.ok).toBe(true);
    if (!resSubmit.ok) return;
    expect(resSubmit.dokumen.status).toBe('Submitted');

    const resReview = jalankanTransisiWorkflow(resSubmit.dokumen, 'review', {
      nama: 'Budi Manager',
      role: 'qa_manager'
    });
    expect(resReview.ok).toBe(true);
    if (!resReview.ok) return;

    const resApprove = jalankanTransisiWorkflow(resReview.dokumen, 'approve', {
      nama: 'Direktur Operasional',
      role: 'developer_it_support'
    });
    expect(resApprove.ok).toBe(true);
    if (!resApprove.ok) return;
    expect(resApprove.dokumen.status).toBe('Approved');
  });

  it('mempertahankan detail, syarat pembayaran dan nilai item PO Umum lama', () => {
    const draft = buatDokumenInternalBaru({
      jenis: 'purchase_order_umum',
      daftarAda: [],
      namaPembuat: 'Purchasing',
      peranPembuat: 'purchasing'
    });
    const legacy = {
      ...draft,
      detailHargaPoUmum: undefined,
      dataDinamis: { details: 'Spesifikasi lama', syaratPembayaran: 'Net 30 hari', metodePembayaran: 'Transfer' },
      items: [{
        id: 'legacy-item',
        namaProduk: 'Laptop',
        tipeModel: '',
        nomorIzinEdar: '',
        nomorBatch: '',
        expiredDate: '',
        qty: 2,
        satuan: 'Unit',
        hargaSatuan: 1000,
        diskonPersen: 10
      }]
    };
    const groups = ambilDetailHargaPoUmum(legacy);
    expect(groups[0].detail).toContain('Spesifikasi lama');
    expect(groups[0].detail).toContain('Net 30 hari');
    expect(groups[1]).toMatchObject({ detail: 'Laptop — 2 Unit', harga: 1800 });
    expect(hitungRingkasanFinansialDokumen(legacy).subtotal).toBe(1800);

    const pr = { ...legacy, jenisDokumen: 'purchase_requisition' as const };
    const hasil = konversiDokumenKeTurunan({
      sumber: pr,
      targetJenis: 'purchase_order_umum',
      daftarAda: [],
      namaPembuat: 'Purchasing',
      peranPembuat: 'purchasing'
    });
    expect(hasil.detailHargaPoUmum?.[0]).toMatchObject({ detail: 'Laptop — 2 Unit', harga: 1800 });
  });
});

