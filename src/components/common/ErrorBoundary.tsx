import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof console !== 'undefined') {
      console.error('[AMS ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunkError = /dynamically imported module|loading chunk|failed to fetch/i.test(
      this.state.error.message || ''
    );
    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xs"
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">
          {isChunkError
            ? `Pembaruan tersedia untuk ${this.props.label || 'halaman ini'}`
            : `Gagal memuat ${this.props.label || 'bagian ini'}`}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          {isChunkError
            ? 'Versi aplikasi terbaru sudah tersedia atau koneksi terputus sementara. Muat ulang agar modul kembali sinkron.'
            : 'Terjadi kendala saat menampilkan tampilan ini. Coba muat ulang bagian ini tanpa menutup modul lain.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
