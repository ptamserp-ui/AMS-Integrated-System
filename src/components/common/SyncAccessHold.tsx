import { useEffect, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { db } from '../../services/pocketbase';

export function useSyncHoldReason(): string | null {
  const [reason, setReason] = useState(() => db.getSyncHoldReason());
  useEffect(() => {
    const update = () => setReason(db.getSyncHoldReason());
    const unsubscribe = db.subscribe('connection_status', update);
    update();
    return unsubscribe;
  }, []);
  return reason;
}

export default function SyncAccessHold({
  reason,
  onRetry,
  onLogout
}: {
  reason: string;
  onRetry: () => Promise<void>;
  onLogout: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setChecking(true);
    setError(null);
    try {
      await onRetry();
    } catch (cause) {
      console.error('Gagal memeriksa ulang sinkronisasi:', cause);
      setError('Pemeriksaan ulang gagal. Hubungi administrator.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div role="alert" className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-amber-800">
          <Lock className="h-5 w-5" />
          <h1 className="text-lg font-bold">Akses sementara ditahan</h1>
        </div>
        <p className="text-sm text-slate-800">{reason}</p>
        <p className="text-sm text-slate-600">
          Perubahan offline yang masih ada dipertahankan pada browser ini. Jangan hapus data browser atau gunakan perangkat bersama.
          Hubungi administrator untuk memulihkan akun dan hak akses semula, lalu periksa ulang.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={checking}
            onClick={() => void retry()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Periksa ulang
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Keluar untuk mengganti akun
          </button>
        </div>
      </div>
    </main>
  );
}
