import fs from 'fs';
import path from 'path';
import type { KonfigurasiSitus, ProdukKatalog, RbacResourceId, RoleDefinition } from '../src/types/index';
import { normalisasiProdukKatalog, produkKatalogUntukWebsite } from '../src/utils/productCatalog';
import { gabungkanRfqWebsite, KUNCI_RFQ_WEBSITE } from './websiteRfq';

export interface SyncEntry {
  value: unknown;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicWebsiteMedia {
  contentType: string;
  bytes: Buffer;
}

interface AppStateDatabase {
  version: number;
  revision: number;
  entries: Record<string, SyncEntry>;
}

export const PUBLIC_SYNC_KEYS = new Set<string>([
  'website_published'
]);

export const LEGACY_RBAC_SYNC_KEYS = new Set(['rb_akun', 'rb_role']);

const VALID_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function isLegacyRbacSyncKey(key: string): boolean {
  return LEGACY_RBAC_SYNC_KEYS.has(key);
}

export function isValidSyncKey(key: string): boolean {
  return VALID_KEY_PATTERN.test(key);
}

export function mapSyncKeyToResource(key: string): RbacResourceId {
  if (key.startsWith('website_')) return 'website';
  if (key === 'izin_edar' || key === 'sertifikat') return 'ra-pjt';
  if (key === 'dokumen_mutu' || key === 'capa' || key === 'produk_kembalian' || key === 'audit_internal_iso') {
    return 'qa-mutu';
  }
  if (key === 'inspeksi_qc') return 'qc-inspeksi';
  if (key === 'laporan_ktd' || key === 'penarikan_produk') return 'pms-vigilance';
  if (key === 'gudang_penerimaan') return 'gudang-penerimaan';
  if (key === 'stok_gudang' || key === 'gudang_pergerakan') return 'gudang-mutasi';
  if (key === 'log_suhu' || key === 'pest_control' || key.startsWith('gudang_')) {
    return 'gudang-logistik';
  }
  if (key === 'layanan_teknis') return 'teknisi-service';
  if (key === 'bets_produksi') return 'produksi-cpakb';
  if (key === 'pemasok' || key === 'purchase_order') return 'purchasing-procurement';
  if (key === 'product_catalog') return 'product-catalog';
  if (
    key === 'penjualan' ||
    key.startsWith('sales_') ||
    key.startsWith('surat_') ||
    key.startsWith('listmonk_') ||
    key.startsWith('catalog_')
  ) {
    return 'sales-marketing';
  }
  if (
    key === 'pelatihan' ||
    key === 'pelatihan_personil' ||
    key === 'sertifikasi_pegawai' ||
    key.startsWith('hris_')
  ) {
    return 'hrd-pelatihan';
  }
  if (key === 'transaksi' || key === 'transaksi_keuangan' || key.startsWith('keuangan_')) {
    return 'finance-akuntansi';
  }
  if (key.startsWith('dokumen_internal') || key.startsWith('quotation_')) return 'dokumen-internal';
  if (key === 'sistem_data_manifest') return 'it-traceability';
  if (key === 'audit_trail') return 'audit-trail';
  return 'overview';
}

const HRIS_ALL_RECORDS_ROLE_IDS = new Set(['developer_it_support', 'hrd_manager', 'payroll_manager', 'management']);
const HRIS_PERSONAL_SYNC_KEYS = new Set(['pelatihan', 'pelatihan_personil', 'sertifikasi_pegawai']);
export const isHrisPersonalSyncKey = (key: string) => key.startsWith('hris_') || HRIS_PERSONAL_SYNC_KEYS.has(key);
const HRIS_SELF_SERVICE_FIELDS: Record<string, readonly string[]> = {
  hris_karyawan: ['id', 'nik', 'nama', 'jabatan', 'divisi', 'lokasi', 'grade', 'statusKaryawan', 'tanggalBergabung'],
  hris_absensi: ['id', 'karyawanId', 'nama', 'tanggal', 'jamMasuk', 'jamKeluar', 'sumber', 'status', 'lokasi'],
  hris_cuti: [
    'id', 'karyawanId', 'namaKaryawan', 'jenis', 'tanggalMulai', 'tanggalSelesai',
    'jumlahHari', 'alasan', 'status', 'disetujuiOleh', 'tanggalPengajuan'
  ],
  hris_skill_matrix: ['id', 'karyawanId', 'nama', 'mesinAtauProses', 'level', 'tanggalPenilaian', 'penilai'],
  hris_kpi: ['id', 'karyawanId', 'nama', 'kerangka', 'periode', 'indikator', 'target', 'realisasi', 'capaianPersen'],
  hris_umpan_balik_360: [
    'id', 'karyawanId', 'nama', 'periode', 'skorAtasan', 'skorRekan', 'skorBawahan', 'skorDiriSendiri', 'status'
  ],
  hris_apd: ['id', 'karyawanId', 'nama', 'jenisApd', 'standar', 'tanggalDistribusi', 'jumlah', 'kondisi', 'tandaTerima'],
  hris_mutasi: [
    'id', 'karyawanId', 'tanggalEfektif', 'tanggalBerakhir', 'jabatan', 'divisi', 'lokasi', 'grade', 'alasanMutasi'
  ]
};
const HRIS_SELF_SERVICE_CERTIFICATE_FIELDS = ['nama', 'nomor', 'masaBerlaku'] as const;
const HRIS_SELF_SERVICE_ROLE_KEYS: Record<string, ReadonlySet<string>> = {
  karyawan: new Set([
    'hris_karyawan',
    'hris_absensi',
    'hris_cuti',
    'hris_skill_matrix',
    'hris_kpi',
    'hris_umpan_balik_360',
    'hris_apd',
    'hris_mutasi'
  ]),
  sales_medrep: new Set(['hris_karyawan', 'hris_absensi', 'hris_cuti']),
  sales_manager: new Set(['hris_karyawan', 'hris_absensi', 'hris_cuti'])
};
const HRIS_SELF_SERVICE_WRITE_ROLES = new Set(['karyawan', 'sales_medrep', 'sales_manager']);
const HRIS_SELF_SERVICE_WRITE_KEYS = new Set(['hris_absensi', 'hris_cuti']);
const HRIS_PAYROLL_WRITE_KEYS = new Set(['hris_slip_gaji', 'hris_lembur']);
const DECIDED_LEAVE_FIELDS = [
  'jenis', 'tanggalMulai', 'tanggalSelesai', 'jumlahHari', 'alasan', 'tanggalPengajuan'
] as const;

export function canReadSyncKey(role: RoleDefinition, key: string, employeeId?: string): boolean {
  if (isLegacyRbacSyncKey(key)) return false;
  if (PUBLIC_SYNC_KEYS.has(key)) return true;
  if (role.id === 'developer_it_support') return true;
  if (isHrisPersonalSyncKey(key)) {
    if (HRIS_ALL_RECORDS_ROLE_IDS.has(role.id)) {
      return role.permissions['hrd-pelatihan']?.includes('view') ?? false;
    }
    return Boolean(
      employeeId &&
      role.permissions['hrd-pelatihan']?.includes('view') &&
      HRIS_SELF_SERVICE_ROLE_KEYS[role.id]?.has(key)
    );
  }
  const permissions = role.permissions[mapSyncKeyToResource(key)];
  return Array.isArray(permissions) && permissions.includes('view');
}

export function filterSyncValueForRole(
  role: RoleDefinition,
  key: string,
  value: unknown,
  employeeId?: string
): unknown {
  if (!canReadSyncKey(role, key, employeeId)) return undefined;
  if (!isHrisPersonalSyncKey(key) || HRIS_ALL_RECORDS_ROLE_IDS.has(role.id) || role.id === 'developer_it_support') {
    return value;
  }
  if (!employeeId || !Array.isArray(value)) return [];
  const personalRecords = value.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as { id?: unknown; karyawanId?: unknown };
    return key === 'hris_karyawan' ? record.id === employeeId : record.karyawanId === employeeId;
  });
  const allowedFields = HRIS_SELF_SERVICE_FIELDS[key];
  if (!allowedFields) return undefined;
  return personalRecords.map((item) => {
    const record = item as Record<string, unknown>;
    const profile: Record<string, unknown> = {};
    for (const field of allowedFields) {
      const fieldValue = record[field];
      if (
        fieldValue === null ||
        typeof fieldValue === 'string' ||
        typeof fieldValue === 'boolean' ||
        (typeof fieldValue === 'number' && Number.isFinite(fieldValue))
      ) {
        profile[field] = fieldValue;
      }
    }
    if (key === 'hris_karyawan' && Array.isArray(record.sertifikasi)) {
      profile.sertifikasi = record.sertifikasi
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
        .map((certificate) => Object.fromEntries(
          HRIS_SELF_SERVICE_CERTIFICATE_FIELDS
            .filter((field) => typeof certificate[field] === 'string')
            .map((field) => [field, certificate[field]])
        ));
    }
    return profile;
  });
}

