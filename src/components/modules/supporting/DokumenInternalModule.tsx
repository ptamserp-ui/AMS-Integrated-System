import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRightCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileCheck2,
  FilePlus2,
  FileText,
  History,
  ImagePlus,
  Lock,
  PackagePlus,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  XCircle
} from 'lucide-react';
import { useDbTick } from '../../../hooks/useDbSync';
import { db } from '../../../services/pocketbase';
import type {
  DefinisiFieldDinamis,
  DokumenInternal,
  IdentitasKopDokumenInternal,
  ItemAlkesDokumenInternal,
  JenisDokumenInternal,
  KategoriDokumenInternal,
  PelangganB2B,
  StatusDokumenInternal,
  UserRole
} from '../../../types';
import type { SesiLogin } from '../../../utils/autentikasi';
import type { DokumenQuotation } from '../../../utils/quotationPdf';
import {
  KATEGORI_DOKUMEN_META,
  KUNCI_DOKUMEN_INTERNAL,
  KUNCI_IDENTITAS_DOKUMEN_INTERNAL,
  LABEL_TINGKAT_PERAN,
  MATRIKS_RBAC_DOKUMEN,
  SKEMA_DOKUMEN_INTERNAL,
  STATUS_DOKUMEN_URUT,
  TARGET_KONVERSI_DOKUMEN,
  ambilSkemaDokumen,
  buatContohDokumenInternalAwal,
  buatDokumenInternalBaru,
  buatNomorDokumenOtomatis,
  buatPayloadQrVerifikasi,
  buatRingkasanHashDokumen,
  evaluasiAksiWorkflow,
  hakAksesPeranDokumen,
  hitungNilaiTotalItems,
  hitungRingkasanFinansialDokumen,
  jalankanTransisiWorkflow,
  konversiDokumenKeTurunan,
  konversiQuotationLegacyKeDokumenInternal,
  petakanPeranKeTingkat,
  type JenisAksiWorkflow
} from '../../../utils/dokumenInternal';
import {
  buatDataUrlQrDokumen,
  unduhDokumenInternalPdfA4
} from '../../../utils/dokumenInternalPdf';
import { gabungkanKatalogProduk, selesaikanGambar } from '../../../utils/website';
import { unggahFotoKeServer } from '../../../utils/mediaUpload';
import { namaPengguna } from '../../layout/Navbar';
import {
  Badge,
  Modal,
  Panel,
  Stat,
  type Tone,
  formatRupiah,
  formatTanggal,
  inputClass,
  labelClass,
  tombolBahaya,
  tombolPrimer,
  tombolSekunder
} from '../../ui';

const TONE_STATUS: Record<StatusDokumenInternal, Tone> = {
  Draft: 'slate',
  Submitted: 'blue',
  Reviewed: 'amber',
  Approved: 'emerald',
  Rejected: 'rose',
  Closed: 'slate'
};

interface AlkesSistemOption {
  id: string;
  namaProduk: string;
  tipeModel: string;
  nomorIzinEdar: string;
  nomorBatch: string;
  expiredDate: string;
  satuan: string;
  suhuPenyimpanan: string;
  stokTersedia: number;
  hargaReferensi: number;
  spesifikasi?: string;
  sumberLabel?: string;
}

function parseHargaNumerik(hargaTayang?: string): number {
  if (!hargaTayang) return 0;
  const angka = hargaTayang.replace(/[^0-9]/g, '');
  if (!angka) return 0;
  const nilai = Number(angka);
  return Number.isFinite(nilai) ? nilai : 0;
}

function buatIdentitasDefault(): IdentitasKopDokumenInternal {
  const tersimpan = db.getSettingJson<IdentitasKopDokumenInternal>(KUNCI_IDENTITAS_DOKUMEN_INTERNAL);
  if (tersimpan) return tersimpan;

  const quotIdentitas = db.getSettingJson<IdentitasKopDokumenInternal>('quotation_identitas_v1');
  if (quotIdentitas) {
    return {
      tampilkanLogo: quotIdentitas.tampilkanLogo ?? true,
      logoUrl: quotIdentitas.logoUrl || '',
      namaPerusahaan: quotIdentitas.namaPerusahaan || 'PT ANUGRAHMITRA SELARAS',
      tagline: quotIdentitas.tagline || 'Distributor & Produsen Alat Kesehatan Nasional • CDAKB & ISO 13485:2016',
      tampilkanLegalitas: quotIdentitas.tampilkanLegalitas ?? true,
      nomorLegalitas: quotIdentitas.nomorLegalitas || 'SDAK Kemenkes RI • CPAKB • ISO 13485:2016',
      tampilkanNpwp: quotIdentitas.tampilkanNpwp ?? true,
      npwp: quotIdentitas.npwp || '02.418.905.3-413.000',
      alamat: quotIdentitas.alamat || 'Kawasan Industri Medis Cikarang Blok B-12, Bekasi, Jawa Barat 17530',
      telepon: quotIdentitas.telepon || '(021) 8990-2134',
      email: quotIdentitas.email || 'pjt@anugrahmitraselaras.co.id',
      website: quotIdentitas.website || 'www.anugrahmitraselaras.co.id',
      kotaTandaTangan: quotIdentitas.kotaTandaTangan || 'Bekasi',
      warnaAksen: quotIdentitas.warnaAksen || '#0f766e'
    };
  }

  const draf = db.getWebsiteDraft();
  const sertifikat = db.getSertifikat();
  const ringkasanSertifikat = sertifikat
    .slice(0, 3)
    .map((s) => `${s.jenis.replace(/\s*\(.*\)$/, '')}: ${s.nomorSertifikat}`)
    .join(' • ');

  return {
    tampilkanLogo: true,
    logoUrl: draf.identitas.logoUrl || '',
    namaPerusahaan: draf.identitas.nama || 'PT ANUGRAHMITRA SELARAS',
    tagline: draf.identitas.tagline || 'Distributor & Produsen Alat Kesehatan Nasional • CDAKB & ISO 13485:2016',
    tampilkanLegalitas: true,
    nomorLegalitas: ringkasanSertifikat || 'SDAK Kemenkes RI • CPAKB • ISO 13485:2016',
    tampilkanNpwp: true,
    npwp: '02.418.905.3-413.000',
    alamat: draf.kontak.alamatKantor || 'Kawasan Industri Medis Cikarang Blok B-12, Bekasi, Jawa Barat 17530',
    telepon: draf.kontak.telepon || '(021) 8990-2134',
    email: draf.kontak.email || 'pjt@anugrahmitraselaras.co.id',
    website: 'www.anugrahmitraselaras.co.id',
    kotaTandaTangan: 'Bekasi',
    warnaAksen: '#0f766e'
  };
}

function gabungQuotationLegacy(daftarSaatIni: DokumenInternal[], role: UserRole): {
  hasil: DokumenInternal[];
  adaBaru: boolean;
} {
  let legacyList = db.getSettingJson<DokumenQuotation[]>('quotation_riwayat_v1');
  if (!Array.isArray(legacyList) && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('ams_quotation_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) legacyList = parsed as DokumenQuotation[];
      }
    } catch {
      /* ignore */
    }
  }
  if (!Array.isArray(legacyList) || legacyList.length === 0) {
    return { hasil: daftarSaatIni, adaBaru: false };
  }

  const nomorAda = new Set(daftarSaatIni.map((d) => d.nomorDokumen));
  const idAda = new Set(daftarSaatIni.map((d) => d.id));
  const tambahan: DokumenInternal[] = [];
  for (const q of legacyList) {
    const candidateId = q.id?.startsWith('doc-int-') ? q.id : `doc-int-qt-${q.id}`;
    if (!q.nomorQuotation || nomorAda.has(q.nomorQuotation) || idAda.has(candidateId)) continue;
    tambahan.push(konversiQuotationLegacyKeDokumenInternal(q, role));
    nomorAda.add(q.nomorQuotation);
    idAda.add(candidateId);
  }
  if (tambahan.length === 0) return { hasil: daftarSaatIni, adaBaru: false };
  return { hasil: [...tambahan, ...daftarSaatIni], adaBaru: true };
}

function bacaAtauInisialisasiDaftar(role: UserRole): DokumenInternal[] {
  const tersimpan = db.getSettingJson<DokumenInternal[]>(KUNCI_DOKUMEN_INTERNAL);
  const dasar = Array.isArray(tersimpan) && tersimpan.length > 0 ? tersimpan : buatContohDokumenInternalAwal();
  const { hasil, adaBaru } = gabungQuotationLegacy(dasar, role);
  if (!Array.isArray(tersimpan) || tersimpan.length === 0 || adaBaru) {
    db.setSettingJson(KUNCI_DOKUMEN_INTERNAL, hasil);
  }
  return hasil;
}

