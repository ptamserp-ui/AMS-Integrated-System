import { kompresGambarWebsite } from './website';
import {
  KUNCI_PENDING_MEDIA,
  daftarMediaWebsite,
  hapusMediaWebsite,
  setPratinjauMemori,
  simpanMediaWebsite
} from './websitePrimitives';
import { HEADER_IDENTITAS_SYNC } from './identitasSinkronisasi';

const KUNCI_SESI_AUTH = 'ams_alkes_sesi_login_v2';

export interface UnggahMediaOptions {
  lebarMaks?: number;
  kualitas?: number;
  pertahankanTransparansi?: boolean;
  visibility?: 'public' | 'internal';
  scope?: string;
}

export interface HasilUnggahMedia {
  referensi: string;
  id: string;
  url: string;
  storedOnServer: boolean;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  peringatan?: string;
}

function bacaTokenAuthLokal(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KUNCI_SESI_AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string } | null;
    return typeof parsed?.token === 'string' && parsed.token ? parsed.token : null;
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): {
  blob: Blob;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
} {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Format hasil kompresi gambar tidak didukung (gunakan PNG/JPEG/WebP).');
  }
  const contentType = match[1].toLowerCase() as 'image/png' | 'image/jpeg' | 'image/webp';
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return {
    blob: new Blob([bytes], { type: contentType }),
    contentType
  };
}

interface PendingMediaItem {
  id: string;
  filename: string;
  dataUrl: string;
  visibility: 'public' | 'internal';
  scope: string;
}

class MediaUploadError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function bacaAntreanMedia(): PendingMediaItem[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KUNCI_PENDING_MEDIA);
  const parsed = raw ? (JSON.parse(raw) as unknown) : [];
  if (!Array.isArray(parsed) || !parsed.every((item) =>
    item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.filename === 'string' &&
    typeof item.dataUrl === 'string' &&
    (item.visibility === 'public' || item.visibility === 'internal') &&
    typeof item.scope === 'string'
  )) {
    throw new Error('Antrean media offline tidak valid.');
  }
  return parsed;
}

function simpanAntreanMedia(items: PendingMediaItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (items.length === 0) {
      localStorage.removeItem(KUNCI_PENDING_MEDIA);
    } else {
      localStorage.setItem(KUNCI_PENDING_MEDIA, JSON.stringify(items));
    }
  } catch (error) {
    console.error('Gagal menyimpan antrean media:', error);
    throw new Error('Antrean media offline tidak dapat disimpan.');
  }
}

async function mirrorAssetToFirestoreAsync(payload: {
  id: string;
  filename: string;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  dataUrl: string;
  size: number;
  visibility: 'public' | 'internal';
  scope: string;
  sha256: string;
  uploadedBy: string;
}): Promise<void> {
  try {
    const { authFirebase, pushMediaAssetToFirestore } = await import('../services/firebase');
    if (!authFirebase.currentUser?.emailVerified) return;
    if (!await pushMediaAssetToFirestore(payload)) {
      throw new Error(`Media ${payload.id} tidak dapat dicadangkan ke Firebase.`);
    }
  } catch (error) {
    console.error('[media] File tersimpan di server, tetapi pencadangan Firebase gagal.', error);
  }
}

