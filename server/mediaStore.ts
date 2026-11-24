import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { readJsonFileIfPresent } from './readJsonFile';

export type MediaVisibility = 'public' | 'internal';
export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';
export type SupportedImageExt = 'png' | 'jpg' | 'webp';

export interface StoredMediaMeta {
  id: string;
  filename: string;
  contentType: SupportedImageMime;
  ext: SupportedImageExt;
  size: number;
  sha256: string;
  visibility: MediaVisibility;
  scope: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface StoredMediaFile {
  meta: StoredMediaMeta;
  bytes: Buffer;
}

interface MediaIndexFile {
  version: number;
  items: Record<string, StoredMediaMeta>;
}

export const MAX_MEDIA_FILE_BYTES = 8 * 1024 * 1024;
const VALID_MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function isValidMediaId(id: string): boolean {
  return VALID_MEDIA_ID_PATTERN.test(id);
}

export function detectImageMagicFormat(
  bytes: Buffer
): { contentType: SupportedImageMime; ext: SupportedImageExt } | null {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', ext: 'png' };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }

  // WebP: "RIFF" + 4 bytes size + "WEBP"
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', ext: 'webp' };
  }

  return null;
}

export function sanitizeMediaFilename(filename?: string, ext: SupportedImageExt = 'jpg'): string {
  const base = path
    .basename(String(filename || 'foto'))
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  if (!base) return `foto.${ext}`;
  return base;
}

export function parseImageDataUrl(dataUrl: string): {
  declaredMime: SupportedImageMime;
  bytes: Buffer;
} | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl.trim());
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_FILE_BYTES) return null;
  return {
    declaredMime: match[1].toLowerCase() as SupportedImageMime,
    bytes
  };
}