export default function DokumenInternalModule({
  currentRole,
  sesi,
  pelangganQuotationAwal,
  onKonsumsiPelangganQuotation
}: {
  currentRole: UserRole;
  sesi?: SesiLogin;
  pelangganQuotationAwal?: PelangganB2B | null;
  onKonsumsiPelangganQuotation?: () => void;
}) {
  const dbTick = useDbTick([
    KUNCI_DOKUMEN_INTERNAL,
    KUNCI_IDENTITAS_DOKUMEN_INTERNAL,
    'quotation_riwayat_v1',
    'quotation_identitas_v1',
    'pelanggan_b2b',
    'sales_pelanggan',
    'sales_skema_harga',
    'sales_pengetahuan_produk',
    'stok_gudang',
    'izin_edar',
    'product_catalog',
    'website_draft'
  ]);

  const namaAktor = sesi?.namaLengkap || namaPengguna(currentRole);
  const hakPeran = useMemo(() => hakAksesPeranDokumen(currentRole, sesi), [currentRole, sesi]);
  const tingkatPeran = petakanPeranKeTingkat(currentRole);

  const [daftar, setDaftar] = useState<DokumenInternal[]>(() => bacaAtauInisialisasiDaftar(currentRole));
  const [identitas, setIdentitas] = useState<IdentitasKopDokumenInternal>(() => buatIdentitasDefault());
  const [dokumenAktifId, setDokumenAktifId] = useState<string>(
    () => bacaAtauInisialisasiDaftar(currentRole)[0]?.id || ''
  );
  const [draf, setDraf] = useState<DokumenInternal>(
    () => bacaAtauInisialisasiDaftar(currentRole)[0]
  );

  const [subPanel, setSubPanel] = useState<
    'form' | 'items' | 'workflow' | 'daftar' | 'kop' | 'rbac'
  >('form');
  const [filterKategori, setFilterKategori] = useState<KategoriDokumenInternal | 'semua'>('semua');
  const [filterStatus, setFilterStatus] = useState<StatusDokumenInternal | 'semua'>('semua');
  const [cari, setCari] = useState('');

  const [pesanStatus, setPesanStatus] = useState<{ ok: boolean; teks: string } | null>(null);
  const [sedangUnduhPdf, setSedangUnduhPdf] = useState(false);
  const [sedangUnggahLogo, setSedangUnggahLogo] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');

  // Modals
  const [modalBuatTerbuka, setModalBuatTerbuka] = useState(false);
  const [kategoriPilihBaru, setKategoriPilihBaru] = useState<KategoriDokumenInternal>('komersial_penawaran');
  const [modalAlkesTerbuka, setModalAlkesTerbuka] = useState(false);
  const [cariAlkes, setCariAlkes] = useState('');
  const [modalTolakTerbuka, setModalTolakTerbuka] = useState(false);
  const [catatanWorkflow, setCatatanWorkflow] = useState('');

  // Sync dari DB saat berubah dari tab/user lain
  useEffect(() => {
    void dbTick;
    const segar = db.getSettingJson<DokumenInternal[]>(KUNCI_DOKUMEN_INTERNAL);
    if (Array.isArray(segar) && segar.length > 0) {
      const { hasil, adaBaru } = gabungQuotationLegacy(segar, currentRole);
      if (adaBaru) {
        db.setSettingJson(KUNCI_DOKUMEN_INTERNAL, hasil);
      }
      setDaftar(hasil);
      const cocok = hasil.find((item) => item.id === dokumenAktifId);
      if (cocok && draf.status !== 'Draft') {
        setDraf(cocok);
      }
    }
    setIdentitas(buatIdentitasDefault());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTick]);

  // Terima handoff pelanggan B2B dari modul CRM (Sales & Marketing) -> buat Draft Quotation baru
  useEffect(() => {
    if (!pelangganQuotationAwal) return;
    const today = new Date().toISOString().split('T')[0];
    const berlaku30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const baruBase = buatDokumenInternalBaru({
      jenis: 'quotation',
      daftarAda: daftar,
      namaPembuat: namaAktor,
      peranPembuat: currentRole,
      tanggalIso: today
    });
    const baru: DokumenInternal = {
      ...baruBase,
      judul: `Penawaran Harga Alkes & BMHP — ${pelangganQuotationAwal.namaInstalasi}`,
      tanggalBerlaku: berlaku30,
      pihakTerkait: {
        instansi: pelangganQuotationAwal.namaInstalasi,
        namaPihak: pelangganQuotationAwal.penanggungJawabPengadaan || 'Pejabat Pembuat Komitmen (PPK)',
        jabatan: 'Pejabat Pengadaan / PPK',
        kontak: '',
        alamat: `${pelangganQuotationAwal.provinsi} (${pelangganQuotationAwal.rayonDistribusi})`
      },
      dataDinamis: {
        ...baruBase.dataDinamis,
        berlakuHingga: berlaku30
      }
    };
    const terbaru = [baru, ...daftar];
    setDaftar(terbaru);
    db.setSettingJson(KUNCI_DOKUMEN_INTERNAL, terbaru);
    db.logAudit(
      'Internal Document & Quotation',
      'Buat Draft Quotation dari CRM Pelanggan B2B',
      baru.nomorDokumen,
      namaAktor,
      LABEL_TINGKAT_PERAN[tingkatPeran]
    );
    setDokumenAktifId(baru.id);
    setDraf(baru);
    setSubPanel('form');
    setPesanStatus({
      ok: true,
      teks: `Draft Quotation ${baru.nomorDokumen} dibuat untuk ${pelangganQuotationAwal.namaInstalasi}.`
    });
    onKonsumsiPelangganQuotation?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pelangganQuotationAwal]);

  // Generate live QR Code PNG data URL whenever qrPayload changes
  useEffect(() => {
    let aktif = true;
    void buatDataUrlQrDokumen(draf.tandaTanganDigital.qrPayload)
      .then((url) => {
        if (aktif) setQrPreviewUrl(url);
      })
      .catch(() => {
        if (aktif) setQrPreviewUrl('');
      });
    return () => {
      aktif = false;
    };
  }, [draf.tandaTanganDigital.qrPayload]);

  const pelangganList = useMemo(() => {
    void dbTick;
    return db.getPelangganB2B();
  }, [dbTick]);

  // Sumber Alkes sistem (Stok Gudang FEFO + Katalog Produk & Skema Harga + Izin Edar)
  const opsiAlkesSistem = useMemo<AlkesSistemOption[]>(() => {
    void dbTick;
    const stokList = db.getStokGudang();
    const izinList = db.getIzinEdar();
    const skemaHargaList = db.getSkemaHarga();
    const katalogProduk = gabungkanKatalogProduk({
      izinEdar: izinList,
      stok: stokList,
      pengetahuanProduk: db.getPengetahuanProduk(),
      skemaHarga: skemaHargaList,
      produkKatalog: db.getProdukKatalog()
    });

    const cariHargaReferensi = (nama: string, hargaTayang?: string): number => {
      const cocok = skemaHargaList.find(
        (s) => s.status === 'Aktif' && s.namaAlkes.trim().toLowerCase() === nama.trim().toLowerCase()
      );
      return cocok?.hargaDasar || parseHargaNumerik(hargaTayang) || 0;
    };

    const hasil: AlkesSistemOption[] = stokList.map((s) => {
      const katCocok = katalogProduk.find(
        (k) => k.nama.trim().toLowerCase() === s.namaAlkes.trim().toLowerCase()
      );
      return {
        id: `stk-${s.id}`,
        namaProduk: s.namaAlkes,
        tipeModel: katCocok?.tipeModel || s.kodeSKU || '-',
        nomorIzinEdar: s.nomorIzinEdar || 'Dalam Verifikasi',
        nomorBatch: s.nomorBatch,
        expiredDate: s.tanggalKedaluwarsa || '-',
        satuan: s.satuan || 'Unit',
        suhuPenyimpanan: 'Sesuai Label CDAKB',
        stokTersedia: Math.max(0, s.jumlahStok - (s.qtyDipesan ?? 0)),
        hargaReferensi: cariHargaReferensi(s.namaAlkes, katCocok?.hargaTayang),
        spesifikasi: katCocok?.spesifikasi || '',
        sumberLabel: 'Stok FEFO'
      };
    });

    for (const k of katalogProduk) {
      if (!hasil.some((h) => h.namaProduk.trim().toLowerCase() === k.nama.trim().toLowerCase())) {
        hasil.push({
          id: `cat-${k.id}`,
          namaProduk: k.nama,
          tipeModel: k.tipeModel || '-',
          nomorIzinEdar: k.nomorIzinEdar || 'Dalam Verifikasi',
          nomorBatch: draf.jenisDokumen === 'quotation' ? 'Alokasi FEFO saat DO' : `BCH-${k.tipeModel || 'NEW'}`,
          expiredDate: '-',
          satuan: k.satuan || 'Unit',
          suhuPenyimpanan: '15–25°C',
          stokTersedia: k.stokTersedia ?? 0,
          hargaReferensi: cariHargaReferensi(k.nama, k.hargaTayang),
          spesifikasi: k.spesifikasi || '',
          sumberLabel: 'Katalog Produk'
        });
      }
    }

    for (const iz of izinList) {
      if (!hasil.some((h) => h.nomorIzinEdar === iz.nomorIzinEdar)) {
        hasil.push({
          id: `nie-${iz.id}`,
          namaProduk: iz.namaAlkes,
          tipeModel: iz.tipeModel || '-',
          nomorIzinEdar: iz.nomorIzinEdar,
          nomorBatch: `BCH-${iz.tipeModel || 'NEW'}`,
          expiredDate: '-',
          satuan: 'Unit',
          suhuPenyimpanan: '15–25°C',
          stokTersedia: 0,
          hargaReferensi: cariHargaReferensi(iz.namaAlkes),
          sumberLabel: 'Register NIE'
        });
      }
    }
    return hasil;
  }, [dbTick, draf.jenisDokumen]);

  const alkesTersaring = useMemo(() => {
    const q = cariAlkes.trim().toLowerCase();
    if (!q) return opsiAlkesSistem;
    return opsiAlkesSistem.filter((a) =>
      `${a.namaProduk} ${a.tipeModel} ${a.nomorIzinEdar} ${a.nomorBatch}`.toLowerCase().includes(q)
    );
  }, [opsiAlkesSistem, cariAlkes]);

  const daftarTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar.filter((doc) => {
      if (filterKategori !== 'semua' && doc.kategori !== filterKategori) return false;
      if (filterStatus !== 'semua' && doc.status !== filterStatus) return false;
      if (!q) return true;
      const itemText = doc.items
        .map((i) => `${i.namaProduk} ${i.nomorBatch} ${i.nomorIzinEdar} ${i.nomorSerial ?? ''}`)
        .join(' ');
      return `${doc.nomorDokumen} ${doc.judul} ${doc.kodeFormIso} ${doc.departemen} ${doc.pihakTerkait.instansi} ${itemText}`
        .toLowerCase()
        .includes(q);
    });
  }, [daftar, filterKategori, filterStatus, cari]);

  const kpi = useMemo(() => {
    const total = daftar.length;
    const menungguApproval = daftar.filter((d) => d.status === 'Submitted' || d.status === 'Reviewed').length;
    const disetujuiTutup = daftar.filter((d) => d.status === 'Approved' || d.status === 'Closed').length;
    const totalBatchTertelusur = daftar.reduce(
      (n, d) => n + d.items.filter((it) => it.nomorBatch.trim() && it.nomorIzinEdar.trim()).length,
      0
    );
    return { total, menungguApproval, disetujuiTutup, totalBatchTertelusur };
  }, [daftar]);

  const skemaAktif = useMemo(() => ambilSkemaDokumen(draf.jenisDokumen), [draf.jenisDokumen]);
  const katAktif = KATEGORI_DOKUMEN_META[draf.kategori];
  const aksiWorkflow = useMemo(
    () => evaluasiAksiWorkflow(draf, currentRole, sesi),
    [draf, currentRole, sesi]
  );

  const logoResolved = useMemo(() => selesaikanGambar(identitas.logoUrl), [identitas.logoUrl]);

  const simpanDaftarKeServer = (terbaru: DokumenInternal[], deskripsiAudit: string, targetNomor: string) => {
    setDaftar(terbaru);
    db.setSettingJson(KUNCI_DOKUMEN_INTERNAL, terbaru);
    db.logAudit('Dokumen Internal CDAKB', deskripsiAudit, targetNomor, namaAktor, LABEL_TINGKAT_PERAN[tingkatPeran]);
  };

  const pilihDokumen = (doc: DokumenInternal) => {
    setDokumenAktifId(doc.id);
    setDraf(doc);
    setPesanStatus(null);
  };

  const buatDokumenDariModal = (jenis: JenisDokumenInternal) => {
    const baru = buatDokumenInternalBaru({
      jenis,
      daftarAda: daftar,
      namaPembuat: namaAktor,
      peranPembuat: currentRole
    });
    const terbaru = [baru, ...daftar];
    simpanDaftarKeServer(terbaru, `Inisialisasi Draft ${baru.kodeFormIso}`, baru.nomorDokumen);
    setDokumenAktifId(baru.id);
    setDraf(baru);
    setModalBuatTerbuka(false);
    setSubPanel('form');
    setPesanStatus({ ok: true, teks: `Draft baru ${baru.nomorDokumen} berhasil dibuat.` });
  };

  const buatQuotationCepat = () => {
    if (!hakPeran.bisaBuatDraft) {
      setPesanStatus({ ok: false, teks: 'Peran Anda hanya memiliki akses baca/ekspor.' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const berlaku30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const baruBase = buatDokumenInternalBaru({
      jenis: 'quotation',
      daftarAda: daftar,
      namaPembuat: namaAktor,
      peranPembuat: currentRole,
      tanggalIso: today
    });
    const baru: DokumenInternal = {
      ...baruBase,
      tanggalBerlaku: berlaku30,
      dataDinamis: {
        ...baruBase.dataDinamis,
        berlakuHingga: berlaku30
      }
    };
    const terbaru = [baru, ...daftar];
    simpanDaftarKeServer(terbaru, 'Inisialisasi Draft Quotation (QT)', baru.nomorDokumen);
    setDokumenAktifId(baru.id);
    setDraf(baru);
    setSubPanel('form');
    setPesanStatus({ ok: true, teks: `Draft Quotation ${baru.nomorDokumen} siap dilengkapi.` });
  };

  const konversiAktifKeTurunan = (targetJenis: JenisDokumenInternal) => {
    if (!hakPeran.bisaBuatDraft) {
      setPesanStatus({ ok: false, teks: 'Peran Anda tidak diizinkan membuat dokumen turunan.' });
      return;
    }
    const turunan = konversiDokumenKeTurunan({
      sumber: draf,
      targetJenis,
      daftarAda: daftar,
      namaPembuat: namaAktor,
      peranPembuat: currentRole
    });
    const terbaru = [turunan, ...daftar];
    simpanDaftarKeServer(
      terbaru,
      `Konversi ${draf.nomorDokumen} -> ${turunan.nomorDokumen}`,
      turunan.nomorDokumen
    );
    setDokumenAktifId(turunan.id);
    setDraf(turunan);
    setSubPanel('form');
    setPesanStatus({
      ok: true,
      teks: `Dokumen turunan ${turunan.nomorDokumen} dibuat dari referensi ${draf.nomorDokumen}.`
    });
  };

  const duplikatSebagaiDraft = () => {
    if (!hakPeran.bisaBuatDraft) {
      setPesanStatus({ ok: false, teks: 'Peran Anda hanya memiliki akses baca/ekspor.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];
    const nomorBaru = buatNomorDokumenOtomatis(draf.jenisDokumen, daftar, today);
    const sha = buatRingkasanHashDokumen({
      nomorDokumen: nomorBaru,
      jenisDokumen: draf.jenisDokumen,
      revisiKe: 0,
      status: 'Draft',
      waktu: nowIso,
      aktor: namaAktor
    });
    const salinan: DokumenInternal = {
      ...draf,
      id: `doc-int-${crypto.randomUUID().slice(0, 12)}`,
      nomorDokumen: nomorBaru,
      judul: `${draf.judul} (Salinan)`,
      tanggalDokumen: today,
      tanggalBerlaku: today,
      status: 'Draft',
      revisiKe: 0,
      alurPersetujuan: draf.alurPersetujuan.map((l) => ({
        urutan: l.urutan,
        labelTahap: l.labelTahap,
        peranWajib: l.peranWajib,
        status: 'Menunggu'
      })),
      riwayatRevisi: [
        {
          revisiKe: 0,
          waktu: nowIso,
          oleh: namaAktor,
          peran: currentRole,
          aksi: 'Draft Dibuat',
          statusSesudah: 'Draft',
          catatan: `Disalin dari ${draf.nomorDokumen}`
        }
      ],
      tandaTanganDigital: {
        kodeVerifikasi: sha.slice(4, 12),
        sha256Ringkas: sha,
        qrPayload: buatPayloadQrVerifikasi({
          nomorDokumen: nomorBaru,
          kodeFormIso: draf.kodeFormIso,
          status: 'Draft',
          revisiKe: 0,
          sha256Ringkas: sha
        })
      },
      dibuatOleh: namaAktor,
      dibuatPeran: currentRole,
      dibuatPada: nowIso,
      diperbaruiOleh: namaAktor,
      diperbaruiPada: nowIso
    };
    const terbaru = [salinan, ...daftar];
    simpanDaftarKeServer(terbaru, `Duplikasi Draft dari ${draf.nomorDokumen}`, salinan.nomorDokumen);
    setDokumenAktifId(salinan.id);
    setDraf(salinan);
    setSubPanel('form');
    setPesanStatus({ ok: true, teks: `Salinan draft dibuat dengan nomor ${salinan.nomorDokumen}.` });
  };

  const simpanDraftAktif = () => {
    if (!aksiWorkflow.dapatEditKonten) {
      setPesanStatus({ ok: false, teks: 'Hanya dokumen berstatus Draft yang dapat disunting langsung.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const nextSha = buatRingkasanHashDokumen({
      nomorDokumen: draf.nomorDokumen,
      jenisDokumen: draf.jenisDokumen,
      revisiKe: draf.revisiKe,
      status: 'Draft',
      waktu: nowIso,
      aktor: namaAktor
    });
    const tersimpan: DokumenInternal = {
      ...draf,
      diperbaruiOleh: namaAktor,
      diperbaruiPada: nowIso,
      riwayatRevisi: [
        {
          revisiKe: draf.revisiKe,
          waktu: nowIso,
          oleh: namaAktor,
          peran: currentRole,
          aksi: 'Disimpan' as const,
          statusSebelum: 'Draft' as const,
          statusSesudah: 'Draft' as const,
          catatan: 'Pembaruan konten draft formulir & item ketertelusuran.'
        },
        ...draf.riwayatRevisi
      ].slice(0, 25),
      tandaTanganDigital: {
        ...draf.tandaTanganDigital,
        sha256Ringkas: nextSha,
        qrPayload: buatPayloadQrVerifikasi({
          nomorDokumen: draf.nomorDokumen,
          kodeFormIso: draf.kodeFormIso,
          status: 'Draft',
          revisiKe: draf.revisiKe,
          sha256Ringkas: nextSha
        })
      }
    };
    const adaDiDaftar = daftar.some((item) => item.id === tersimpan.id);
    const terbaru = adaDiDaftar
      ? daftar.map((item) => (item.id === tersimpan.id ? tersimpan : item))
      : [tersimpan, ...daftar];
    simpanDaftarKeServer(terbaru, 'Simpan perubahan Draft Dokumen Internal', tersimpan.nomorDokumen);
    setDraf(tersimpan);
    setPesanStatus({ ok: true, teks: `Draft ${tersimpan.nomorDokumen} berhasil disimpan.` });
  };

  const eksekusiWorkflow = (aksi: JenisAksiWorkflow, catatan = '') => {
    const hasil = jalankanTransisiWorkflow(
      draf,
      aksi,
      { nama: namaAktor, role: currentRole, sesi },
      catatan
    );
    if (!hasil.ok) {
      setPesanStatus({ ok: false, teks: hasil.pesan });
      return;
    }
    const adaDiDaftar = daftar.some((item) => item.id === hasil.dokumen.id);
    const terbaru = adaDiDaftar
      ? daftar.map((item) => (item.id === hasil.dokumen.id ? hasil.dokumen : item))
      : [hasil.dokumen, ...daftar];
    simpanDaftarKeServer(
      terbaru,
      `Workflow ${draf.status} → ${hasil.dokumen.status} (${aksi})`,
      hasil.dokumen.nomorDokumen
    );
    setDraf(hasil.dokumen);
    setModalTolakTerbuka(false);
    setCatatanWorkflow('');
    setPesanStatus({
      ok: true,
      teks: `Status dokumen ${hasil.dokumen.nomorDokumen} berubah menjadi ${hasil.dokumen.status}.`
    });
  };

  const hapusDraft = (id: string) => {
    const target = daftar.find((d) => d.id === id);
    if (!target || target.status !== 'Draft') {
      setPesanStatus({ ok: false, teks: 'Hanya dokumen berstatus Draft yang boleh dihapus untuk menjaga jejak audit.' });
      return;
    }
    if (daftar.length <= 1) {
      setPesanStatus({ ok: false, teks: 'Minimal harus ada 1 dokumen di daftar kerja.' });
      return;
    }
    if (!window.confirm(`Hapus draft ${target.nomorDokumen}?`)) return;
    const terbaru = daftar.filter((d) => d.id !== id);
    simpanDaftarKeServer(terbaru, 'Hapus Draft Dokumen Internal', target.nomorDokumen);
    if (draf.id === id && terbaru[0]) {
      setDokumenAktifId(terbaru[0].id);
      setDraf(terbaru[0]);
    }
    setPesanStatus({ ok: true, teks: `Draft ${target.nomorDokumen} dihapus.` });
  };

  const tambahItemDariSistem = (opt: AlkesSistemOption) => {
    const baru: ItemAlkesDokumenInternal = {
      id: `item-${crypto.randomUUID().slice(0, 8)}`,
      produkId: opt.id,
      namaProduk: opt.namaProduk,
      tipeModel: opt.tipeModel,
      nomorIzinEdar: opt.nomorIzinEdar,
      nomorBatch: opt.nomorBatch,
      expiredDate: opt.expiredDate,
      qty: 1,
      satuan: opt.satuan,
      hargaSatuan: opt.hargaReferensi || 0,
      diskonPersen: 0,
      spesifikasi: opt.spesifikasi || '',
      suhuPenyimpanan: opt.suhuPenyimpanan,
      kondisiFisik: 'Baik & Segel Utuh'
    };
    setDraf((prev) => ({ ...prev, items: [...prev.items, baru] }));
    setPesanStatus({
      ok: true,
      teks: `Item "${opt.namaProduk}" (${opt.nomorBatch}) ditambahkan${opt.hargaReferensi ? ` dengan harga ref. ${formatRupiah(opt.hargaReferensi)}` : ''}.`
    });
  };

  const tambahItemKosong = () => {
    const baru: ItemAlkesDokumenInternal = {
      id: `item-${crypto.randomUUID().slice(0, 8)}`,
      namaProduk: '',
      tipeModel: '',
      nomorIzinEdar: 'KEMENKES RI AKL ',
      nomorBatch: '',
      expiredDate: '',
      nomorSerial: '',
      qty: 1,
      satuan: 'Unit',
      hargaSatuan: 0,
      diskonPersen: 0,
      spesifikasi: '',
      suhuPenyimpanan: '15–25°C',
      kondisiFisik: 'Baik'
    };
    setDraf((prev) => ({ ...prev, items: [...prev.items, baru] }));
  };

  const perbaruiItem = (itemId: string, patch: Partial<ItemAlkesDokumenInternal>) => {
    setDraf((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
    }));
  };

  const hapusItem = (itemId: string) => {
    setDraf((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId)
    }));
  };

  const simpanIdentitasKop = (next?: IdentitasKopDokumenInternal) => {
    const target = next ?? identitas;
    db.setSettingJson(KUNCI_IDENTITAS_DOKUMEN_INTERNAL, target);
    db.setSettingJson('quotation_identitas_v1', target);
    setPesanStatus({ ok: true, teks: 'Pengaturan Kop Surat Internal Document & Quotation disimpan & disinkronkan ke server.' });
  };

  const unggahLogoKopSurat = async (file?: File) => {
    if (!file) return;
    setSedangUnggahLogo(true);
    try {
      const hasil = await unggahFotoKeServer(file, {
        lebarMaks: 800,
        kualitas: 0.88,
        pertahankanTransparansi: true,
        visibility: 'public',
        scope: 'dokumen-internal'
      });
      const next: IdentitasKopDokumenInternal = {
        ...identitas,
        tampilkanLogo: true,
        logoUrl: hasil.referensi
      };
      setIdentitas(next);
      simpanIdentitasKop(next);
    } catch (err) {
      setPesanStatus({
        ok: false,
        teks: err instanceof Error ? err.message : 'Gagal mengunggah logo Kop Surat ke server.'
      });
    } finally {
      setSedangUnggahLogo(false);
    }
  };

  const tanganiUnduhPdf = async () => {
    setSedangUnduhPdf(true);
    try {
      await unduhDokumenInternalPdfA4(draf, identitas, logoResolved);
      db.logAudit('Dokumen Internal CDAKB', 'Ekspor PDF A4 Dokumen Terkendali', draf.nomorDokumen, namaAktor, LABEL_TINGKAT_PERAN[tingkatPeran]);
    } finally {
      setSedangUnduhPdf(false);
    }
  };

  const renderDynamicField = (field: DefinisiFieldDinamis) => {
    const val = draf.dataDinamis[field.key];
    const disabled = !aksiWorkflow.dapatEditKonten;
    const updateVal = (nextVal: string | number | boolean) =>
      setDraf((prev) => ({
        ...prev,
        dataDinamis: { ...prev.dataDinamis, [field.key]: nextVal }
      }));

    return (
      <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
        <label className={labelClass}>
          {field.label}
          {field.required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            rows={3}
            disabled={disabled}
            value={String(val ?? '')}
            placeholder={field.placeholder}
            onChange={(e) => updateVal(e.target.value)}
            className={`${inputClass} disabled:bg-slate-50`}
          />
        ) : field.type === 'select' ? (
          <select
            disabled={disabled}
            value={String(val ?? '')}
            onChange={(e) => updateVal(e.target.value)}
            className={`${inputClass} bg-white disabled:bg-slate-50`}
          >
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : field.type === 'boolean' ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 mt-1">
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(val)}
              onChange={(e) => updateVal(e.target.checked)}
            />
            <span>Ya / Sesuai Standar</span>
          </label>
        ) : (
          <input
            type={
              field.type === 'date'
                ? 'date'
                : field.type === 'number' || field.type === 'currency'
                  ? 'number'
                  : 'text'
            }
            disabled={disabled}
            value={val === undefined || val === null ? '' : String(val)}
            placeholder={field.placeholder}
            onChange={(e) =>
              updateVal(
                field.type === 'number' || field.type === 'currency'
                  ? e.target.value === ''
                    ? ''
                    : Number(e.target.value)
                  : e.target.value
              )
            }
            className={`${inputClass} disabled:bg-slate-50`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* HEADER & ACTION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Dokumen Terkendali CDAKB &amp; Penawaran Komersial Terintegrasi
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              Internal Document
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Standarisasi 18 formulir terstandar lintas 6 kategori (termasuk Quotation B2B/LKPP) dengan auto-numbering, form input dinamis, ketertelusuran NIE AKL/AKD &amp; Batch FEFO, approval berjenjang, serta PDF A4 ber-QR Code.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={buatQuotationCepat}
              disabled={!hakPeran.bisaBuatDraft}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <FilePlus2 className="w-4 h-4" />
              Buat Quotation
            </button>
            <button
              type="button"
              onClick={() => setModalBuatTerbuka(true)}
              disabled={!hakPeran.bisaBuatDraft}
              className={`${tombolPrimer} disabled:opacity-50`}
            >
              <FilePlus2 className="w-4 h-4" />
              Buat Dokumen Baru
            </button>
            <button
              type="button"
              onClick={duplikatSebagaiDraft}
              disabled={!hakPeran.bisaBuatDraft}
              className={`${tombolSekunder} inline-flex items-center gap-1.5 font-semibold disabled:opacity-50`}
            >
              <Copy className="w-3.5 h-3.5" />
              Duplikat
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={`${tombolSekunder} inline-flex items-center gap-1.5 font-semibold`}
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>
            <button
              type="button"
              onClick={() => void tanganiUnduhPdf()}
              disabled={sedangUnduhPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {sedangUnduhPdf ? 'Menyusun PDF…' : 'Export PDF A4'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Stat label="Total Dokumen Internal" value={kpi.total} hint="Seluruh dokumen aktif & arsip" />
          <Stat
            label="Menunggu Review / Approval"
            value={kpi.menungguApproval}
            tone={kpi.menungguApproval > 0 ? 'amber' : 'emerald'}
            hint="Submitted & Reviewed"
          />
          <Stat
            label="Disetujui & Arsip Terkunci"
            value={kpi.disetujuiTutup}
            tone="emerald"
            hint="Terverifikasi QR Digital"
          />
          <Stat
            label="Baris Batch Alkes Tertelusur"
            value={kpi.totalBatchTertelusur}
            tone="blue"
            hint="Terhubung NIE AKL/AKD & Batch"
          />
        </div>
      </div>

      {pesanStatus && (
        <div
          role="status"
          className={`no-print rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 ${
            pesanStatus.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{pesanStatus.teks}</span>
          <button
            type="button"
            onClick={() => setPesanStatus(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* WORKFLOW BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-slate-900">{draf.nomorDokumen}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 font-semibold">{draf.kodeFormIso} {draf.versiForm}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Revisi ke-{draf.revisiKe}</span>
              <Badge tone={TONE_STATUS[draf.status]}>{draf.status}</Badge>
            </div>
            {/* Stepper Status */}
            <div className="flex flex-wrap items-center gap-1.5 text-2xs">
              {(['Draft', 'Submitted', 'Reviewed', 'Approved', 'Closed'] as StatusDokumenInternal[]).map((st, i) => {
                const aktif = draf.status === st;
                const ditolak = draf.status === 'Rejected' && st === 'Reviewed';
                return (
                  <div key={st} className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold border ${
                        ditolak
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : aktif
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {ditolak ? 'Rejected' : st}
                    </span>
                    {i < 4 && <span className="text-slate-300">→</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {aksiWorkflow.dapatEditKonten && (
              <button type="button" onClick={simpanDraftAktif} className={`${tombolSekunder} inline-flex items-center gap-1.5 font-semibold`}>
                <Save className="w-3.5 h-3.5" />
                Simpan Draft
              </button>
            )}
            {aksiWorkflow.dapatSubmit && (
              <button type="button" onClick={() => eksekusiWorkflow('submit')} className={tombolPrimer}>
                <Send className="w-3.5 h-3.5" />
                Ajukan (Submit)
              </button>
            )}
            {aksiWorkflow.dapatReview && (
              <button
                type="button"
                onClick={() => eksekusiWorkflow('review', 'Terverifikasi sesuai standar CDAKB')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                Tandai Reviewed
              </button>
            )}
            {aksiWorkflow.dapatApprove && (
              <button
                type="button"
                onClick={() => eksekusiWorkflow('approve', 'Disetujui dengan Tanda Tangan QR')}
                className={tombolPrimer}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve &amp; Tanda Tangan QR
              </button>
            )}
            {aksiWorkflow.dapatReject && (
              <button type="button" onClick={() => setModalTolakTerbuka(true)} className={tombolBahaya}>
                <XCircle className="w-3.5 h-3.5" />
                Tolak (Reject)
              </button>
            )}
            {aksiWorkflow.dapatRevisi && (
              <button
                type="button"
                onClick={() => eksekusiWorkflow('revisi', 'Membuka revisi perbaikan dokumen')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Buat Revisi (Rev.{draf.revisiKe + 1})
              </button>
            )}
            {aksiWorkflow.dapatClose && (
              <button
                type="button"
                onClick={() => eksekusiWorkflow('close')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Archive className="w-3.5 h-3.5" />
                Tutup Arsip (Closed)
              </button>
            )}
          </div>
        </div>
        {aksiWorkflow.alasanTerkunci && (
          <p className="mt-2.5 text-2xs text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{aksiWorkflow.alasanTerkunci}</span>
            <span>· Peran Anda: <strong>{LABEL_TINGKAT_PERAN[tingkatPeran]}</strong></span>
          </p>
        )}
        {TARGET_KONVERSI_DOKUMEN[draf.jenisDokumen]?.length ? (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wide mr-1">
              Integrasi Lintas Dokumen:
            </span>
            {TARGET_KONVERSI_DOKUMEN[draf.jenisDokumen]!.map((target) => (
              <button
                key={target.jenis}
                type="button"
                disabled={!hakPeran.bisaBuatDraft}
                onClick={() => konversiAktifKeTurunan(target.jenis)}
                className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-2xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightCircle className="w-3.5 h-3.5 text-teal-700" />
                {target.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* MAIN SPLIT WORKSPACE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI: EDITOR DINAMIS, ITEM ALKES, WORKFLOW, DAFTAR, KOP, RBAC */}
        <div className="xl:col-span-5 space-y-4 no-print">
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(
              [
                ['form', 'Form Dinamis', FileText],
                ['items', `Alkes (${draf.items.length})`, PackagePlus],
                ['workflow', 'Approval & Revisi', History],
                ['daftar', `Daftar (${daftar.length})`, ClipboardList],
                ['kop', 'Kop Surat', Settings2],
                ['rbac', 'Matriks RBAC', ShieldCheck]
              ] as const
            ).map(([id, label, Ikon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubPanel(id)}
                className={`flex-1 min-w-fit px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  subPanel === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Ikon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {subPanel === 'form' && (
            <Panel
              judul={`Editor: ${skemaAktif.nama}`}
              keterangan={`${katAktif.label} · ${skemaAktif.deskripsi}`}
            >
              <fieldset disabled={!aksiWorkflow.dapatEditKonten} className="space-y-4 disabled:opacity-75">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Judul / Perihal Dokumen *</label>
                    <input
                      type="text"
                      value={draf.judul}
                      onChange={(e) => setDraf((p) => ({ ...p, judul: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Departemen Pemilik</label>
                    <input
                      type="text"
                      value={draf.departemen}
                      onChange={(e) => setDraf((p) => ({ ...p, departemen: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tanggal Dokumen</label>
                    <input
                      type="date"
                      value={draf.tanggalDokumen}
                      onChange={(e) => setDraf((p) => ({ ...p, tanggalDokumen: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Prioritas Dokumen</label>
                    <select
                      value={draf.prioritas}
                      onChange={(e) =>
                        setDraf((p) => ({ ...p, prioritas: e.target.value as DokumenInternal['prioritas'] }))
                      }
                      className={`${inputClass} bg-white`}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Prioritas">Prioritas</option>
                      <option value="Kritis CDAKB">Kritis CDAKB</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>No. Referensi Silang (Opsional)</label>
                    <input
                      type="text"
                      value={draf.referensiDokumen ?? ''}
                      placeholder="SO / PR / NCR terkait"
                      onChange={(e) => setDraf((p) => ({ ...p, referensiDokumen: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Pihak Terkait */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-800">{skemaAktif.labelPihakTerkait}</h4>
                    {pelangganList.length > 0 && (
                      <select
                        value=""
                        disabled={!aksiWorkflow.dapatEditKonten}
                        onChange={(e) => {
                          const p = pelangganList.find((x) => x.id === e.target.value);
                          if (!p) return;
                          setDraf((prev) => ({
                            ...prev,
                            pihakTerkait: {
                              ...prev.pihakTerkait,
                              instansi: p.namaInstalasi,
                              namaPihak: p.penanggungJawabPengadaan || prev.pihakTerkait.namaPihak || 'Pejabat Pengadaan / PPK',
                              jabatan: prev.pihakTerkait.jabatan || 'Pejabat Pengadaan / PPK',
                              alamat: `${p.provinsi} (${p.rayonDistribusi})`
                            }
                          }));
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-2xs text-slate-700 disabled:bg-slate-50"
                      >
                        <option value="">Isi cepat dari Pelanggan B2B / Fasyankes…</option>
                        {pelangganList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.namaInstalasi} — {p.provinsi}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Instansi / Bagian</label>
                      <input
                        type="text"
                        value={draf.pihakTerkait.instansi}
                        onChange={(e) =>
                          setDraf((p) => ({
                            ...p,
                            pihakTerkait: { ...p.pihakTerkait, instansi: e.target.value }
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Nama PIC</label>
                      <input
                        type="text"
                        value={draf.pihakTerkait.namaPihak}
                        onChange={(e) =>
                          setDraf((p) => ({
                            ...p,
                            pihakTerkait: { ...p.pihakTerkait, namaPihak: e.target.value }
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Jabatan</label>
                      <input
                        type="text"
                        value={draf.pihakTerkait.jabatan}
                        onChange={(e) =>
                          setDraf((p) => ({
                            ...p,
                            pihakTerkait: { ...p.pihakTerkait, jabatan: e.target.value }
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Kontak</label>
                      <input
                        type="text"
                        value={draf.pihakTerkait.kontak}
                        onChange={(e) =>
                          setDraf((p) => ({
                            ...p,
                            pihakTerkait: { ...p.pihakTerkait, kontak: e.target.value }
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Alamat / Lokasi</label>
                      <input
                        type="text"
                        value={draf.pihakTerkait.alamat}
                        onChange={(e) =>
                          setDraf((p) => ({
                            ...p,
                            pihakTerkait: { ...p.pihakTerkait, alamat: e.target.value }
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic Fields sesuai skema jenis dokumen */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">
                    Field Khusus Formulir ({skemaAktif.kodeFormIso})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {skemaAktif.fields.map(renderDynamicField)}
                  </div>
                </div>
              </fieldset>
            </Panel>
          )}

          {subPanel === 'items' && (
            <Panel
              judul="Ketertelusuran Alkes (AKL/AKD, Batch & ED)"
              keterangan="Setiap baris item terhubung ke Nomor Izin Edar Kemenkes RI, Nomor Batch/Lot, dan Expired Date sesuai CDAKB."
              aksi={
                aksiWorkflow.dapatEditKonten && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModalAlkesTerbuka(true)}
                      className={tombolPrimer}
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Pilih dari Stok/NIE
                    </button>
                    <button
                      type="button"
                      onClick={tambahItemKosong}
                      className={`${tombolSekunder} inline-flex items-center gap-1 font-semibold`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Baris Manual
                    </button>
                  </div>
                )
              }
            >
              <div className="space-y-3">
                {draf.items.length === 0 && (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-2">
                    <p>
                      {skemaAktif.wajibTraceabilityAlkes
                        ? 'Tambahkan minimal 1 item alkes dengan NIE AKL/AKD dan Nomor Batch untuk kelengkapan dokumen ini.'
                        : 'Dokumen kategori ini tidak mewajibkan rincian batch alkes, namun tetap dapat dilampirkan bila relevan.'}
                    </p>
                  </div>
                )}

                {draf.items.map((item, idx) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">Item #{idx + 1}</span>
                      {aksiWorkflow.dapatEditKonten && (
                        <button
                          type="button"
                          onClick={() => hapusItem(item.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          aria-label="Hapus item alkes"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Nama Alkes / Produk</label>
                        <input
                          disabled={!aksiWorkflow.dapatEditKonten}
                          value={item.namaProduk}
                          onChange={(e) => perbaruiItem(item.id, { namaProduk: e.target.value })}
                          className={`${inputClass} bg-white`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nomor Izin Edar (AKL/AKD)</label>
                        <input
                          disabled={!aksiWorkflow.dapatEditKonten}
                          value={item.nomorIzinEdar}
                          onChange={(e) => perbaruiItem(item.id, { nomorIzinEdar: e.target.value })}
                          className={`${inputClass} bg-white font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nomor Batch / Lot</label>
                        <input
                          disabled={!aksiWorkflow.dapatEditKonten}
                          value={item.nomorBatch}
                          onChange={(e) => perbaruiItem(item.id, { nomorBatch: e.target.value })}
                          className={`${inputClass} bg-white font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Expired Date (YYYY-MM-DD / -)</label>
                        <input
                          disabled={!aksiWorkflow.dapatEditKonten}
                          value={item.expiredDate}
                          placeholder="2028-12-31"
                          onChange={(e) => perbaruiItem(item.id, { expiredDate: e.target.value })}
                          className={`${inputClass} bg-white`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nomor Serial (Opsional)</label>
                        <input
                          disabled={!aksiWorkflow.dapatEditKonten}
                          value={item.nomorSerial ?? ''}
                          onChange={(e) => perbaruiItem(item.id, { nomorSerial: e.target.value })}
                          className={`${inputClass} bg-white font-mono`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Qty</label>
                          <input
                            type="number"
                            min={1}
                            disabled={!aksiWorkflow.dapatEditKonten}
                            value={item.qty}
                            onChange={(e) => perbaruiItem(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                            className={`${inputClass} bg-white`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Satuan</label>
                          <input
                            disabled={!aksiWorkflow.dapatEditKonten}
                            value={item.satuan}
                            onChange={(e) => perbaruiItem(item.id, { satuan: e.target.value })}
                            className={`${inputClass} bg-white`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>
                          {skemaAktif.tampilkanNilaiFinansial ? 'Harga Satuan (Rp)' : 'Suhu / Kondisi Fisik'}
                        </label>
                        {skemaAktif.tampilkanNilaiFinansial ? (
                          <input
                            type="number"
                            min={0}
                            disabled={!aksiWorkflow.dapatEditKonten}
                            value={item.hargaSatuan ?? 0}
                            onChange={(e) => perbaruiItem(item.id, { hargaSatuan: Math.max(0, Number(e.target.value) || 0) })}
                            className={`${inputClass} bg-white`}
                          />
                        ) : (
                          <input
                            disabled={!aksiWorkflow.dapatEditKonten}
                            value={item.kondisiFisik ?? ''}
                            onChange={(e) => perbaruiItem(item.id, { kondisiFisik: e.target.value })}
                            className={`${inputClass} bg-white`}
                          />
                        )}
                      </div>
                      {skemaAktif.tampilkanNilaiFinansial && (
                        <>
                          <div>
                            <label className={labelClass}>Diskon Item (%)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              disabled={!aksiWorkflow.dapatEditKonten}
                              value={item.diskonPersen ?? 0}
                              onChange={(e) =>
                                perbaruiItem(item.id, {
                                  diskonPersen: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                                })
                              }
                              className={`${inputClass} bg-white`}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Spesifikasi / Catatan Penawaran Item</label>
                            <input
                              disabled={!aksiWorkflow.dapatEditKonten}
                              value={item.spesifikasi ?? ''}
                              placeholder="Contoh: Layar 12.1 inch, 5-lead ECG, baterai cadangan..."
                              onChange={(e) => perbaruiItem(item.id, { spesifikasi: e.target.value })}
                              className={`${inputClass} bg-white`}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {skemaAktif.tampilkanNilaiFinansial && draf.items.length > 0 && (() => {
                  const fin = hitungRingkasanFinansialDokumen(draf);
                  return (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Item (DPP)</span>
                        <span className="font-mono font-semibold">{formatRupiah(fin.subtotal)}</span>
                      </div>
                      {fin.diskonGlobal > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Diskon Global</span>
                          <span className="font-mono">- {formatRupiah(fin.diskonGlobal)}</span>
                        </div>
                      )}
                      {fin.pakaiPpn && (
                        <div className="flex justify-between text-slate-600">
                          <span>PPN ({fin.persenPpn}%)</span>
                          <span className="font-mono">{formatRupiah(fin.ppn)}</span>
                        </div>
                      )}
                      {fin.biayaLain > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>{fin.labelBiayaLain}</span>
                          <span className="font-mono">{formatRupiah(fin.biayaLain)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-teal-200 font-bold text-teal-900">
                        <span>Total Nilai Dokumen</span>
                        <span className="font-mono">{formatRupiah(fin.total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Panel>
          )}

          {subPanel === 'workflow' && (
            <Panel
              judul="Persetujuan Berjenjang & Riwayat Revisi"
              keterangan="Setiap perubahan status direkam dengan timestamp, identitas penandatangan, dan hash digital."
            >
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Rantai Persetujuan Dokumen</h4>
                  {draf.alurPersetujuan.map((step) => (
                    <div key={step.urutan} className="rounded-xl border border-slate-200 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          Tahap {step.urutan}: {step.labelTahap}
                        </span>
                        <Badge
                          tone={
                            step.status === 'Disetujui'
                              ? 'emerald'
                              : step.status === 'Ditolak'
                                ? 'rose'
                                : 'amber'
                          }
                        >
                          {step.status}
                        </Badge>
                      </div>
                      <p className="text-2xs text-slate-500">
                        Wewenang: {step.peranWajib.map((r) => LABEL_TINGKAT_PERAN[r]).join(' / ')}
                      </p>
                      {step.disetujuiOleh && (
                        <p className="text-2xs text-slate-700">
                          Oleh <strong>{step.disetujuiOleh}</strong> · {formatTanggal(step.waktu || '')}
                          {step.hashTandaTangan && (
                            <span className="font-mono text-teal-700 ml-1">({step.hashTandaTangan})</span>
                          )}
                        </p>
                      )}
                      {step.catatan && <p className="text-2xs text-slate-600 italic">“{step.catatan}”</p>}
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Audit Trail &amp; Riwayat Revisi</h4>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {draf.riwayatRevisi.map((rev, idx) => (
                      <div key={idx} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            Rev.{rev.revisiKe} · {rev.aksi}
                          </span>
                          <Badge tone={TONE_STATUS[rev.statusSesudah]}>{rev.statusSesudah}</Badge>
                        </div>
                        <p className="text-2xs text-slate-600">{rev.catatan}</p>
                        <p className="text-2xs text-slate-400">
                          {rev.oleh} · {new Date(rev.waktu).toLocaleString('id-ID')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {subPanel === 'daftar' && (
            <Panel
              judul="Repositori Dokumen Internal"
              keterangan="Pilih dokumen untuk ditinjau, disetujui, direvisi, atau diekspor ke PDF A4."
            >
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder="Cari No. Dokumen, judul, batch, atau AKL/AKD..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value as KategoriDokumenInternal | 'semua')}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="semua">Semua Kategori</option>
                    {Object.entries(KATEGORI_DOKUMEN_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as StatusDokumenInternal | 'semua')}
                    className={`${inputClass} bg-white`}
                  >
                    <option value="semua">Semua Status</option>
                    {STATUS_DOKUMEN_URUT.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {daftarTersaring.map((doc) => {
                    const terpilih = doc.id === draf.id;
                    return (
                      <div
                        key={doc.id}
                        className={`p-3 flex items-start justify-between gap-2 transition-colors ${
                          terpilih ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => pilihDokumen(doc)}
                          className="text-left min-w-0 flex-1 space-y-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900">{doc.nomorDokumen}</span>
                            <Badge tone={TONE_STATUS[doc.status]}>{doc.status}</Badge>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 line-clamp-1">{doc.judul}</p>
                          <p className="text-2xs text-slate-500">
                            {KATEGORI_DOKUMEN_META[doc.kategori].label} · Rev.{doc.revisiKe} · {formatTanggal(doc.tanggalDokumen)}
                          </p>
                        </button>
                        {doc.status === 'Draft' && hakPeran.bisaBuatDraft && (
                          <button
                            type="button"
                            onClick={() => hapusDraft(doc.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                            title="Hapus draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {daftarTersaring.length === 0 && (
                    <p className="p-6 text-center text-xs text-slate-500">Tidak ada dokumen sesuai filter.</p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {subPanel === 'kop' && (
            <Panel
              judul="Kop Surat Resmi & Warna Tema Dokumen"
              keterangan="Diterapkan otomatis pada pratinjau A4 dan seluruh cetakan PDF Internal Document & Quotation."
            >
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-bold text-slate-800">Logo Kop Surat (Tersimpan di Server)</label>
                    <label className="inline-flex items-center gap-1.5 text-2xs font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={identitas.tampilkanLogo}
                        onChange={(e) => setIdentitas((p) => ({ ...p, tampilkanLogo: e.target.checked }))}
                      />
                      Tampilkan Logo
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-28 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden p-1">
                      {identitas.logoUrl ? (
                        <img
                          src={selesaikanGambar(identitas.logoUrl)}
                          alt="Logo Kop Surat"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-3xs text-slate-400">Belum ada logo</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer">
                        <ImagePlus className="w-3.5 h-3.5" />
                        {sedangUnggahLogo ? 'Mengunggah…' : 'Unggah Logo'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={sedangUnggahLogo}
                          onChange={(e) => {
                            void unggahLogoKopSurat(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {identitas.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setIdentitas((p) => ({ ...p, logoUrl: '' }))}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Nama Perusahaan</label>
                  <input
                    value={identitas.namaPerusahaan}
                    onChange={(e) => setIdentitas((p) => ({ ...p, namaPerusahaan: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Tagline Standar</label>
                  <input
                    value={identitas.tagline}
                    onChange={(e) => setIdentitas((p) => ({ ...p, tagline: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Nomor Legalitas (SDAK / CPAKB / ISO 13485)</label>
                  <input
                    value={identitas.nomorLegalitas}
                    onChange={(e) => setIdentitas((p) => ({ ...p, nomorLegalitas: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelClass}>Kota Tanda Tangan</label>
                    <input
                      value={identitas.kotaTandaTangan}
                      onChange={(e) => setIdentitas((p) => ({ ...p, kotaTandaTangan: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Warna Aksen Kop</label>
                    <input
                      type="color"
                      value={identitas.warnaAksen}
                      onChange={(e) => setIdentitas((p) => ({ ...p, warnaAksen: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Alamat Perusahaan</label>
                  <textarea
                    rows={2}
                    value={identitas.alamat}
                    onChange={(e) => setIdentitas((p) => ({ ...p, alamat: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => simpanIdentitasKop()} className={tombolPrimer}>
                    <Check className="w-3.5 h-3.5" />
                    Simpan Pengaturan Kop
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {subPanel === 'rbac' && (
            <Panel
              judul="Matriks Hak Akses (RBAC) & Wewenang Approval"
              keterangan="Pembagian wewenang 5 tingkat peran sesuai regulasi CDAKB & kontrol internal."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-2xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th className="py-2 px-2">Peran</th>
                      <th className="py-2 px-1 text-center">Draft</th>
                      <th className="py-2 px-1 text-center">Submit</th>
                      <th className="py-2 px-1 text-center">Review</th>
                      <th className="py-2 px-1 text-center">Approve</th>
                      <th className="py-2 px-1 text-center">Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MATRIKS_RBAC_DOKUMEN.map((row) => (
                      <tr key={row.tingkat} className={row.tingkat === tingkatPeran ? 'bg-teal-50/60' : ''}>
                        <td className="py-2 px-2">
                          <p className="font-bold text-slate-900">{row.labelPeran}</p>
                          <p className="text-slate-500">{row.cakupanKategori}</p>
                        </td>
                        {[row.bisaBuatDraft, row.bisaSubmit, row.bisaReview, row.bisaApproveFinal, row.bisaClose].map(
                          (ok, i) => (
                            <td key={i} className="py-2 px-1 text-center font-bold">
                              {ok ? (
                                <span className="text-emerald-700">Ya</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        {/* KOLOM KANAN: LIVE A4 DOCUMENT PREVIEW & QR CODE */}
        <div className="xl:col-span-7 flex justify-center print:block">
          <div className="w-full max-w-[760px] min-h-[1046px] bg-white border border-slate-300 rounded-xl shadow-md p-6 sm:p-9 flex flex-col justify-between text-[11px] text-slate-900 print:max-w-none print:w-full print:min-h-0 print:border-none print:shadow-none print:p-2">
            <div className="space-y-5">
              {/* KOP SURAT PERUSAHAAN */}
              <div
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2"
                style={{ borderColor: identitas.warnaAksen || katAktif.warnaAksen }}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {identitas.tampilkanLogo && logoResolved && (
                    <img
                      src={logoResolved}
                      alt={identitas.namaPerusahaan}
                      className="h-14 max-w-[130px] object-contain shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h1 className="text-base font-extrabold tracking-wide uppercase text-slate-900 leading-tight">
                      {identitas.namaPerusahaan}
                    </h1>
                    {identitas.tagline && (
                      <p
                        className="text-[11px] font-bold mt-0.5"
                        style={{ color: identitas.warnaAksen || katAktif.warnaAksen }}
                      >
                        {identitas.tagline}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-1 leading-snug">{identitas.alamat}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {[identitas.telepon ? `Telp: ${identitas.telepon}` : '', identitas.email ? `Email: ${identitas.email}` : '', identitas.website]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                    {identitas.tampilkanLegalitas && identitas.nomorLegalitas && (
                      <p className="text-[9.5px] font-semibold text-slate-700 mt-1">{identitas.nomorLegalitas}</p>
                    )}
                  </div>
                </div>

                <div
                  className="px-4 py-2.5 rounded-lg text-white text-center shrink-0 self-start min-w-[165px]"
                  style={{ backgroundColor: identitas.warnaAksen || katAktif.warnaAksen }}
                >
                  <p className="text-sm font-extrabold tracking-widest">{skemaAktif.kodeNomor}</p>
                  <p className="text-[9px] font-semibold opacity-95 uppercase leading-tight mt-0.5">
                    {skemaAktif.nama}
                  </p>
                  <p className="text-[8.5px] font-mono opacity-90 mt-1">
                    {draf.kodeFormIso} ({draf.versiForm}) · Rev.{draf.revisiKe}
                  </p>
                </div>
              </div>

              {/* JUDUL + STATUS */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-sm font-extrabold text-slate-900 leading-snug max-w-xl">
                  {draf.judul}
                </h2>
                <Badge tone={TONE_STATUS[draf.status]}>{draf.status.toUpperCase()}</Badge>
              </div>

              {/* METADATA & PIHAK TERKAIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <p
                    className="text-[9.5px] font-bold uppercase tracking-wider"
                    style={{ color: identitas.warnaAksen || katAktif.warnaAksen }}
                  >
                    Metadata Pengendalian Dokumen
                  </p>
                  <div className="grid grid-cols-[100px_1fr] gap-y-1 text-[10px]">
                    <span className="text-slate-500">No. Dokumen</span>
                    <span className="font-bold font-mono text-slate-900">{draf.nomorDokumen}</span>
                    <span className="text-slate-500">Kategori</span>
                    <span className="font-semibold text-slate-900">{katAktif.label}</span>
                    <span className="text-slate-500">Departemen</span>
                    <span className="font-semibold text-slate-900">{draf.departemen}</span>
                    <span className="text-slate-500">Tanggal Terbit</span>
                    <span className="font-semibold text-slate-900">{formatTanggal(draf.tanggalDokumen)}</span>
                    <span className="text-slate-500">Prioritas / Ref.</span>
                    <span className="font-semibold text-slate-900">
                      {draf.prioritas}
                      {draf.referensiDokumen ? ` · ${draf.referensiDokumen}` : ''}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <p
                    className="text-[9.5px] font-bold uppercase tracking-wider"
                    style={{ color: identitas.warnaAksen || katAktif.warnaAksen }}
                  >
                    {skemaAktif.labelPihakTerkait}
                  </p>
                  <p className="text-xs font-extrabold text-slate-900">
                    {draf.pihakTerkait.instansi || draf.pihakTerkait.namaPihak || '-'}
                  </p>
                  {draf.pihakTerkait.namaPihak && (
                    <p className="text-[10px] text-slate-700">
                      PIC: {draf.pihakTerkait.namaPihak}
                      {draf.pihakTerkait.jabatan ? ` · ${draf.pihakTerkait.jabatan}` : ''}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-600 leading-relaxed">{draf.pihakTerkait.alamat || '-'}</p>
                  {draf.pihakTerkait.kontak && (
                    <p className="text-[9.5px] text-slate-500">Kontak: {draf.pihakTerkait.kontak}</p>
                  )}
                </div>
              </div>

              {/* TABEL DATA DINAMIS */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div
                  className="px-3 py-1.5 text-white text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: identitas.warnaAksen || katAktif.warnaAksen }}
                >
                  Rincian Data Formulir ({skemaAktif.nama})
                </div>
                <table className="w-full text-left border-collapse text-[10px]">
                  <tbody className="divide-y divide-slate-200">
                    {skemaAktif.fields
                      .filter(
                        (field) =>
                          !(
                            draf.jenisDokumen === 'quotation' &&
                            (field.key === 'syaratKetentuan' ||
                              field.key === 'catatanTambahan' ||
                              field.key === 'pakaiPpn' ||
                              field.key === 'persenPpn' ||
                              field.key === 'diskonGlobalRp' ||
                              field.key === 'biayaLainRp' ||
                              field.key === 'labelBiayaLain')
                          )
                      )
                      .map((field, idx) => {
                      const raw = draf.dataDinamis[field.key];
                      let display = raw === undefined || raw === null || raw === '' ? '-' : String(raw);
                      if (field.type === 'date' && raw) display = formatTanggal(String(raw));
                      if (field.type === 'currency' && raw !== '' && raw !== undefined) {
                        const n = Number(raw);
                        display = Number.isFinite(n) ? formatRupiah(n) : String(raw);
                      }
                      if (field.type === 'boolean') display = raw ? 'Ya / Memenuhi' : 'Tidak';

                      return (
                        <tr key={field.key} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                          <td className="py-2 px-3 w-52 font-semibold text-slate-600 align-top">{field.label}</td>
                          <td className="py-2 px-3 text-slate-900 whitespace-pre-line">{display}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABEL KETERTELUSURAN ALKES */}
              {(draf.items.length > 0 || skemaAktif.wajibTraceabilityAlkes) && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="text-white" style={{ backgroundColor: identitas.warnaAksen || katAktif.warnaAksen }}>
                        <th className="py-2 px-2 text-center w-8">No</th>
                        <th className="py-2 px-2.5">Nama Alkes / Tipe / Izin Edar (AKL/AKD)</th>
                        <th className="py-2 px-2">No. Batch &amp; Serial</th>
                        <th className="py-2 px-2 text-center">Exp. Date</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-2 text-right">
                          {skemaAktif.tampilkanNilaiFinansial ? 'Subtotal' : 'Suhu / Kondisi'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {draf.items.map((item, idx) => {
                        const kotor = (item.qty || 0) * (item.hargaSatuan || 0);
                        const subtotalNet = Math.round(kotor * (1 - (item.diskonPersen || 0) / 100));
                        return (
                        <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                          <td className="py-2 px-2 text-center text-slate-500 align-top">{idx + 1}</td>
                          <td className="py-2 px-2.5 align-top">
                            <p className="font-bold text-slate-900">{item.namaProduk || '-'}</p>
                            <p className="text-[9px] font-semibold" style={{ color: identitas.warnaAksen }}>
                              {[
                                item.tipeModel ? `Tipe: ${item.tipeModel}` : '',
                                item.nomorIzinEdar ? `NIE: ${item.nomorIzinEdar}` : ''
                              ]
                                .filter(Boolean)
                                .join(' | ')}
                            </p>
                            {item.spesifikasi && (
                              <p className="text-[8.5px] text-slate-500 mt-0.5">{item.spesifikasi}</p>
                            )}
                          </td>
                          <td className="py-2 px-2 font-mono text-[9.5px] align-top">
                            <div className="font-bold text-slate-800">{item.nomorBatch || '-'}</div>
                            {item.nomorSerial && <div className="text-slate-500">SN: {item.nomorSerial}</div>}
                          </td>
                          <td className="py-2 px-2 text-center tabular-nums align-top whitespace-nowrap">
                            {item.expiredDate && item.expiredDate !== '-' ? formatTanggal(item.expiredDate) : '-'}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold tabular-nums align-top whitespace-nowrap">
                            {item.qty} {item.satuan}
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {skemaAktif.tampilkanNilaiFinansial ? (
                              <div>
                                <div className="font-mono font-bold">{formatRupiah(subtotalNet)}</div>
                                {((item.hargaSatuan || 0) > 0 || (item.diskonPersen || 0) > 0) && (
                                  <div className="text-[8.5px] text-slate-500 font-mono">
                                    @{formatRupiah(item.hargaSatuan || 0)}
                                    {(item.diskonPersen || 0) > 0 ? ` (-${item.diskonPersen}%)` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-600">
                                {[item.suhuPenyimpanan, item.kondisiFisik].filter(Boolean).join(' · ') || '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                      {draf.items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-5 text-center text-slate-400 italic">
                            Belum ada item ketertelusuran alkes pada tab Alkes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {skemaAktif.tampilkanNilaiFinansial && draf.items.length > 0 && (
                    draf.jenisDokumen === 'quotation' ? (() => {
                      const fin = hitungRingkasanFinansialDokumen(draf);
                      return (
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                          <div className="w-64 space-y-1 text-[10px]">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal (DPP)</span>
                              <span className="font-mono font-semibold">{formatRupiah(fin.subtotal)}</span>
                            </div>
                            {fin.diskonGlobal > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>Diskon Global</span>
                                <span className="font-mono">- {formatRupiah(fin.diskonGlobal)}</span>
                              </div>
                            )}
                            {fin.pakaiPpn && (
                              <div className="flex justify-between text-slate-600">
                                <span>PPN ({fin.persenPpn}%)</span>
                                <span className="font-mono">{formatRupiah(fin.ppn)}</span>
                              </div>
                            )}
                            {fin.biayaLain > 0 && (
                              <div className="flex justify-between text-slate-600">
                                <span>{fin.labelBiayaLain}</span>
                                <span className="font-mono">{formatRupiah(fin.biayaLain)}</span>
                              </div>
                            )}
                            <div
                              className="flex justify-between items-center px-2.5 py-1.5 rounded text-white font-bold text-[11px] mt-1"
                              style={{ backgroundColor: identitas.warnaAksen || katAktif.warnaAksen }}
                            >
                              <span>TOTAL PENAWARAN</span>
                              <span className="font-mono">{formatRupiah(fin.total)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold text-xs">
                        <span>Total Nilai Item</span>
                        <span className="font-mono" style={{ color: identitas.warnaAksen }}>
                          {formatRupiah(hitungNilaiTotalItems(draf.items))}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {draf.jenisDokumen === 'quotation' &&
                (String(draf.dataDinamis.syaratKetentuan || '').trim() ||
                  String(draf.dataDinamis.catatanTambahan || '').trim()) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-[9.5px]">
                    <p
                      className="font-bold uppercase tracking-wider"
                      style={{ color: identitas.warnaAksen || katAktif.warnaAksen }}
                    >
                      Syarat &amp; Ketentuan Penawaran
                    </p>
                    {String(draf.dataDinamis.syaratKetentuan || '').trim() && (
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                        {String(draf.dataDinamis.syaratKetentuan)}
                      </p>
                    )}
                    {String(draf.dataDinamis.catatanTambahan || '').trim() && (
                      <p className="text-slate-600 italic pt-1 border-t border-slate-200">
                        Catatan: {String(draf.dataDinamis.catatanTambahan)}
                      </p>
                    )}
                  </div>
                )}

              {/* BLOK TANDA TANGAN MULTI-LEVEL & QR CODE */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-stretch justify-between gap-4">
                <div className="grid grid-cols-3 gap-3 flex-1 text-[9.5px]">
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-slate-600">1. Dibuat Oleh</p>
                      <p className="text-[8.5px] font-bold text-teal-700 mt-0.5">[DIAJUKAN]</p>
                    </div>
                    <div className="mt-6 pt-1.5 border-t border-slate-300">
                      <p className="font-bold text-slate-900 leading-tight">{draf.dibuatOleh}</p>
                      <p className="text-[8.5px] text-slate-500">{formatTanggal(draf.tanggalDokumen)}</p>
                    </div>
                  </div>
                  {draf.alurPersetujuan.map((l, idx) => (
                    <div key={l.urutan} className="flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-slate-600">
                          {idx + 2}. {idx === 0 ? 'Ditinjau' : 'Disetujui'}
                        </p>
                        <p
                          className={`text-[8.5px] font-bold mt-0.5 ${
                            l.status === 'Disetujui'
                              ? 'text-emerald-700'
                              : l.status === 'Ditolak'
                                ? 'text-rose-700'
                                : 'text-slate-400'
                          }`}
                        >
                          [{l.status.toUpperCase()}]
                        </p>
                        {l.hashTandaTangan && (
                          <p className="font-mono text-[8px] text-slate-500 mt-0.5">{l.hashTandaTangan}</p>
                        )}
                      </div>
                      <div className="mt-6 pt-1.5 border-t border-slate-300">
                        <p className="font-bold text-slate-900 leading-tight">
                          {l.disetujuiOleh || 'Menunggu Pejabat'}
                        </p>
                        <p className="text-[8.5px] text-slate-500">
                          {l.waktu ? formatTanggal(l.waktu) : l.peranWajib.map((r) => LABEL_TINGKAT_PERAN[r]).join(' / ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4 shrink-0">
                  {qrPreviewUrl ? (
                    <img src={qrPreviewUrl} alt="QR Verifikasi Dokumen" className="w-20 h-20 rounded border border-slate-200 bg-white p-0.5" />
                  ) : (
                    <div className="w-20 h-20 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-400">
                      <QrCode className="w-7 h-7" />
                    </div>
                  )}
                  <span className="mt-1 text-[8px] font-bold text-teal-800 tracking-wide">VERIFIKASI QR CDAKB</span>
                  <span className="font-mono text-[8px] text-slate-500">{draf.tandaTanganDigital.sha256Ringkas}</span>
                </div>
              </div>
            </div>

            {/* FOOTER DOKUMEN A4 */}
            <div className="pt-4 mt-6 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
              <span>
                {identitas.namaPerusahaan} · {draf.nomorDokumen} ({draf.kodeFormIso} {draf.versiForm})
              </span>
              <span>Dokumen Internal Terkendali CDAKB · A4</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PILIH JENIS DOKUMEN BARU */}
      {modalBuatTerbuka && (
        <Modal
          onClose={() => setModalBuatTerbuka(false)}
          judul="Buat Dokumen Internal Baru"
          keterangan="Pilih salah satu dari 18 standar formulir CDAKB, ISO 13485 & Penawaran Komersial sesuai kategori."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(KATEGORI_DOKUMEN_META) as Array<[KategoriDokumenInternal, (typeof KATEGORI_DOKUMEN_META)[KategoriDokumenInternal]]>).map(
                ([katId, meta]) => (
                  <button
                    key={katId}
                    type="button"
                    onClick={() => setKategoriPilihBaru(katId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      kategoriPilihBaru === katId
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {SKEMA_DOKUMEN_INTERNAL.filter((s) => s.kategori === kategoriPilihBaru).map((skema) => (
                <button
                  key={skema.jenis}
                  type="button"
                  onClick={() => buatDokumenDariModal(skema.jenis)}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left flex items-start justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{skema.nama}</span>
                      <span className="font-mono text-2xs text-teal-700 font-bold">
                        {skema.kodeNomor} · {skema.kodeFormIso}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-600 mt-1">{skema.deskripsi}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-2xs font-bold shrink-0">
                    Pilih
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PILIH ALKES SISTEM */}
      {modalAlkesTerbuka && (
        <Modal
          onClose={() => setModalAlkesTerbuka(false)}
          judul="Pilih Alkes dari Stok FEFO & Register NIE"
          keterangan="Data Izin Edar (AKL/AKD), Nomor Batch, dan Expired Date ditarik otomatis ke tabel dokumen."
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={cariAlkes}
                onChange={(e) => setCariAlkes(e.target.value)}
                placeholder="Cari nama alat kesehatan, batch, atau nomor AKL/AKD..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {alkesTersaring.map((opt) => (
                <div key={opt.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-slate-900 truncate">{opt.namaProduk}</p>
                      {opt.sumberLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600 shrink-0">
                          {opt.sumberLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-500 font-mono">
                      NIE: {opt.nomorIzinEdar} · Batch: {opt.nomorBatch} · ED: {opt.expiredDate}
                    </p>
                    <p className="text-2xs text-slate-500">
                      Stok bebas: <strong>{opt.stokTersedia}</strong> {opt.satuan}
                      {opt.hargaReferensi > 0 && (
                        <span> · Harga Ref: <strong className="text-teal-800">{formatRupiah(opt.hargaReferensi)}</strong></span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => tambahItemDariSistem(opt)}
                    className={tombolPrimer}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL TOLAK DOKUMEN */}
      {modalTolakTerbuka && (
        <Modal
          onClose={() => setModalTolakTerbuka(false)}
          judul="Tolak Dokumen (Reject)"
          keterangan="Masukkan alasan penolakan atau poin koreksi yang harus diperbaiki pada revisi berikutnya."
        >
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Alasan Penolakan (Wajib Audit Trail CDAKB)</label>
              <textarea
                rows={3}
                value={catatanWorkflow}
                onChange={(e) => setCatatanWorkflow(e.target.value)}
                placeholder="Contoh: Nomor batch belum sesuai dengan hasil QC inbound atau lampiran CoA belum lengkap..."
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalTolakTerbuka(false)} className={tombolSekunder}>
                Batal
              </button>
              <button
                type="button"
                onClick={() => eksekusiWorkflow('reject', catatanWorkflow)}
                className={tombolBahaya}
              >
                <XCircle className="w-3.5 h-3.5" />
                Konfirmasi Tolak Dokumen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