export function mergeSelfServiceSyncValue(
  key: string,
  currentValue: unknown,
  requestedValue: unknown,
  employeeId: string,
  employeeName?: string
): { ok: true; value: unknown[] } | { ok: false; message: string } {
  if (!HRIS_SELF_SERVICE_WRITE_KEYS.has(key)) {
    return { ok: false, message: 'Akun ini hanya dapat mengirim absensi dan pengajuan cuti miliknya sendiri.' };
  }
  if (!Array.isArray(requestedValue)) {
    return { ok: false, message: 'Data self-service harus berbentuk daftar record.' };
  }
  if (currentValue !== undefined && !Array.isArray(currentValue)) {
    return { ok: false, message: 'Data self-service di server tidak valid; hubungi administrator.' };
  }

  const existing = Array.isArray(currentValue) ? currentValue : [];
  const otherEmployees = existing.filter(
    (item) => !item || typeof item !== 'object' || (item as { karyawanId?: unknown }).karyawanId !== employeeId
  );
  const otherIds = new Set(
    otherEmployees
      .filter((item): item is { id: string } => Boolean(item && typeof item === 'object' && typeof item.id === 'string'))
      .map((item) => item.id)
  );
  const ownById = new Map<string, Record<string, unknown>>();
  for (const item of existing) {
    if (!item || typeof item !== 'object') continue;
    const record = { ...(item as Record<string, unknown>) };
    if (record.karyawanId === employeeId && typeof record.id === 'string') ownById.set(record.id, record);
  }

  const submittedById = new Map<string, Record<string, unknown>>();
  for (const item of requestedValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, message: 'Record self-service tidak valid.' };
    }
    const record = { ...(item as Record<string, unknown>) };
    if (record.karyawanId !== employeeId || typeof record.id !== 'string' || !record.id) {
      return { ok: false, message: 'Record self-service harus terikat pada ID karyawan akun yang sedang masuk.' };
    }
    if (submittedById.has(record.id)) {
      return { ok: false, message: 'Daftar self-service berisi ID record duplikat.' };
    }
    if (otherIds.has(record.id)) {
      return { ok: false, message: 'ID record sudah digunakan oleh karyawan lain.' };
    }
    const previous = ownById.get(record.id);
    if (key === 'hris_cuti' && previous) {
      if (previous.status !== 'Menunggu') {
        if (DECIDED_LEAVE_FIELDS.some((field) =>
          Object.prototype.hasOwnProperty.call(record, field) && record[field] !== previous[field]
        )) {
          return { ok: false, message: 'Pengajuan cuti yang sudah diputuskan tidak dapat diubah melalui self-service.' };
        }
        submittedById.set(record.id, previous);
        continue;
      }
      record.status = previous.status;
      record.disetujuiOleh = previous.disetujuiOleh;
      record.tanggalPengajuan = previous.tanggalPengajuan;
    } else if (key === 'hris_cuti') {
      record.status = 'Menunggu';
      delete record.disetujuiOleh;
    }
    if (employeeName) {
      if (key === 'hris_absensi') record.nama = employeeName;
      if (key === 'hris_cuti') record.namaKaryawan = employeeName;
    }
    submittedById.set(record.id, record);
  }

  const mergedOwn = [...ownById.entries()].map(([id, record]) => submittedById.get(id) || record);
  const existingIds = new Set(ownById.keys());
  for (const [id, record] of submittedById) {
    if (!existingIds.has(id)) mergedOwn.push(record);
  }
  return { ok: true, value: [...otherEmployees, ...mergedOwn] };
}

