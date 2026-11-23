import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Users,
  Gavel,
  MapPinned,
  ShoppingCart,
  Megaphone,
  ChartColumn,
  Mail,
  BookOpen
} from 'lucide-react';
import { PelangganB2B, UserRole } from '../../../types';
import ErrorBoundary from '../../common/ErrorBoundary';

const CrmProspekModule = lazy(() => import('./sales/CrmProspekModule'));
const TenderKontrakModule = lazy(() => import('./sales/TenderKontrakModule'));
const SalesForceModule = lazy(() => import('./sales/SalesForceModule'));
const SalesOrderModule = lazy(() => import('./sales/SalesOrderModule'));
const KampanyeMarketingModule = lazy(() => import('./sales/KampanyeMarketingModule'));
const AnalitikSalesModule = lazy(() => import('./sales/AnalitikSalesModule'));
const ListmonkModule = lazy(() => import('./sales/ListmonkModule'));
const InternalCatalogModule = lazy(() => import('./sales/InternalCatalogModule'));

export type SalesTab = 'crm' | 'tender' | 'sfa' | 'order' | 'kampanye' | 'listmonk' | 'analitik' | 'katalog-internal';

const TABS: { id: SalesTab; label: string; ikon: typeof Users }[] = [
  { id: 'analitik', label: 'Analitik & Dashboard (BI)', ikon: ChartColumn },
  { id: 'crm', label: 'CRM & Management Prospek', ikon: Users },
  { id: 'tender', label: 'Manajemen Tender & Kontrak (e-Katalog & LPSE)', ikon: Gavel },
  { id: 'sfa', label: 'Otomasi Sales Force (SFA)', ikon: MapPinned },
  { id: 'order', label: 'Manajemen Order & Penjualan', ikon: ShoppingCart },
  { id: 'katalog-internal', label: 'e-Brochure (PDF)', ikon: BookOpen },
  { id: 'kampanye', label: 'Marketing, Promo & Campaign Management', ikon: Megaphone },
  { id: 'listmonk', label: 'Newsletter & Mailing List (listmonk)', ikon: Mail }
];

export default function SalesModule({
  currentRole,
  initialTab = 'order',
  onTabChange,
  onBuatQuotationUntukPelanggan
}: {
  currentRole: UserRole;
  initialTab?: SalesTab;
  onTabChange?: (tab: SalesTab) => void;
  onBuatQuotationUntukPelanggan?: (pelanggan: PelangganB2B) => void;
}) {
  const [activeTab, setActiveTab] = useState<SalesTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const pilihTab = (tab: SalesTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs no-print">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            Komersialisasi &amp; e-Katalog
          </span>
          <span className="text-xs text-slate-500">Etika Promosi Alkes Permenkes RI &amp; LKPP</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-1">
          Sales &amp; Marketing
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
          Distribusi alkes ke Rumah Sakit Pemerintah (LKPP), RS Swasta, dan Klinik dengan verifikasi etika promosi alkes oleh PJT (bebas dari klaim medis palsu) dan alokasi stok sistem FEFO sadar-kunci.
        </p>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">
          Cetak biru divisi komersial: 8 kelompok kerja (Analitik BI, CRM &amp; Prospek, Tender &amp; Kontrak, Otomasi Sales Force,
          Manajemen Order, Penyusun e-Brochure PDF, Kampanye &amp; Rebate, Newsletter &amp; Mailing List). Penerbitan Quotation resmi kini terintegrasi pada menu{' '}
          <strong className="text-slate-700">Internal Document</strong> bersama seluruh formulir terkendali CDAKB.
        </p>
      </div>

      <div className="flex items-center gap-1.5 border-b border-slate-200 text-xs overflow-x-auto no-print">
        {TABS.map((tab) => {
          const Ikon = tab.ikon;
          const aktif = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => pilihTab(tab.id)}
              className={`pb-3 px-3 font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                aktif ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Ikon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <ErrorBoundary resetKey={activeTab} label="sub-modul Sales">
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-500">
              Memuat sub-modul Sales…
            </div>
          }
        >
          {activeTab === 'crm' && (
            <CrmProspekModule onBuatQuotation={onBuatQuotationUntukPelanggan} />
          )}
          {activeTab === 'tender' && <TenderKontrakModule />}
          {activeTab === 'sfa' && <SalesForceModule />}
          {activeTab === 'order' && <SalesOrderModule />}
          {activeTab === 'katalog-internal' && <InternalCatalogModule />}
          {activeTab === 'kampanye' && <KampanyeMarketingModule />}
          {activeTab === 'listmonk' && <ListmonkModule currentRole={currentRole} />}
          {activeTab === 'analitik' && <AnalitikSalesModule />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