async function kirimMediaBinerKeServer(params: {
  id: string;
  filename: string;
  blob: Blob;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  visibility: 'public' | 'internal';
  scope: string;
  token: string;
  syncIdentity?: string;
}): Promise<{
  ok: true;
  id: string;
  url: string;
  sha256: string;
  uploadedBy: string;
  size: number;
  peringatan?: string;
}> {
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': params.contentType,
      'X-Media-Id': params.id,
      'X-Media-Filename': encodeURIComponent(params.filename),
      'X-Media-Visibility': params.visibility,
      'X-Media-Scope': params.scope,
      ...(params.syncIdentity ? { [HEADER_IDENTITAS_SYNC]: encodeURIComponent(params.syncIdentity) } : {})
    },
    body: params.blob
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ams:auth-expired'));
    throw new Error('Sesi login berakhir. Silakan masuk ulang untuk mengunggah foto.');
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: unknown;
    id?: unknown;
    url?: unknown;
    pesan?: unknown;
    peringatan?: unknown;
    media?: { sha256?: unknown; uploadedBy?: unknown; size?: unknown };
  } | null;

  if (!res.ok) {
    throw new MediaUploadError(
      typeof body?.pesan === 'string' && body.pesan ? body.pesan : `Gagal mengunggah foto ke server (HTTP ${res.status}).`,
      res.status
    );
  }
  const expectedUrl = `/api/website/media/${encodeURIComponent(params.id)}`;
  if (
    body?.ok !== true ||
    body.id !== params.id ||
    body.url !== expectedUrl ||
    typeof body.media?.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(body.media.sha256) ||
    typeof body.media.uploadedBy !== 'string' || !body.media.uploadedBy ||
    body.media.size !== params.blob.size
  ) {
    throw new Error('Konfirmasi unggahan server tidak lengkap atau tidak sesuai. Media akan dipertahankan untuk dicoba ulang.');
  }

  const peringatan = typeof body.peringatan === 'string' && body.peringatan ? body.peringatan : undefined;
  if (peringatan) console.warn('[media] Unggahan diterima dengan peringatan:', peringatan);
  return {
    ok: true,
    id: params.id,
    url: expectedUrl,
    sha256: body.media.sha256,
    uploadedBy: body.media.uploadedBy,
    size: params.blob.size,
    ...(peringatan ? { peringatan } : {})
  };
}

/**
 * Kompres foto di sisi klien, simpan langsung ke folder uploads/ server via POST /api/media/upload,
 * pancarkan siaran real-time WebSocket ke seluruh klien aktif & /web, serta cerminkan ke Firestore.
 */
