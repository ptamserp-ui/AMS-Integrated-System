import { useEffect, useState } from 'react';
import { Construction, ExternalLink, RefreshCw } from 'lucide-react';
import type { KonfigurasiSitus } from '../../../../types';
import {
  adalahKonfigurasiSitus,
  bacaSnapshotInline,
  bacaWebsiteTerbitLokal,
  muatSnapshot,
  muatSnapshotDenganStatus,
  punyaDataOperasionalLokal,
  selesaikanGambar,
  terapkanFaviconAplikasi
} from '../../../../utils/websitePrimitives';
import PublicWebsite from './PublicWebsite';
import ErrorBoundary from '../../../common/ErrorBoundary';

export type StatusTayangPublik = 'tayang' | 'belum' | 'tahan';
type Status = 'memuat' | 'gagal' | StatusTayangPublik;

const ADALAH_PRATINJAU = new URLSearchParams(window.location.search).get('pratinjau') === '1';

/**
 * Pasang pendengar real-time terhadap perubahan status stok gudang, izin edar, recall,
 * serta skema/kontrak harga dari basis data operasional bila perangkat menyimpan state operasional.
 */
export function pasangPendengarOperasionalPublik(onSegarkan: (pemicu: string) => void): () => void {
  let aktif = true;
  let lepasKoleksi: (() => void) | undefined;

  const pasangKoleksi = async () => {
    const { db, KOLEKSI_OPERASIONAL_SITUS } = await import('../../../../services/pocketbase');
    if (!aktif) return;
    lepasKoleksi = db.subscribeKoleksi(KOLEKSI_OPERASIONAL_SITUS, (kunciKoleksi) => {
      onSegarkan(kunciKoleksi);
    });
  };

  if (ADALAH_PRATINJAU || punyaDataOperasionalLokal()) {
    void pasangKoleksi();
  }

  const padaOperasional = () => {
    if (!lepasKoleksi) void pasangKoleksi();
    onSegarkan('db_collection_updated');
  };
  const padaFokus = () => onSegarkan('window_focus');
  const padaVisibilitas = () => {
    if (document.visibilityState === 'visible') {
      onSegarkan('visibility_visible');
    }
  };

  window.addEventListener('ams:db-collection-updated', padaOperasional);
  window.addEventListener('focus', padaFokus);
  document.addEventListener('visibilitychange', padaVisibilitas);

  return () => {
    aktif = false;
    lepasKoleksi?.();
    window.removeEventListener('ams:db-collection-updated', padaOperasional);
    window.removeEventListener('focus', padaFokus);
    document.removeEventListener('visibilitychange', padaVisibilitas);
  };
}

/** Hook penyelarasan real-time agar konfigurasi situs selalu mencerminkan stok & harga operasional terbaru. */
export function useKonfigurasiOperasionalSinkron(dasar: KonfigurasiSitus | null): KonfigurasiSitus | null {
  const [hasil, setHasil] = useState<KonfigurasiSitus | null>(dasar);

  useEffect(() => {
    setHasil(dasar);
    if (!dasar) return;
    if (!ADALAH_PRATINJAU && !punyaDataOperasionalLokal()) return;

    let aktif = true;
    const selaraskan = async () => {
      const [{ db }, { selaraskanKontenOperasional }] = await Promise.all([
        import('../../../../services/pocketbase'),
        import('../../../../utils/website')
      ]);
      if (!aktif) return;
      setHasil(selaraskanKontenOperasional(dasar, db.getSumberOperasionalWebsite()));
    };

    void selaraskan();
    const lepas = pasangPendengarOperasionalPublik(() => {
      void selaraskan();
    });
    return () => {
      aktif = false;
      lepas();
    };
  }, [dasar]);

  return hasil;
}

