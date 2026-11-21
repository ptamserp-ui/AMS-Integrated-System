import type { GudangTabId } from '../components/modules/operations/gudang/ui';
import type { SalesTab } from '../components/modules/commercial/SalesModule';
import type { ITSubTabId } from '../components/modules/supporting/ITModule';
import type { AksesEfektif, ModuleNavId, RbacResourceId } from '../types';
import type { SesiLogin } from './autentikasi';
import { bolehAksesModul } from './hakAkses';

export const PESAN_AKSES_PENCARIAN_DITOLAK =
  'Kredensial anda tidak memenuhi syarat, silahkan menghubungi supervisor anda. Seluruh riwayat pencarian tersimpan otomatis dalam log.';

export interface SearchCollectionMeta {
  key: string;
  label: string;
  moduleId: ModuleNavId;
  moduleLabel: string;
  extraResource?: RbacResourceId;
  salesSubTab?: SalesTab;
  itSubTab?: ITSubTabId;
  gudangTab?: GudangTabId;
}

export const SEARCH_COLLECTION_META: readonly SearchCollectionMeta[] = [
  // Regulatory Affairs & PJT
  { key: 'izin_edar', label: 'Izin Edar Alkes (NIE)', moduleId: 'ra-pjt', moduleLabel: 'Regulatory Affairs (RA & PJT)' },
  { key: 'sertifikat', label: 'Sertifikat Perusahaan', moduleId: 'ra-pjt', moduleLabel: 'Regulatory Affairs (RA & PJT)' },

  // QA & QC
  { key: 'dokumen_mutu', label: 'Dokumen Mutu (SOP/IK)', moduleId: 'qa-mutu', moduleLabel: 'Quality Assurance (QA)' },
  { key: 'capa', label: 'Catatan CAPA', moduleId: 'qa-mutu', moduleLabel: 'Quality Assurance (QA)' },
  { key: 'produk_kembalian', label: 'Produk Kembalian & Karantina', moduleId: 'qa-mutu', moduleLabel: 'Quality Assurance (QA)' },
  { key: 'audit_internal_iso', label: 'Audit Internal ISO 13485', moduleId: 'qa-mutu', moduleLabel: 'Quality Assurance (QA)' },
  { key: 'inspeksi_qc', label: 'Inspeksi Quality Control', moduleId: 'qc-inspeksi', moduleLabel: 'Quality Control (QC)' },

  // PMS / Vigilance
  { key: 'laporan_ktd', label: 'Laporan KTD (Vigilance)', moduleId: 'pms-vigilance', moduleLabel: 'Post-Market Surveillance (PMS)' },
  { key: 'penarikan_produk', label: 'Penarikan Produk (Recall)', moduleId: 'pms-vigilance', moduleLabel: 'Post-Market Surveillance (PMS)' },

  // Warehouse & Logistics
  { key: 'stok_gudang', label: 'Stok Gudang & Batch FEFO', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', extraResource: 'gudang-mutasi', gudangTab: 'stok' },
  { key: 'log_suhu', label: 'Log Suhu Cold Chain', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'rantai-dingin' },
  { key: 'pest_control', label: 'Pengendalian Hama', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'hama' },
  { key: 'gudang_unit', label: 'Daftar Gudang Fisik', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'struktur' },
  { key: 'gudang_bin', label: 'Lokasi Rak / Bin Gudang', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'struktur' },
  { key: 'gudang_aturan_simpan', label: 'Aturan Put-Away', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'struktur' },
  { key: 'gudang_pergerakan', label: 'Jejak Pergerakan Stok', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', extraResource: 'gudang-mutasi', gudangTab: 'stok' },
  { key: 'gudang_penerimaan', label: 'Penerimaan Inbound', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', extraResource: 'gudang-penerimaan', gudangTab: 'inbound' },
  { key: 'gudang_surat_jalan', label: 'Surat Jalan Outbound', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'outbound' },
  { key: 'gudang_opname', label: 'Opname & Cycle Count', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'opname' },
  { key: 'gudang_ambang', label: 'Ambang Min-Max & ROP', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'optimasi' },
  { key: 'gudang_scanner', label: 'Log Scanner & RFID', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'scanner' },
  { key: 'gudang_lkpp_sync', label: 'Sinkronisasi LKPP', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'pemerintah' },
  { key: 'gudang_satusehat', label: 'Kiriman SATUSEHAT', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'pemerintah' },
  { key: 'gudang_ereport', label: 'Ekspor e-Report Kemenkes', moduleId: 'gudang-logistik', moduleLabel: 'Logistics & Warehouse', gudangTab: 'pemerintah' },

  // Technical, Production & Purchasing
  { key: 'layanan_teknis', label: 'Tiket Teknisi & Kalibrasi', moduleId: 'teknisi-service', moduleLabel: 'Technical & After-Sales Service' },
  { key: 'bets_produksi', label: 'Batch Manufacturing (BMR)', moduleId: 'produksi-cpakb', moduleLabel: 'Manufacturing (CPAKB)' },
  { key: 'pemasok', label: 'Pemasok Terkualifikasi', moduleId: 'purchasing-procurement', moduleLabel: 'Purchasing & Procurement' },
  { key: 'purchase_order', label: 'Purchase Order (PO)', moduleId: 'purchasing-procurement', moduleLabel: 'Purchasing & Procurement' },

  // Commercial & Sales
  { key: 'product_catalog', label: 'Master Product Catalog & SKU', moduleId: 'product-catalog', moduleLabel: 'Product Catalog' },
  { key: 'penjualan', label: 'Sales Order (Penjualan)', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'order' },
  { key: 'sales_pelanggan', label: 'Pelanggan B2B & Fasyankes', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'crm' },
  { key: 'sales_prospek', label: 'Pipeline Prospek CRM', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'crm' },
  { key: 'sales_teritorial', label: 'Wilayah & Target Sales', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'crm' },
  { key: 'sales_tender', label: 'Tender & LPSE', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'tender' },
  { key: 'sales_kontrak', label: 'Kontrak Penguncian Harga', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'tender' },
  { key: 'sales_kunjungan', label: 'Kunjungan MedRep', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'sfa' },
  { key: 'sales_pengetahuan_produk', label: 'Pengetahuan Produk Alkes', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'katalog-internal' },
  { key: 'sales_pra_order', label: 'Pra-Order MedRep', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'sfa' },
  { key: 'sales_skema_harga', label: 'Skema Harga & Diskon', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'order' },
  { key: 'sales_unit_serial', label: 'Registri Nomor Serial', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'order' },
  { key: 'sales_garansi', label: 'Garansi & Instalasi', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'order' },
  { key: 'sales_kampanye', label: 'Kampanye & Simposium', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'kampanye' },
  { key: 'sales_unit_demo', label: 'Pelacakan Unit Demo', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'kampanye' },
  { key: 'sales_rebate', label: 'Program Rebate', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'kampanye' },
  { key: 'sales_riwayat_bulanan', label: 'Riwayat Penjualan Bulanan', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'analitik' },
  { key: 'quotation_riwayat_v1', label: 'Riwayat Quotation (Arsip Penawaran)', moduleId: 'dokumen-internal', moduleLabel: 'Internal Document' },
  { key: 'surat_daftar', label: 'Daftar Milis Newsletter', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'listmonk' },
  { key: 'surat_subscriber', label: 'Subscriber Newsletter', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'listmonk' },
  { key: 'surat_kampanye', label: 'Kampanye Newsletter', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'listmonk' },
  { key: 'surat_templat', label: 'Templat Email', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'listmonk' },
  { key: 'surat_tx', label: 'Log Email Transaksional', moduleId: 'sales-marketing', moduleLabel: 'Sales & Marketing', salesSubTab: 'listmonk' },

  // HRD & HRIS
  { key: 'pelatihan', label: 'Jadwal Pelatihan Personil', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'sertifikasi_pegawai', label: 'Sertifikasi Kompetensi Staf', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_karyawan', label: 'Data Karyawan HRIS', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_grading', label: 'Grading Jabatan', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_mutasi', label: 'Riwayat Mutasi Karyawan', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_shift', label: 'Jadwal Shift Kerja', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_absensi', label: 'Log Absensi Kehadiran', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_cuti', label: 'Pengajuan Cuti & Izin', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_lembur', label: 'Perhitungan Lembur', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_slip_gaji', label: 'Slip Gaji Karyawan', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_ats', label: 'Kandidat Rekrutmen (ATS)', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_skill_matrix', label: 'Matriks Kompetensi', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_kpi', label: 'KPI Karyawan', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_umpan_balik_360', label: 'Umpan Balik 360', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_insiden_k3', label: 'Laporan Insiden K3 / HSE', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_mcu', label: 'Rekam Medical Check-Up', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },
  { key: 'hris_apd', label: 'Distribusi APD', moduleId: 'hrd-pelatihan', moduleLabel: 'HRD & General Affairs' },

  // Finance & Accounting
  { key: 'transaksi', label: 'Faktur & Piutang/Hutang', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },
  { key: 'keuangan_valuasi_batch', label: 'Valuasi Biaya Batch', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },
  { key: 'keuangan_jurnal', label: 'Jurnal Umum & Buku Besar', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },
  { key: 'keuangan_coa', label: 'Bagan Akun (CoA)', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },
  { key: 'keuangan_periode', label: 'Periode Buku Akuntansi', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },
  { key: 'keuangan_tetapan_pajak', label: 'Tetapan Tarif Pajak', moduleId: 'finance-akuntansi', moduleLabel: 'Finance & Accounting' },

  // Internal Document, IT & Audit Trail
  { key: 'dokumen_internal_v1', label: 'Internal Document (Quotation/MR/DO/PR/PO/NCR/CAPA)', moduleId: 'dokumen-internal', moduleLabel: 'Internal Document' },
  { key: 'audit_trail', label: 'Jejak Audit Trail Sistem', moduleId: 'it-traceability', moduleLabel: 'IT & Traceability', extraResource: 'audit-trail', itSubTab: 'audit' },

  // Website CMS
  { key: 'website_draft', label: 'Konten Website Publik (Draf)', moduleId: 'website', moduleLabel: 'Website CMS' }
];

const META_MAP = new Map<string, SearchCollectionMeta>(
  SEARCH_COLLECTION_META.map((m) => [m.key, m])
);

const SKIP_FIELD_KEYS = new Set([
  'hash',
  'hashSebelum',
  'passwordHash',
  'tokenHash',
  'dataUrl',
  'gambar',
  'gambarUrl',
  'imageUrl',
  'foto',
  'avatar',
  'logoUrl',
  'faviconUrl',
  'signature',
  'ttd'
]);

const PREFERRED_TITLE_KEYS = [
  'namaAlkes',
  'namaProduk',
  'nama',
  'namaLengkap',
  'fullName',
  'namaPelanggan',
  'fasyankes',
  'namaPemasok',
  'judul',
  'judulAudit',
  'judulPekerjaan',
  'judulKampanye',
  'nomorIzinEdar',
  'nomorDokumen',
  'nomorQuotation',
  'nomorSertifikat',
  'nomorCAPA',
  'nomorLaporan',
  'nomorTiket',
  'nomorBMR',
  'nomorPO',
  'nomorPesanan',
  'nomorFaktur',
  'nomorJournal',
  'nomorBatch',
  'nomorSerial',
  'nomorRetur',
  'nomorRecall',
  'nomorLaporanKTD',
  'nomorSuratJalan',
  'nomorPengumuman',
  'nomorKontrak',
  'nomorProspek',
  'kodeSKU',
  'sku',
  'kodeDokumen',
  'kode',
  'kodePelanggan',
  'nik',
  'email',
  'surel',
  'sensor',
  'aktivitas',
  'id'
];

const PREFERRED_SUBTITLE_KEYS = [
  'nomorIzinEdar',
  'nomorDokumen',
  'nomorBatch',
  'kodeSKU',
  'sku',
  'nomorPesanan',
  'nomorFaktur',
  'nomorPO',
  'nomorCAPA',
  'nomorLaporan',
  'nomorTiket',
  'nomorBMR',
  'nomorReferensi',
  'fasyankes',
  'produsen',
  'departemen',
  'jabatan',
  'status',
  'kategori',
  'lokasiPenyimpanan',
  'waktu',
  'tanggal'
];

export interface GlobalSearchResultItem {
  id: string;
  collectionKey: string;
  collectionLabel: string;
  moduleId: ModuleNavId;
  moduleLabel: string;
  title: string;
  subtitle: string;
  matchedField: string;
  matchedText: string;
  salesSubTab?: SalesTab;
  itSubTab?: ITSubTabId;
  gudangTab?: GudangTabId;
}

export interface GlobalSearchResponse {
  query: string;
  results: GlobalSearchResultItem[];
  totalAllowedMatches: number;
  hasRestrictedMatches: boolean;
  restrictedMatchCount: number;
  restrictedModulesCount: number;
  notificationMessage: string | null;
}

export function canUserViewSearchMeta(
  meta: SearchCollectionMeta,
  aksesAktif: Pick<AksesEfektif, 'aksesPenuh' | 'modulDiizinkan'>,
  sesi?: Pick<SesiLogin, 'permissions'> | null
): boolean {
  if (!bolehAksesModul(meta.moduleId, aksesAktif)) {
    return false;
  }
  if (meta.extraResource && !aksesAktif.aksesPenuh && sesi?.permissions) {
    const perms = sesi.permissions[meta.extraResource];
    if (meta.extraResource === 'audit-trail') {
      return Array.isArray(perms) && perms.includes('view');
    }
    if (Array.isArray(perms)) {
      return perms.includes('view');
    }
  }
  return true;
}

function isBinaryOrUnsafeValue(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) return true;
  if (trimmed.length > 1500 && !trimmed.includes(' ')) return true;
  return false;
}

interface ExtractedField {
  path: string;
  text: string;
}

function collectSearchableFields(
  value: unknown,
  prefix = '',
  depth = 0,
  out: ExtractedField[] = []
): ExtractedField[] {
  if (value === null || value === undefined || depth > 4 || out.length >= 120) {
    return out;
  }
  if (typeof value === 'string') {
    if (!isBinaryOrUnsafeValue(value)) {
      out.push({ path: prefix || 'nilai', text: value });
    }
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push({ path: prefix || 'nilai', text: String(value) });
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length && i < 30; i += 1) {
      collectSearchableFields(value[i], prefix || `item[${i}]`, depth + 1, out);
    }
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_FIELD_KEYS.has(k)) continue;
      const nextPath = prefix ? `${prefix}.${k}` : k;
      collectSearchableFields(v, nextPath, depth + 1, out);
    }
  }
  return out;
}