export async function unggahFotoKeServer(
  file: File,
  opsi: UnggahMediaOptions = {}
): Promise<HasilUnggahMedia> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 8 MB per foto.');
  }
  const lebarMaks = opsi.lebarMaks ?? 1280;
  const kualitas = opsi.kualitas ?? 0.82;
  const pertahankanTransparansi = opsi.pertahankanTransparansi ?? false;
  const visibility = opsi.visibility ?? 'public';
  const scope = opsi.scope ?? 'website';

  const dataUrl = await kompresGambarWebsite(file, lebarMaks, kualitas, pertahankanTransparansi);
  const { blob, contentType } = dataUrlToBlob(dataUrl);
  const id = `img-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  // Cache pratinjau seketika di memori agar UI langsung menampilkan foto tanpa delay decode jaringan
  setPratinjauMemori(id, dataUrl);

  const token = bacaTokenAuthLokal();
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (token && online && typeof fetch === 'function') {
    const { db } = await import('../services/pocketbase');
    const syncIdentity = db.identitasSyncSiap();
    if (!syncIdentity) {
      throw new Error('Identitas sinkronisasi belum diverifikasi. Periksa sesi dan coba lagi.');
    }
    try {
      const serverRes = await kirimMediaBinerKeServer({
        id,
        filename: file.name,
        blob,
        contentType,
        visibility,
        scope,
        token,
        syncIdentity
      });

      void mirrorAssetToFirestoreAsync({
        id: serverRes.id,
        filename: file.name,
        contentType,
        dataUrl,
        size: serverRes.size,
        visibility,
        scope,
        sha256: serverRes.sha256,
        uploadedBy: serverRes.uploadedBy
      });

      return {
        referensi: `media:${serverRes.id}`,
        id: serverRes.id,
        url: serverRes.url,
        storedOnServer: true,
        contentType,
        size: serverRes.size,
        ...(serverRes.peringatan ? { peringatan: serverRes.peringatan } : {})
      };
    } catch (err) {
      // Penolakan otorisasi / validasi konten tidak perlu masuk antrean offline
      const msg = err instanceof Error ? err.message : '';
      if (err instanceof MediaUploadError && [400, 403, 409, 410].includes(err.status)) {
        if (err.status === 409) db.tahanSinkronisasi('Identitas berubah saat media diunggah. Periksa ulang sesi.');
        throw err;
      }
      if (
        msg.includes('Sesi login') ||
        msg.includes('Akses ditolak') ||
        msg.includes('Format gambar') ||
        msg.includes('Ukuran gambar')
      ) {
        throw err;
      }
      console.warn('Unggahan foto belum dapat dikonfirmasi; media akan disimpan dalam antrean:', err);
    }
  }

  // Fallback offline / sebelum login penuh: simpan sementara lokal + antrekan unggah ulang
  simpanMediaWebsite({ id, nama: file.name, dataUrl, ukuran: blob.size });
  const antrean = bacaAntreanMedia().filter((item) => item.id !== id);
  simpanAntreanMedia([
    ...antrean,
    { id, filename: file.name, dataUrl, visibility, scope }
  ]);

  return {
    referensi: `media:${id}`,
    id,
    url: `/api/website/media/${encodeURIComponent(id)}`,
    storedOnServer: false,
    contentType,
    size: blob.size
  };
}

let flushSedangJalan = false;

/** Kirim foto-foto yang sempat tersimpan offline ke server begitu koneksi & sesi siap. */
export async function flushPendingMediaUploads(): Promise<number> {
  if (flushSedangJalan || typeof window === 'undefined' || typeof fetch !== 'function') return 0;
  const token = bacaTokenAuthLokal();
  if (!token || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;

  flushSedangJalan = true;
  try {
    const { db } = await import('../services/pocketbase');
    const identity = db.identitasSyncSiap();
    if (!identity) return 0;
    let antrean: PendingMediaItem[];
    try {
      antrean = bacaAntreanMedia();
    } catch (error) {
      console.error('Gagal membaca antrean media:', error);
      db.tahanSinkronisasi('Antrean media offline tidak dapat dibaca. Jangan hapus data browser; hubungi administrator.');
      return 0;
    }
    if (antrean.length === 0) return 0;
    const uploadedIds = new Set<string>();
    for (const item of antrean) {
      if (!db.isIdentitasSyncSiap(identity)) break;
      try {
        const { blob, contentType } = dataUrlToBlob(item.dataUrl);
        const serverRes = await kirimMediaBinerKeServer({
          id: item.id,
          filename: item.filename,
          blob,
          contentType,
          visibility: item.visibility,
          scope: item.scope,
          token,
          syncIdentity: identity
        });
        if (!db.isIdentitasSyncSiap(identity)) break;
        setPratinjauMemori(item.id, item.dataUrl);
        if (daftarMediaWebsite().some((m) => m.id === item.id)) {
          hapusMediaWebsite(item.id);
        }
        void mirrorAssetToFirestoreAsync({
          id: serverRes.id,
          filename: item.filename,
          contentType,
          dataUrl: item.dataUrl,
          size: serverRes.size,
          visibility: item.visibility,
          scope: item.scope,
          sha256: serverRes.sha256,
          uploadedBy: serverRes.uploadedBy
        });
        uploadedIds.add(item.id);
      } catch (error) {
        console.warn('Media offline belum berhasil diunggah:', error);
        if (error instanceof MediaUploadError && [400, 403, 409, 410].includes(error.status)) {
          db.tahanSinkronisasi(`Server menolak media offline: ${error.message}`);
          break;
        }
      }
    }
    try {
      simpanAntreanMedia(bacaAntreanMedia().filter((item) => !uploadedIds.has(item.id)));
    } catch (error) {
      console.error('Gagal memperbarui antrean media:', error);
      db.tahanSinkronisasi('Antrean media offline tidak dapat diperbarui. Jangan hapus data browser; hubungi administrator.');
    }
    return uploadedIds.size;
  } finally {
    flushSedangJalan = false;
  }
}