export function canWriteSyncKey(role: RoleDefinition, key: string): boolean {
  if (isLegacyRbacSyncKey(key) || key === KUNCI_RFQ_WEBSITE) return false;
  // Log audit operasional dicatat otomatis saat user sah beraktivitas di modulnya
  if (key === 'audit_trail') return true;
  if (isHrisPersonalSyncKey(key)) {
    if (role.id === 'developer_it_support') return true;
    const permissions = role.permissions['hrd-pelatihan'] || [];
    if (!permissions.includes('view')) return false;
    if (HRIS_SELF_SERVICE_WRITE_ROLES.has(role.id)) return HRIS_SELF_SERVICE_WRITE_KEYS.has(key);
    if (!HRIS_ALL_RECORDS_ROLE_IDS.has(role.id)) return false;
    if (role.id === 'payroll_manager') {
      return HRIS_PAYROLL_WRITE_KEYS.has(key) &&
        (permissions.includes('create') || permissions.includes('update'));
    }
    if (HRIS_SELF_SERVICE_WRITE_KEYS.has(key)) {
      return role.id === 'hrd_manager' &&
        permissions.some((action) => action === 'create' || action === 'update' || action === 'approve');
    }
    return permissions.includes('create') || permissions.includes('update') || permissions.includes('publish');
  }

  // Manifest asal data (dummy vs user) diperbarui otomatis saat user sah menulis koleksi
  if (key === 'sistem_data_manifest') return true;

  // Audit Internal ISO 13485 dijalankan dan disimpan bersama oleh QA maupun QC
  if (key === 'audit_internal_iso') {
    const qaPerms = role.permissions['qa-mutu'] || [];
    const qcPerms = role.permissions['qc-inspeksi'] || [];
    return (
      ['create', 'update', 'approve'].some((a) => qaPerms.includes(a as never)) ||
      ['create', 'update', 'approve'].some((a) => qcPerms.includes(a as never))
    );
  }

  const resource = mapSyncKeyToResource(key);
  const perms = role.permissions[resource];
  if (!Array.isArray(perms)) return false;

  if (key === 'website_published') {
    return perms.includes('publish');
  }
  return perms.includes('create') || perms.includes('update') || perms.includes('publish');
}

