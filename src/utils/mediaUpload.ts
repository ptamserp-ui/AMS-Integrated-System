import { kompresGambarWebsite } from './website';
import {
  daftarMediaWebsite,
  hapusMediaWebsite,
  setPratinjauMemori,
  simpanMediaWebsite
} from './websitePrimitives';

const KUNCI_SESI_AUTH = 'ams_alkes_sesi_login_v2';
const KUNCI_PENDING_MEDIA = 'ams_alkes_pending_media_uploads_v1';

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

function bacaAntreanMedia(): PendingMediaItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KUNCI_PENDING_MEDIA);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PendingMediaItem[]) : [];
  } catch {
    return [];
  }
}

function simpanAntreanMedia(items: PendingMediaItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (items.length === 0) {
      localStorage.removeItem(KUNCI_PENDING_MEDIA);
    } else {
      localStorage.setItem(KUNCI_PENDING_MEDIA, JSON.stringify(items));
    }
  } catch {
    /* abaikan kuota penuh */
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
    await pushMediaAssetToFirestore(payload);
  } catch {
    /* fallback aman — gambar sudah tersimpan sebagai file di server Express */
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
}): Promise<{
  ok: true;
  id: string;
  url: string;
  sha256: string;
  uploadedBy: string;
  size: number;
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
      'X-Media-Scope': params.scope
    },
    body: params.blob
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ams:auth-expired'));
    throw new Error('Sesi login berakhir. Silakan masuk ulang untuk mengunggah foto.');
  }

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: string;
    url?: string;
    pesan?: string;
    media?: { sha256?: string; uploadedBy?: string; size?: number };
  };

  if (!res.ok) {
    throw new Error(body.pesan || `Gagal mengunggah foto ke server (HTTP ${res.status}).`);
  }

  return {
    ok: true,
    id: body.id || params.id,
    url: body.url || `/api/website/media/${encodeURIComponent(params.id)}`,
    sha256: body.media?.sha256 || '0000000000000000',
    uploadedBy: body.media?.uploadedBy || 'user',
    size: body.media?.size ?? params.blob.size
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
    try {
      const serverRes = await kirimMediaBinerKeServer({
        id,
        filename: file.name,
        blob,
        contentType,
        visibility,
        scope,
        token
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
        size: serverRes.size
      };
    } catch (err) {
      // Penolakan otorisasi / validasi konten tidak perlu masuk antrean offline
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('Sesi login') ||
        msg.includes('Akses ditolak') ||
        msg.includes('Format gambar') ||
        msg.includes('Ukuran gambar')
      ) {
        throw err;
      }
      // Kegagalan jaringan sementara -> lanjutkan antrean offline di bawah
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

  const antrean = bacaAntreanMedia();
  if (antrean.length === 0) return 0;

  flushSedangJalan = true;
  let uploadedCount = 0;
  const sisa: PendingMediaItem[] = [];

  try {
    for (const item of antrean) {
      try {
        const { blob, contentType } = dataUrlToBlob(item.dataUrl);
        const serverRes = await kirimMediaBinerKeServer({
          id: item.id,
          filename: item.filename,
          blob,
          contentType,
          visibility: item.visibility,
          scope: item.scope,
          token
        });
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
        uploadedCount += 1;
      } catch {
        sisa.push(item);
      }
    }
    simpanAntreanMedia(sisa);
  } finally {
    flushSedangJalan = false;
  }

  return uploadedCount;
}
