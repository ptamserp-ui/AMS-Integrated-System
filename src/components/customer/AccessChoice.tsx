import { useEffect, useRef, useState } from 'react';
import { Building2, CircleUserRound, X } from 'lucide-react';
import { customerApi } from '../../services/customerPortal';

export default function AccessChoice({ onEmployee, onClose }: { onEmployee: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const employeeRef = useRef(onEmployee);
  employeeRef.current = onEmployee;

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    customerApi.status().then((status) => {
      if (!active) return;
      if (!status.enabled) { employeeRef.current(); return; }
      setEnabled(true);
    }).catch(() => {
      if (active) setError('Status Customer Portal belum dapat diperiksa. Akses karyawan tetap tersedia.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); onClose(); }}
      aria-labelledby="access-title" className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/60 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Remedi-AMS</p><h2 id="access-title" className="mt-2 text-2xl font-bold">Pilih akses Anda</h2></div>
        <button type="button" aria-label="Tutup pilihan akses" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-3 text-sm text-slate-600">Akun karyawan dan customer memiliki ruang kerja serta hak akses yang terpisah.</p>
      {loading && <p role="status" className="mt-4 text-sm text-slate-500">Memeriksa akses...</p>}
      {error && <p role="alert" className="mt-4 text-sm text-amber-800">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onEmployee} className="rounded-xl border border-slate-300 p-5 text-left hover:bg-slate-50">
          <Building2 className="mb-3 h-6 w-6 text-slate-600" /><span className="block font-bold">Masuk Karyawan</span>
          <span className="mt-2 block text-xs leading-relaxed text-slate-500">Gunakan akun ERP dan hak akses perusahaan yang sudah terdaftar.</span>
        </button>
        {enabled && <a href="/akun/masuk" className="rounded-xl border border-teal-300 bg-teal-50 p-5 text-left hover:bg-teal-100">
          <CircleUserRound className="mb-3 h-6 w-6 text-teal-700" /><span className="block font-bold text-teal-900">Masuk / Daftar Customer</span>
          <span className="mt-2 block text-xs leading-relaxed text-teal-800">Masuk atau buat akun pelanggan bisnis.</span>
        </a>}
      </div>
    </dialog>
  );
}