export function canDeleteSyncKey(role: RoleDefinition, key: string): boolean {
  if (isLegacyRbacSyncKey(key) || key === KUNCI_RFQ_WEBSITE) return false;
  if (isHrisPersonalSyncKey(key)) {
    if (role.id === 'developer_it_support') return true;
    const permissions = role.permissions['hrd-pelatihan'] || [];
    return HRIS_ALL_RECORDS_ROLE_IDS.has(role.id) &&
      (role.id !== 'payroll_manager' || HRIS_PAYROLL_WRITE_KEYS.has(key)) &&
      permissions.includes('view') &&
      permissions.includes('delete');
  }
  const resource = mapSyncKeyToResource(key);
  const perms = role.permissions[resource];
  if (!Array.isArray(perms)) return false;
  if (['gudang_penerimaan', 'stok_gudang', 'gudang_pergerakan'].includes(key)) {
    return perms.includes('delete');
  }
  return perms.includes('delete') || perms.includes('update') || perms.includes('publish');
}

export function validateHrisReplacement(
  role: RoleDefinition,
  key: string,
  currentValue: unknown,
  requestedValue: unknown
): string | undefined {
  if (!isHrisPersonalSyncKey(key) || HRIS_SELF_SERVICE_WRITE_ROLES.has(role.id) || canDeleteSyncKey(role, key)) {
    return undefined;
  }
  if (!Array.isArray(requestedValue) || (currentValue !== undefined && !Array.isArray(currentValue))) {
    return 'Data HRIS harus berbentuk daftar record yang valid.';
  }
  const collectIds = (records: unknown[]): Set<string> | undefined => {
    const ids = new Set<string>();
    for (const item of records) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== 'string' || !id || ids.has(id)) return undefined;
      ids.add(id);
    }
    return ids;
  };
  const currentIds = collectIds(Array.isArray(currentValue) ? currentValue : []);
  const requestedIds = collectIds(requestedValue);
  if (!currentIds || !requestedIds) return 'Data HRIS memiliki ID record yang tidak valid atau duplikat.';
  if ([...currentIds].some((id) => !requestedIds.has(id))) {
    return 'Penghapusan record HRIS memerlukan izin hapus; muat ulang data sebelum menyimpan.';
  }
  return undefined;
}