/** Utamakan snapshot server, lalu selaraskan bila ada data operasional lokal. */
export async function tentukanKontenTayang(): Promise<{
  konfigurasi: KonfigurasiSitus | null;
  status: StatusTayangPublik;
}> {
  const lokalRingan = bacaWebsiteTerbitLokal();
  const inlineSnapshot = bacaSnapshotInline();
  const pembatalCadangan = new AbortController();
  let cadangan: Promise<KonfigurasiSitus | null> | undefined;
  const mulaiCadangan = () => cadangan ??= muatSnapshot('/website-published.json', pembatalCadangan.signal);
  const timerCadangan = setTimeout(() => void mulaiCadangan(), 300);
  let dariServer: KonfigurasiSitus | null;
  try {
    const hasilApi = await muatSnapshotDenganStatus('/api/website/published');
    if (hasilApi.belumAda) return { konfigurasi: null, status: 'belum' };
    dariServer = hasilApi.snapshot ?? (await mulaiCadangan()) ?? inlineSnapshot;
  } finally {
    clearTimeout(timerCadangan);
    pembatalCadangan.abort();
  }

  const terpilih = dariServer ?? lokalRingan;

  if (!terpilih) return { konfigurasi: null, status: 'belum' };

  if (ADALAH_PRATINJAU || punyaDataOperasionalLokal()) {
    const [{ db }, { selaraskanKontenOperasional }] = await Promise.all([
      import('../../../../services/pocketbase'),
      import('../../../../utils/website')
    ]);
    const terselaraskan = selaraskanKontenOperasional(terpilih, db.getSumberOperasionalWebsite());
    return {
      konfigurasi: terselaraskan,
      status: terselaraskan.isPublished ? 'tayang' : 'tahan'
    };
  }

  return {
    konfigurasi: terpilih,
    status: terpilih.isPublished ? 'tayang' : 'tahan'
  };
}

function bacaKontenAwalSinkron(): { konfigurasi: KonfigurasiSitus | null; status: Status } {
  const kandidat = bacaSnapshotInline();
  if (!kandidat) {
    return { konfigurasi: null, status: 'memuat' };
  }
  return {
    konfigurasi: kandidat,
    status: kandidat.isPublished ? 'tayang' : 'tahan'
  };
}

