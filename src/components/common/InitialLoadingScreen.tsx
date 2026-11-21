interface InitialLoadingScreenProps {
  title?: string;
  message?: string;
}

export default function InitialLoadingScreen({
  title = 'SINKRONISASI RBAC & DATABASE REAL-TIME',
  message = 'Menunggu inisialisasi koneksi...'
}: InitialLoadingScreenProps) {
  return (
    <main className="initial-loading-screen" role="status" aria-live="polite">
      <div className="initial-loading-screen__container">
        <div className="initial-loading-screen__icon" aria-hidden="true">
          <svg width="44" height="47" viewBox="0 0 44 47" fill="currentColor">
            <path d="M22 0h18v4h4v14h-4v4h-8v4h4v4h-4v-4h-4v8h-4v6h-4v7h-4v-7h-4v-4H8v-4H4v-4H0V16h4v4h4v4h4v-4h4v-4h4V4h2V0zm6 6v4h4V6h-4z" />
          </svg>
        </div>

        <div
          className="initial-loading-screen__track"
          role="progressbar"
          aria-label="Memuat aplikasi"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="initial-loading-screen__fill" />
        </div>

        <p className="initial-loading-screen__title">{title}</p>
        <p className="initial-loading-screen__message">{message}</p>
      </div>
    </main>
  );
}