const MEDIA_WRITE_RESOURCES: RbacResourceId[] = [
  'website',
  'product-catalog',
  'dokumen-internal',
  'sales-marketing',
  'qa-mutu',
  'qc-inspeksi',
  'gudang-logistik',
  'hrd-pelatihan',
  'teknisi-service',
  'produksi-cpakb',
  'ra-pjt'
];

export function canUploadMedia(role: RoleDefinition): boolean {
  if (role.id === 'developer') return true;
  return MEDIA_WRITE_RESOURCES.some((resId) => {
    const perms = role.permissions[resId];
    return Array.isArray(perms) && (perms.includes('create') || perms.includes('update') || perms.includes('publish'));
  });
}

export function canDeleteMedia(role: RoleDefinition): boolean {
  if (role.id === 'developer') return true;
  return MEDIA_WRITE_RESOURCES.some((resId) => {
    const perms = role.permissions[resId];
    return Array.isArray(perms) && (perms.includes('delete') || perms.includes('update') || perms.includes('publish'));
  });
}

export function containsMediaReference(value: unknown, mediaId: string): boolean {
  if (value === `media:${mediaId}`) return true;
  if (Array.isArray(value)) return value.some((item) => containsMediaReference(item, mediaId));
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => containsMediaReference(item, mediaId));
  }
  return false;
}

