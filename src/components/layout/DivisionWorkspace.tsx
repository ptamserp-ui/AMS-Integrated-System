import { ArrowRight, Layers3 } from 'lucide-react';
import type { AksesEfektif, DivisionId, ModuleId } from '../../types';
import { bolehAksesModul } from '../../utils/hakAkses';
import { ALL_TABS, DIVISION_LABELS, type NavId } from './Navbar';

const DIVISION_DESCRIPTIONS: Record<DivisionId, string> = {
  commercial: 'Penjualan, pengadaan, perizinan, dan kepatuhan produk.',
  operations: 'Gudang, inspeksi mutu, produksi, serta layanan purnajual.',
  finance: 'Akuntansi, pengelolaan keuangan, dan perpajakan.',
  support: 'Sumber daya manusia, fasilitas umum, dan teknologi informasi.'
};

export default function DivisionWorkspace({
  division,
  aksesAktif,
  onSelectModule
}: {
  division: DivisionId;
  aksesAktif: AksesEfektif;
  onSelectModule: (module: NavId) => void;
}) {
  const modules = ALL_TABS.filter(
    (tab): tab is typeof tab & { id: ModuleId } =>
      tab.group === division &&
      tab.id !== 'website' &&
      tab.id !== 'overview' &&
      bolehAksesModul(tab.id, aksesAktif)
  );

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Layers3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Area Divisi</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{DIVISION_LABELS[division]}</h2>
            <p className="mt-1 text-sm text-slate-600">{DIVISION_DESCRIPTIONS[division]}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">Pilih modul</h3>
        <span className="text-xs text-slate-500">{modules.length} modul tersedia</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onSelectModule(module.id)}
              className="group flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-slate-800">{module.label}</span>
                {module.badge && (
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-500">
                    {module.badge}
                  </span>
                )}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