export function encodeImageDataUrl(contentType: SupportedImageMime, bytes: Buffer): string {
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export class ServerMediaStore {
  private readonly uploadsDir: string;
  private readonly indexFile: string;
  private index: MediaIndexFile;

  constructor(dataDir: string) {
    this.uploadsDir = path.resolve(dataDir, 'uploads');
    this.indexFile = path.resolve(dataDir, 'media-index.json');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.index = this.loadIndex();
  }

  private loadIndex(): MediaIndexFile {
    const parsed = readJsonFileIfPresent(this.indexFile, 'Indeks media');
    if (parsed !== undefined) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Format indeks media "${this.indexFile}" tidak valid. Berkas tidak diubah; pulihkan dari backup.`);
      }
      const index = parsed as Partial<MediaIndexFile>;
      if (!index.items || typeof index.items !== 'object' || Array.isArray(index.items) ||
          (index.version !== undefined && (!Number.isSafeInteger(index.version) || index.version < 0)) ||
          !Object.entries(index.items).every(([id, item]) =>
            isValidMediaId(id) && item && typeof item === 'object' && !Array.isArray(item) &&
            item.id === id && ['png', 'jpg', 'webp'].includes(item.ext) &&
            ['image/png', 'image/jpeg', 'image/webp'].includes(item.contentType) &&
            (item.visibility === 'public' || item.visibility === 'internal') &&
            typeof item.scope === 'string' && typeof item.filename === 'string' &&
            typeof item.uploadedBy === 'string' && typeof item.uploadedAt === 'string' &&
            Number.isSafeInteger(item.size) && item.size > 0 && typeof item.sha256 === 'string'
          )) {
        throw new Error(`Format indeks media "${this.indexFile}" tidak valid. Berkas tidak diubah; pulihkan dari backup.`);
      }
      return { version: index.version ?? 1, items: index.items };
    }
    const fresh: MediaIndexFile = { version: 1, items: {} };
    fs.writeFileSync(this.indexFile, JSON.stringify(fresh, null, 2), { encoding: 'utf8', flag: 'wx' });
    return fresh;
  }

  private persistIndex(next: MediaIndexFile = this.index): void {
    const tmp = `${this.indexFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, this.indexFile);
  }

  private resolveSafeUploadPath(fileName: string): string {
    const clean = path.basename(fileName);
    const resolved = path.resolve(this.uploadsDir, clean);
    const prefix = this.uploadsDir.endsWith(path.sep) ? this.uploadsDir : `${this.uploadsDir}${path.sep}`;
    if (!resolved.startsWith(prefix)) {
      throw new Error('Path media tidak valid.');
    }
    return resolved;
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public saveFromBuffer(opts: {
    id?: string;
    bytes: Buffer;
    filename?: string;
    visibility?: MediaVisibility;
    scope?: string;
    uploadedBy?: string;
  }): StoredMediaMeta {
    const { bytes } = opts;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new Error('Berkas gambar kosong.');
    }
    if (bytes.length > MAX_MEDIA_FILE_BYTES) {
      throw new Error('Ukuran gambar melebihi batas maksimal 8 MB.');
    }

    const detected = detectImageMagicFormat(bytes);
    if (!detected) {
      throw new Error('Format gambar tidak valid. Hanya PNG, JPEG, atau WebP asli yang diterima server.');
    }

    const rawId = typeof opts.id === 'string' ? opts.id.trim() : '';
    const id = rawId || `img-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    if (!isValidMediaId(id)) {
      throw new Error('ID media hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah (maks 80 karakter).');
    }

    const targetFile = this.resolveSafeUploadPath(`${id}.${detected.ext}`);
    const tmpFile = this.resolveSafeUploadPath(`${id}.${detected.ext}.tmp-${process.pid}`);
    fs.writeFileSync(tmpFile, bytes);
    fs.renameSync(tmpFile, targetFile);

    // Bersihkan ekstensi lama jika ID sama ditimpa dengan format berbeda
    for (const candidateExt of ['png', 'jpg', 'webp'] as const) {
      if (candidateExt === detected.ext) continue;
      const stalePath = this.resolveSafeUploadPath(`${id}.${candidateExt}`);
      if (fs.existsSync(stalePath)) {
        try {
          fs.unlinkSync(stalePath);
        } catch {
          /* abaikan gagal hapus file usang */
        }
      }
    }

    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const meta: StoredMediaMeta = {
      id,
      filename: sanitizeMediaFilename(opts.filename, detected.ext),
      contentType: detected.contentType,
      ext: detected.ext,
      size: bytes.length,
      sha256,
      visibility: opts.visibility === 'internal' ? 'internal' : 'public',
      scope: String(opts.scope || 'website').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) || 'website',
      uploadedBy: String(opts.uploadedBy || 'system').slice(0, 120) || 'system',
      uploadedAt: new Date().toISOString()
    };

    this.index.items[id] = meta;
    this.persistIndex();
    return meta;
  }

  public saveFromDataUrl(opts: {
    id?: string;
    dataUrl: string;
    filename?: string;
    visibility?: MediaVisibility;
    scope?: string;
    uploadedBy?: string;
  }): StoredMediaMeta {
    const parsed = parseImageDataUrl(opts.dataUrl);
    if (!parsed) {
      throw new Error('Data URL gambar tidak valid (gunakan PNG/JPEG/WebP base64 maks 8 MB).');
    }
    return this.saveFromBuffer({
      id: opts.id,
      bytes: parsed.bytes,
      filename: opts.filename,
      visibility: opts.visibility,
      scope: opts.scope,
      uploadedBy: opts.uploadedBy
    });
  }

  public getMeta(id: string): StoredMediaMeta | null {
    if (!isValidMediaId(id)) return null;
    return this.index.items[id] ?? null;
  }

  public getMedia(id: string): StoredMediaFile | null {
    if (!isValidMediaId(id)) return null;
    const meta = this.index.items[id];
    if (meta) {
      const target = this.resolveSafeUploadPath(`${id}.${meta.ext}`);
      if (fs.existsSync(target)) {
        try {
          const bytes = fs.readFileSync(target);
          if (bytes.length > 0) {
            return { meta, bytes };
          }
        } catch {
          return null;
        }
      }
    }

    // Fallback: jika file fisik ada di folder uploads namun indeks belum terisi
    for (const candidateExt of ['png', 'jpg', 'webp'] as const) {
      const candidatePath = this.resolveSafeUploadPath(`${id}.${candidateExt}`);
      if (fs.existsSync(candidatePath)) {
        try {
          const bytes = fs.readFileSync(candidatePath);
          const detected = detectImageMagicFormat(bytes);
          if (detected) {
            const recoveredMeta: StoredMediaMeta = {
              id,
              filename: `${id}.${detected.ext}`,
              contentType: detected.contentType,
              ext: detected.ext,
              size: bytes.length,
              sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
              visibility: 'public',
              scope: 'website',
              uploadedBy: 'recovered',
              uploadedAt: new Date().toISOString()
            };
            this.index.items[id] = recoveredMeta;
            this.persistIndex();
            return { meta: recoveredMeta, bytes };
          }
        } catch {
          /* lanjutkan kandidat berikutnya */
        }
      }
    }
    return null;
  }

  public listMeta(filter?: { scope?: string; visibility?: MediaVisibility }): StoredMediaMeta[] {
    return Object.values(this.index.items)
      .filter((item) => (!filter?.scope || item.scope === filter.scope))
      .filter((item) => (!filter?.visibility || item.visibility === filter.visibility))
      .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  }

  public deleteMedia(id: string): boolean {
    if (!isValidMediaId(id)) return false;
    const hadMeta = Boolean(this.index.items[id]);
    let deletedFile = false;
    for (const candidateExt of ['png', 'jpg', 'webp'] as const) {
      const target = this.resolveSafeUploadPath(`${id}.${candidateExt}`);
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
          deletedFile = true;
        } catch {
          /* abaikan */
        }
      }
    }
    if (hadMeta) {
      delete this.index.items[id];
      this.persistIndex();
    }
    return hadMeta || deletedFile;
  }

  public migrateLegacyMediaEntries(entries: unknown, uploadedBy = 'legacy-migration'): number {
    if (!Array.isArray(entries)) return 0;
    let migrated = 0;
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as { id?: unknown; nama?: unknown; dataUrl?: unknown };
      if (typeof rec.id !== 'string' || !isValidMediaId(rec.id)) continue;
      if (this.getMedia(rec.id)) continue;
      if (typeof rec.dataUrl !== 'string') continue;
      try {
        this.saveFromDataUrl({
          id: rec.id,
          dataUrl: rec.dataUrl,
          filename: typeof rec.nama === 'string' ? rec.nama : `${rec.id}.jpg`,
          visibility: 'public',
          scope: 'website',
          uploadedBy
        });
        migrated += 1;
      } catch {
        /* abaikan entri korup agar migrasi berlanjut */
      }
    }
    return migrated;
  }
}