function mergeCatalogIntoWebsiteConfig(
  cfg: Record<string, unknown>,
  catalogValue: unknown,
  actorUsername?: string
): Record<string, unknown> | null {
  if (!cfg || typeof cfg !== 'object') return null;
  if (!Array.isArray(catalogValue)) return null;
  const produkSection = cfg.produk as KonfigurasiSitus['produk'] | undefined;
  if (!produkSection || !Array.isArray(produkSection.item)) return null;

  const normalizedCatalog = catalogValue
    .filter((p): p is ProdukKatalog => Boolean(p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string'))
    .map((p) => normalisasiProdukKatalog(p));

  const nextItems = produkKatalogUntukWebsite(normalizedCatalog, produkSection.item);

  return {
    ...cfg,
    lastModifiedAt: Date.now(),
    ...(actorUsername ? { lastModifiedBy: actorUsername } : {}),
    produk: {
      ...produkSection,
      item: nextItems
    }
  };
}

export function mergeCatalogIntoPublishedSnapshot(
  snapshot: Record<string, unknown>,
  catalogValue: unknown,
  actorUsername?: string
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.isPublished !== true) return null;
  if (!Array.isArray(catalogValue)) return null;
  const produkSection = snapshot.produk as KonfigurasiSitus['produk'] | undefined;
  if (!produkSection || !Array.isArray(produkSection.item)) return null;

  const catalogIds = new Set(
    catalogValue
      .filter((p): p is { id: string } => Boolean(p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string'))
      .map((p) => p.id)
  );
  const hasActiveSnapshotItems = produkSection.item.some((item) => item.isActive);
  const isCatalogBackedSnapshot =
    produkSection.item.length === 0 ||
    produkSection.item.some((item) => item.id.startsWith('ams-daftar-harga-v6-')) ||
    produkSection.item.some((item) => catalogIds.has(item.id));
  if (hasActiveSnapshotItems && !isCatalogBackedSnapshot) {
    return null;
  }

  return mergeCatalogIntoWebsiteConfig(snapshot, catalogValue, actorUsername);
}

export function mergeCatalogIntoDraftConfig(
  draft: Record<string, unknown>,
  catalogValue: unknown,
  actorUsername?: string
): Record<string, unknown> | null {
  if (!draft || typeof draft !== 'object') return null;
  return mergeCatalogIntoWebsiteConfig(draft, catalogValue, actorUsername);
}

export class ServerDataSyncStore {
  private readonly dbFile: string;
  private state: AppStateDatabase;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbFile = path.join(dataDir, 'app-state.json');
    this.state = this.loadState();
  }

  private loadState(): AppStateDatabase {
    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        const parsed = JSON.parse(raw) as Partial<AppStateDatabase>;
        if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
          return {
            version: typeof parsed.version === 'number' ? parsed.version : 1,
            revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
            entries: parsed.entries as Record<string, SyncEntry>
          };
        }
      } catch {
        /* fallback ke state kosong bila berkas korup */
      }
    }
    const fresh: AppStateDatabase = { version: 1, revision: 0, entries: {} };
    this.persist(fresh);
    return fresh;
  }

  private persist(next: AppStateDatabase = this.state): void {
    const tmp = `${this.dbFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, this.dbFile);
  }

  public getRevision(): number {
    return this.state.revision;
  }

  public hasKey(key: string): boolean {
    if (isLegacyRbacSyncKey(key)) return false;
    return Object.prototype.hasOwnProperty.call(this.state.entries, key);
  }

  public getEntry(key: string): SyncEntry | undefined {
    if (isLegacyRbacSyncKey(key)) return undefined;
    return this.state.entries[key];
  }

  public getPublicWebsiteMedia(id: string, snapshot: unknown): PublicWebsiteMedia | null {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
    if (!snapshot || typeof snapshot !== 'object' || (snapshot as { isPublished?: unknown }).isPublished !== true) {
      return null;
    }

    const containsPublishedReference = (value: unknown): boolean => {
      if (value === `media:${id}`) return true;
      if (Array.isArray(value)) return value.some(containsPublishedReference);
      if (value && typeof value === 'object') return Object.values(value).some(containsPublishedReference);
      return false;
    };
    if (!containsPublishedReference(snapshot)) return null;

    const daftar = this.state.entries.website_media_v1?.value;
    if (!Array.isArray(daftar)) return null;
    const media = daftar.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === id) as
      | { dataUrl?: unknown }
      | undefined;
    if (typeof media?.dataUrl !== 'string') return null;

    const cocok = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(media.dataUrl);
    if (!cocok) return null;
    const bytes = Buffer.from(cocok[2], 'base64');
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return null;
    return { contentType: cocok[1].toLowerCase(), bytes };
  }

  public getPublicState(): { revision: number; entries: Record<string, SyncEntry> } {
    const out: Record<string, SyncEntry> = {};
    for (const key of PUBLIC_SYNC_KEYS) {
      if (this.state.entries[key]) {
        out[key] = this.state.entries[key];
      }
    }
    return { revision: this.state.revision, entries: out };
  }

  public getAllState(sinceVersionMap?: Record<string, number>): {
    revision: number;
    entries: Record<string, SyncEntry>;
  } {
    if (!sinceVersionMap) {
      const entries: Record<string, SyncEntry> = {};
      for (const [key, entry] of Object.entries(this.state.entries)) {
        if (!isLegacyRbacSyncKey(key)) entries[key] = entry;
      }
      return { revision: this.state.revision, entries };
    }
    const delta: Record<string, SyncEntry> = {};
    for (const [key, entry] of Object.entries(this.state.entries)) {
      if (!isLegacyRbacSyncKey(key) && (sinceVersionMap[key] ?? 0) < entry.version) {
        delta[key] = entry;
      }
    }
    return { revision: this.state.revision, entries: delta };
  }

  public setKey(
    key: string,
    value: unknown,
    actorUsername: string
  ): { entry: SyncEntry; revision: number } {
    if (isLegacyRbacSyncKey(key)) {
      throw new Error(`Legacy RBAC sync key "${key}" is no longer supported.`);
    }
    const prev = this.state.entries[key];
    const nextVersion = (prev?.version ?? 0) + 1;
    const nextRevision = this.state.revision + 1;
    const entry: SyncEntry = {
      value,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUsername
    };
    const nextState: AppStateDatabase = {
      ...this.state,
      revision: nextRevision,
      entries: { ...this.state.entries, [key]: entry }
    };
    this.persist(nextState);
    this.state = nextState;
    return { entry, revision: nextRevision };
  }

  public setBatch(
    updates: Record<string, unknown>,
    deletes: string[] = [],
    actorUsername: string
  ): {
    updated: Record<string, SyncEntry>;
    deleted: string[];
    revision: number;
  } {
    const legacyKey = [...Object.keys(updates), ...deletes].find(isLegacyRbacSyncKey);
    if (legacyKey) {
      throw new Error(`Legacy RBAC sync key "${legacyKey}" is no longer supported.`);
    }
    const updated: Record<string, SyncEntry> = {};
    const deleted: string[] = [];
    const now = new Date().toISOString();
    const entries = { ...this.state.entries };
    let changed = false;

    for (const [key, value] of Object.entries(updates)) {
      if (!isValidSyncKey(key)) continue;
      const prev = entries[key];
      const entry: SyncEntry = {
        value,
        version: (prev?.version ?? 0) + 1,
        updatedAt: now,
        updatedBy: actorUsername
      };
      entries[key] = entry;
      updated[key] = entry;
      changed = true;
    }

    for (const key of deletes) {
      if (!isValidSyncKey(key)) continue;
      if (Object.prototype.hasOwnProperty.call(entries, key)) {
        delete entries[key];
        deleted.push(key);
        changed = true;
      }
    }

    if (changed) {
      const nextState = { ...this.state, entries, revision: this.state.revision + 1 };
      this.persist(nextState);
      this.state = nextState;
    }

    return {
      updated,
      deleted,
      revision: this.state.revision
    };
  }

  public deleteKey(key: string): { deleted: boolean; revision: number } {
    if (isLegacyRbacSyncKey(key)) {
      throw new Error(`Legacy RBAC sync key "${key}" is no longer supported.`);
    }
    if (!this.hasKey(key)) {
      return { deleted: false, revision: this.state.revision };
    }
    delete this.state.entries[key];
    this.state.revision += 1;
    this.persist();
    return { deleted: true, revision: this.state.revision };
  }

  public resetAll(): number {
    this.state.entries = {};
    this.state.revision += 1;
    this.persist();
    return this.state.revision;
  }

  public hydrateFromCloud(
    cloudEntries: Record<string, { value: unknown; version?: number; updatedAt?: string; updatedBy?: string }>
  ): { appliedKeys: string[]; revision: number } {
    const appliedKeys: string[] = [];
    const entries = { ...this.state.entries };
    for (const [key, item] of Object.entries(cloudEntries)) {
      if (!isValidSyncKey(key) || isLegacyRbacSyncKey(key) || !item || item.value === undefined) continue;
      const existing = entries[key];
      if (key === KUNCI_RFQ_WEBSITE) {
        const gabungan = gabungkanRfqWebsite(existing?.value, item.value);
        if (existing && Array.isArray(existing.value) && gabungan.length === existing.value.length) continue;
        entries[key] = {
          value: gabungan,
          version: Math.max((existing?.version ?? 0) + 1, item.version ?? 1),
          updatedAt: new Date().toISOString(),
          updatedBy: 'firebase-sync'
        };
        appliedKeys.push(key);
        continue;
      }
      const incomingTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const shouldApply =
        !existing ||
        (Number.isFinite(incomingTime) && incomingTime > existingTime) ||
        ((item.version ?? 0) > (existing.version ?? 0) && incomingTime >= existingTime);

      if (shouldApply) {
        entries[key] = {
          value: item.value,
          version: Math.max((existing?.version ?? 0) + 1, item.version ?? 1),
          updatedAt: item.updatedAt || new Date().toISOString(),
          updatedBy: item.updatedBy || 'firebase-sync'
        };
        appliedKeys.push(key);
      }
    }
    if (appliedKeys.length > 0) {
      const nextState = { ...this.state, entries, revision: this.state.revision + 1 };
      this.persist(nextState);
      this.state = nextState;
    }
    return { appliedKeys, revision: this.state.revision };
  }
}
