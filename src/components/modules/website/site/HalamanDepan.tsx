/**
 * HALAMAN DEPAN APLIKASI — tampilan situs publik yang sama, dipakai sebagai beranda
 * sebelum pengguna masuk. Dashboard hanya dirender setelah sesi login tersimpan.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import type { KonfigurasiSitus } from '../../../../types';
import type { SesiLogin } from '../../../../utils/autentikasi';
import {
  bacaSnapshotInline,
  punyaDataOperasionalLokal
} from '../../../../utils/websitePrimitives';
import PublicWebsite from './PublicWebsite';
import { tentukanKontenTayang, useKonfigurasiOperasionalSinkron } from './PublicWebsiteApp';

const KartuMasuk = lazy(() => import('./KartuMasuk'));
const AccessChoice = lazy(() => import('../../../customer/AccessChoice'));
const MobilePreviewModal = lazy(() =>
  import('../../../mobile/MobilePreviewModal').then((m) => ({ default: m.MobilePreviewModal }))
);

type StatusMuat = 'memuat' | 'selesai';

function bacaBerandaAwalSinkron(): {
  konfigurasi: KonfigurasiSitus | null;
  statusTayang: 'tayang' | 'belum' | 'tahan';
  status: StatusMuat;
} {
  const terpilih = bacaSnapshotInline();
  if (!terpilih) {
    return { konfigurasi: null, statusTayang: 'belum', status: 'memuat' };
  }
  return {
    konfigurasi: terpilih,
    statusTayang: terpilih.isPublished ? 'tayang' : 'tahan',
    status: 'selesai'
  };
}

export default function HalamanDepan({ onMasuk }: { onMasuk: (sesi: SesiLogin) => void }) {
  const awal = bacaBerandaAwalSinkron();
  const [konfigurasiDasar, setKonfigurasiDasar] = useState<KonfigurasiSitus | null>(awal.konfigurasi);
  const [statusTayang, setStatusTayang] = useState<'tayang' | 'belum' | 'tahan'>(awal.statusTayang);
  const [status, setStatus] = useState<StatusMuat>(awal.status);
  const [formTerbuka, setFormTerbuka] = useState(() => new URLSearchParams(window.location.search).get('masuk') === '1');
  const [pilihanTerbuka, setPilihanTerbuka] = useState(false);
  const [previewMobileTerbuka, setPreviewMobileTerbuka] = useState(
    () => new URLSearchParams(window.location.search).get('preview') === 'mobile'
  );

  const konfigurasi = useKonfigurasiOperasionalSinkron(konfigurasiDasar);

  useEffect(() => {
    let batal = false;
    let berhentiTerbit: (() => void) | undefined;
    let publicWs: WebSocket | null = null;
    let publicReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let diketahuiRevision = 0;
    let urutanMuat = 0;

    const muat = () => {
      const urutan = ++urutanMuat;
      tentukanKontenTayang().then(({ konfigurasi: isi, status: st }) => {
        if (batal || urutan !== urutanMuat) return;
        setKonfigurasiDasar(isi);
        setStatusTayang(st);
        setStatus('selesai');
      }).catch((error: unknown) => {
        console.error('Gagal memuat halaman depan:', error);
        if (!batal && urutan === urutanMuat) setStatus('selesai');
      });
    };

    void fetch('/api/auth/setup-status', { method: 'GET', credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((stSetup: { needsSetup?: boolean; needsDeveloperReset?: boolean } | null) => {
        if (!batal && (stSetup?.needsSetup || stSetup?.needsDeveloperReset)) {
          setPilihanTerbuka(false);
          setFormTerbuka(true);
        }
      })
      .catch(() => {});

    muat();

    const padaFokus = () => muat();
    const padaVisibilitas = () => {
      if (document.visibilityState === 'visible') muat();
    };
    window.addEventListener('ams:media-uploaded', padaFokus);
    window.addEventListener('ams:media-deleted', padaFokus);
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
              revision?: number;
              entries?: Record<string, { value?: unknown }>;
            };
            if (!msg?.type) return;
            if (msg.type === 'sync:hello' && typeof msg.revision === 'number') {
              if (diketahuiRevision > 0 && msg.revision > diketahuiRevision) {
                muat();
              }
              diketahuiRevision = Math.max(diketahuiRevision, msg.revision);
              return;
            }
            if (typeof msg.revision === 'number') {
              diketahuiRevision = Math.max(diketahuiRevision, msg.revision);
            }
            if (
              (msg.type === 'sync:update' && msg.key === 'website_published') ||
              (msg.type === 'sync:batch-update' && msg.entries?.website_published) ||
              msg.type === 'media:uploaded' ||
              msg.type === 'media:deleted'
            ) {
              muat();
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
        /* fallback tetap aman */
      }
    };

    pasangWsPublikRingan();
    if (punyaDataOperasionalLokal()) {
      void import('../../../../services/pocketbase').then(async ({ db }) => {
        if (batal) return;
        await db.hydratePublicSettingsFromServer().catch(() => {});
        if (batal) return;
        muat();
        db.connectRealtimeSync(null);
        berhentiTerbit = db.subscribeKoleksi(['website_published'], muat);
      });
    }

    return () => {
      batal = true;
      window.removeEventListener('ams:media-uploaded', padaFokus);
      window.removeEventListener('ams:media-deleted', padaFokus);
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

  const terima = (sesi: SesiLogin) => {
    setFormTerbuka(false);
    onMasuk(sesi);
  };

  if (status === 'memuat') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Memuat halaman…</p>
      </div>
    );
  }

  /* Tanpa konten terbit (mis. publikasi ditahan) gerbang tetap harus bisa dibuka. */
  if (!konfigurasi || statusTayang !== 'tayang') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-3">
          <Suspense
            fallback={
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
                Memuat form masuk…
              </div>
            }
          >
            <KartuMasuk onTerima={terima} onBatal={() => window.location.href = '/web/'} />
          </Suspense>
          <button
            type="button"
            onClick={() => setPreviewMobileTerbuka(true)}
            className="w-full min-h-[44px] rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-xs font-bold text-teal-800 inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            Tampilkan Preview Aplikasi Mobile (/mobile)
          </button>
        </div>
        {previewMobileTerbuka && (
          <Suspense fallback={null}>
            <MobilePreviewModal
              isOpen={previewMobileTerbuka}
              onClose={() => setPreviewMobileTerbuka(false)}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <PublicWebsite konfigurasi={konfigurasi} landasan="/" padaMasuk={() => setPilihanTerbuka(true)} />
      {pilihanTerbuka && (
        <Suspense fallback={<p role="status" className="fixed top-4 right-4 z-50 rounded-xl bg-white p-4 shadow-lg">Memuat pilihan akses...</p>}>
          <AccessChoice
            onClose={() => setPilihanTerbuka(false)}
            onEmployee={() => { setPilihanTerbuka(false); setFormTerbuka(true); }}
          />
        </Suspense>
      )}
      <button
        type="button"
        onClick={() => setPreviewMobileTerbuka(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-teal-500 bg-teal-700 hover:bg-teal-800 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
      >
        <Smartphone className="w-4 h-4" />
        Preview Mobile App
      </button>
      {formTerbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setFormTerbuka(false)} />
          <div className="relative w-full max-w-md my-auto">
            <Suspense
              fallback={
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 shadow-xl">
                  Memuat form masuk…
                </div>
              }
            >
              <KartuMasuk
                logoUrl={konfigurasi.identitas.logoUrl}
                onTerima={terima}
                onBatal={() => setFormTerbuka(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
      {previewMobileTerbuka && (
        <Suspense fallback={null}>
          <MobilePreviewModal
            isOpen={previewMobileTerbuka}
            onClose={() => setPreviewMobileTerbuka(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