export default function PublicWebsiteApp() {
  const [isi, setIsi] = useState<{ konfigurasi: KonfigurasiSitus | null; status: Status }>(() =>
    ADALAH_PRATINJAU ? { konfigurasi: null, status: 'memuat' } : bacaKontenAwalSinkron()
  );
  const [drafPratinjau, setDrafPratinjau] = useState<KonfigurasiSitus | null>(null);

  const konfigurasiTayangSinkron = useKonfigurasiOperasionalSinkron(isi.konfigurasi);
  const drafPratinjauSinkron = useKonfigurasiOperasionalSinkron(drafPratinjau);

  /** Pratinjau dashboard: draf dikirim dari jendela induk lewat postMessage, tanpa menyentuh konten tayang. */
  useEffect(() => {
    if (!ADALAH_PRATINJAU) return;
    const terima = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; konfigurasi?: unknown };
      if (data?.type !== 'ams-website-pratinjau') return;
      if (adalahKonfigurasiSitus(data.konfigurasi)) setDrafPratinjau(data.konfigurasi);
    };
    window.addEventListener('message', terima);
    window.parent.postMessage({ type: 'ams-website-pratinjau-siap' }, window.location.origin);
    return () => window.removeEventListener('message', terima);
  }, []);

  useEffect(() => {
    if (ADALAH_PRATINJAU) return;
    let batal = false;
    let berhentiTerbit: (() => void) | undefined;
    let publicWs: WebSocket | null = null;
    let publicReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let diketahuiRevision = 0;
    let urutanMuat = 0;

    const muatKonten = () => {
      const urutan = ++urutanMuat;
      tentukanKontenTayang().then((hasil) => {
        if (!batal && urutan === urutanMuat) setIsi(hasil);
      }).catch((error: unknown) => {
        console.error('Gagal memuat konten situs publik:', error);
        if (!batal && urutan === urutanMuat) {
          setIsi((sebelumnya) => sebelumnya.status === 'memuat'
            ? { konfigurasi: null, status: 'gagal' }
            : sebelumnya);
        }
      });
    };

    muatKonten();

    const padaMediaBerubah = () => {
      muatKonten();
    };
    const padaFokus = () => {
      muatKonten();
    };
    const padaVisibilitas = () => {
      if (document.visibilityState === 'visible') {
        muatKonten();
      }
    };
    window.addEventListener('ams:media-uploaded', padaMediaBerubah);
    window.addEventListener('ams:media-deleted', padaMediaBerubah);
    window.addEventListener('focus', padaFokus);
    document.addEventListener('visibilitychange', padaVisibilitas);

    const pasangWsPublikRingan = () => {
      if (batal || typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/sync/ws`;
      try {
        const ws = new WebSocket(wsUrl);
        publicWs = ws;
        ws.onmessage = (ev: MessageEvent) => {
          if (batal) return;
          try {
            const msg = JSON.parse(String(ev.data)) as {
              type?: string;
              key?: string;
              value?: unknown;
              revision?: number;
              entries?: Record<string, { value?: unknown }>;
            };
            if (!msg?.type) return;
            if (msg.type === 'sync:hello' && typeof msg.revision === 'number') {
              if (diketahuiRevision > 0 && msg.revision > diketahuiRevision) {
                muatKonten();
              }
              diketahuiRevision = Math.max(diketahuiRevision, msg.revision);
              return;
            }
            if (typeof msg.revision === 'number') {
              diketahuiRevision = Math.max(diketahuiRevision, msg.revision);
            }
            if (msg.type === 'sync:update' && msg.key === 'website_published' && adalahKonfigurasiSitus(msg.value)) {
              urutanMuat += 1;
              setIsi({
                konfigurasi: msg.value,
                status: msg.value.isPublished ? 'tayang' : 'tahan'
              });
              return;
            }
            if (msg.type === 'sync:batch-update' && msg.entries?.website_published?.value && adalahKonfigurasiSitus(msg.entries.website_published.value)) {
              const cfg = msg.entries.website_published.value;
              urutanMuat += 1;
              setIsi({
                konfigurasi: cfg,
                status: cfg.isPublished ? 'tayang' : 'tahan'
              });
              return;
            }
            if (msg.type === 'media:uploaded' || msg.type === 'media:deleted') {
              muatKonten();
            }
          } catch {
            /* abaikan pesan tidak dikenal */
          }
        };
        ws.onclose = () => {
          if (publicWs === ws) publicWs = null;
          if (!batal && !publicReconnectTimer) {
            publicReconnectTimer = setTimeout(() => {
              publicReconnectTimer = null;
              pasangWsPublikRingan();
            }, 4000);
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            /* abaikan */
          }
        };
      } catch {
        /* fallback tetap aman via fetch */
      }
    };

    const hubungkanOperasional = async () => {
      const { db } = await import('../../../../services/pocketbase');
      if (batal) return;
      await db.hydratePublicSettingsFromServer().catch(() => {});
      if (batal) return;
      muatKonten();
      db.connectRealtimeSync();
      berhentiTerbit = db.subscribeKoleksi(['website_published'], muatKonten);
    };

    pasangWsPublikRingan();
    if (punyaDataOperasionalLokal()) {
      void hubungkanOperasional();
    }

    return () => {
      batal = true;
      window.removeEventListener('ams:media-uploaded', padaMediaBerubah);
      window.removeEventListener('ams:media-deleted', padaMediaBerubah);
      window.removeEventListener('focus', padaFokus);
      document.removeEventListener('visibilitychange', padaVisibilitas);
      berhentiTerbit?.();
      if (publicReconnectTimer) clearTimeout(publicReconnectTimer);
      if (publicWs) {
        try {
          publicWs.close();
        } catch {
          /* abaikan */
        }
      }
    };
  }, []);

  useEffect(() => {
    const aktif = ADALAH_PRATINJAU ? drafPratinjauSinkron : konfigurasiTayangSinkron;
    if (!aktif) return;
    const fav = selesaikanGambar(aktif.identitas.faviconUrl || aktif.identitas.logoUrl);
    terapkanFaviconAplikasi(fav);
  }, [drafPratinjauSinkron, konfigurasiTayangSinkron]);

  if (ADALAH_PRATINJAU) {
    if (!drafPratinjauSinkron) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Menunggu draf konten dari dashboard…
          </div>
        </div>
      );
    }
    return (
      <ErrorBoundary label="pratinjau situs publik">
        <PublicWebsite konfigurasi={drafPratinjauSinkron} pratinjau />
      </ErrorBoundary>
    );
  }

  if (isi.status === 'memuat') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Memuat konten situs…
        </div>
      </div>
    );
  }

  if (isi.status === 'tayang' && konfigurasiTayangSinkron) {
    return (
      <ErrorBoundary label="situs publik">
        <PublicWebsite
          konfigurasi={konfigurasiTayangSinkron}
          padaMasuk={() => {
            window.location.href = '/?masuk=1';
          }}
        />
      </ErrorBoundary>
    );
  }

  const pesan =
    isi.status === 'gagal'
      ? 'Konten situs tidak dapat dimuat. Periksa koneksi dan coba muat ulang halaman.'
      : isi.status === 'tahan'
      ? 'Konten situs sedang ditahan (on hold). Halaman kembali tayang setelah penerbitan berikutnya.'
      : 'Belum ada konten yang diterbitkan untuk situs publik ini.';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
          <Construction className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{isi.status === 'gagal' ? 'Situs Tidak Dapat Dimuat' : 'Situs Publik Belum Tayang'}</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{pesan}</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_85%,black)] text-white text-sm font-semibold"
        >
          <ExternalLink className="w-4 h-4" />
          Buka Dashboard Website
        </a>
      </div>
    </div>
  );
}