function pickFieldString(record: Record<string, unknown>, candidates: string[], excludeValue?: string): string {
  for (const key of candidates) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim() && !isBinaryOrUnsafeValue(raw)) {
      if (excludeValue && raw.trim() === excludeValue.trim()) continue;
      return raw.trim();
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const s = String(raw);
      if (excludeValue && s === excludeValue) continue;
      return s;
    }
  }
  return '';
}

function formatFieldSnippet(raw: string, tokens: string[]): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= 120) return clean;
  const lower = clean.toLowerCase();
  const idx = tokens.reduce((best, t) => {
    const pos = lower.indexOf(t);
    return pos >= 0 && (best < 0 || pos < best) ? pos : best;
  }, -1);
  if (idx <= 30) return `${clean.slice(0, 117)}…`;
  const start = Math.max(0, idx - 30);
  return `…${clean.slice(start, start + 114)}…`;
}

function matchRecordAgainstTokens(
  record: unknown,
  tokens: string[]
): { matchedField: string; matchedText: string } | null {
  const fields = collectSearchableFields(record);
  if (fields.length === 0) return null;

  const combined = fields.map((f) => f.text.toLowerCase()).join(' | ');
  if (!tokens.every((t) => combined.includes(t))) {
    return null;
  }

  // Cari field paling relevan yang mengandung token pertama (atau terbanyak)
  let bestField = fields[0];
  let bestScore = -1;
  for (const f of fields) {
    const lower = f.text.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (lower.includes(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestField = f;
    }
    if (score === tokens.length) break;
  }

  return {
    matchedField: bestField.path,
    matchedText: formatFieldSnippet(bestField.text, tokens)
  };
}

export function executeRoleScopedSearch(params: {
  query: string;
  collections: Record<string, unknown[]>;
  aksesAktif: Pick<AksesEfektif, 'aksesPenuh' | 'modulDiizinkan'>;
  sesi?: Pick<SesiLogin, 'permissions'> | null;
  limit?: number;
}): GlobalSearchResponse {
  const cleanQuery = params.query.trim();
  if (cleanQuery.length < 2) {
    return {
      query: cleanQuery,
      results: [],
      totalAllowedMatches: 0,
      hasRestrictedMatches: false,
      restrictedMatchCount: 0,
      restrictedModulesCount: 0,
      notificationMessage: null
    };
  }

  const tokens = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      query: cleanQuery,
      results: [],
      totalAllowedMatches: 0,
      hasRestrictedMatches: false,
      restrictedMatchCount: 0,
      restrictedModulesCount: 0,
      notificationMessage: null
    };
  }

  const limit = Math.max(1, Math.min(params.limit ?? 40, 100));
  const results: GlobalSearchResultItem[] = [];
  let totalAllowedMatches = 0;
  let restrictedMatchCount = 0;
  const restrictedModules = new Set<ModuleNavId>();

  for (const [collectionKey, rawItems] of Object.entries(params.collections)) {
    const meta = META_MAP.get(collectionKey);
    if (!meta || !Array.isArray(rawItems) || rawItems.length === 0) continue;

    const allowed = canUserViewSearchMeta(meta, params.aksesAktif, params.sesi);

    for (let idx = 0; idx < rawItems.length; idx += 1) {
      const item = rawItems[idx];
      if (!item || typeof item !== 'object') continue;
      const match = matchRecordAgainstTokens(item, tokens);
      if (!match) continue;

      if (!allowed) {
        restrictedMatchCount += 1;
        restrictedModules.add(meta.moduleId);
        continue;
      }

      totalAllowedMatches += 1;
      if (results.length < limit) {
        const rec = item as Record<string, unknown>;
        const title =
          pickFieldString(rec, PREFERRED_TITLE_KEYS) ||
          match.matchedText ||
          `${meta.label} #${idx + 1}`;
        const subtitle = pickFieldString(rec, PREFERRED_SUBTITLE_KEYS, title);
        const recId = typeof rec.id === 'string' && rec.id ? rec.id : `${collectionKey}-${idx}`;

        results.push({
          id: `${collectionKey}:${recId}:${idx}`,
          collectionKey,
          collectionLabel: meta.label,
          moduleId: meta.moduleId,
          moduleLabel: meta.moduleLabel,
          title,
          subtitle,
          matchedField: match.matchedField,
          matchedText: match.matchedText,
          salesSubTab: meta.salesSubTab,
          itSubTab: meta.itSubTab,
          gudangTab: meta.gudangTab
        });
      }
    }
  }

  const hasRestrictedMatches = restrictedMatchCount > 0;
  return {
    query: cleanQuery,
    results,
    totalAllowedMatches,
    hasRestrictedMatches,
    restrictedMatchCount,
    restrictedModulesCount: restrictedModules.size,
    notificationMessage: hasRestrictedMatches ? PESAN_AKSES_PENCARIAN_DITOLAK : null
  };
}
