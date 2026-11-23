import type { FormEvent } from "react";
import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Award, 
  CheckCircle2, 
  Warehouse, 
  Wrench, 
  Factory, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Coins, 
  Cpu,
  Globe,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  LayoutGrid,
  CloudCheck,
  Printer,
  Search,
  QrCode,
  KeyRound,
  ShieldCheck,
  Shield,
  Crown,
  UserCog,
  LogOut,
  Smartphone,
  PackageSearch,
  ShieldAlert,
  FileCheck2
} from 'lucide-react';
import { AksesEfektif, DivisionId, ModuleId, UserRole } from '../../types';
import LogoAplikasi from '../common/LogoAplikasi';
import { db } from '../../services/pocketbase';
import { gantiKataSandiServer, punyaIzin, type SesiLogin } from '../../utils/autentikasi';
import { bolehAksesModul, SEMUA_ID_MODUL } from '../../utils/hakAkses';
import type { ITSubTabId } from '../modules/supporting/ITModule';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import GlobalSearchBar, { type SearchNavigationTarget } from './GlobalSearchBar';

const MobilePreviewModal = lazy(() =>
  import('../mobile/MobilePreviewModal').then((m) => ({ default: m.MobilePreviewModal }))
);

export type Tone = 'slate' | 'amber' | 'indigo' | 'blue' | 'emerald' | 'rose';
export type NavId = ModuleId | DivisionId | 'overview' | 'website';

/** Menu utama hanya menampilkan pintu masuk divisi dan tab penting. */
export type MainMenuItem = { kind: 'tab'; id: ModuleId | 'overview' | 'website' } | { kind: 'division'; id: DivisionId };

export interface TabDef {
  id: ModuleId | 'overview' | 'website';
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: DivisionId;
  badge?: string;
}

const TONE_ACTIVE = 'bg-slate-700 text-white';

const TONE_ICON = 'text-slate-500';

const TONE_HOVER = 'hover:bg-slate-200 hover:text-slate-900';

export const DIVISION_ORDER: DivisionId[] = [
  'commercial',
  'operations',
  'finance',
  'support'
];

export const DIVISION_LABELS: Record<DivisionId, string> = {
  commercial: 'Commercial',
  operations: 'Operations',
  finance: 'Finance & Accounting',
  support: 'Support'
};

export const MAIN_MENU: MainMenuItem[] = [
  { kind: 'tab', id: 'website' },
  { kind: 'division', id: 'commercial' },
  { kind: 'division', id: 'operations' },
  { kind: 'division', id: 'finance' },
  { kind: 'division', id: 'support' },
  { kind: 'tab', id: 'dokumen-internal' },
  { kind: 'tab', id: 'overview' }
];

export const ALL_TABS: TabDef[] = [
  { id: 'website', label: 'Website', short: 'Website', icon: Globe, badge: 'SEGERA' },

  { id: 'sales-marketing', label: 'Sales & Marketing', short: 'Sales', icon: TrendingUp, group: 'commercial', badge: 'LKPP' },
  { id: 'product-catalog', label: 'Product Catalog', short: 'Produk', icon: PackageSearch, group: 'commercial' },
  { id: 'purchasing-procurement', label: 'Purchasing & Procurement', short: 'Beli', icon: ShoppingCart, group: 'commercial' },
  { id: 'ra-pjt', label: 'Regulatory Affairs (RA) & Penanggung Jawab Teknis (PJT)', short: 'Izin Edar', icon: Building2, group: 'commercial', badge: 'WAJIB' },
  { id: 'qa-mutu', label: 'Quality Assurance (QA) / Pemastian Mutu', short: 'QA', icon: Award, group: 'commercial', badge: 'ISO' },
  { id: 'pms-vigilance', label: 'Post-Market Surveillance (PMS) / Vigilance', short: 'KTD', icon: AlertTriangle, group: 'commercial', badge: 'KTD' },

  { id: 'gudang-logistik', label: 'Logistics & Warehouse', short: 'Gudang', icon: Warehouse, group: 'operations', badge: 'CDAKB' },
  { id: 'qc-inspeksi', label: 'Quality Control (QC) / Inspeksi Teknis', short: 'QC', icon: CheckCircle2, group: 'operations', badge: 'RILIS' },
  { id: 'teknisi-service', label: 'Technical & After-Sales Service', short: 'Teknisi', icon: Wrench, group: 'operations' },
  { id: 'produksi-cpakb', label: 'Manufacturing', short: 'CPAKB', icon: Factory, group: 'operations', badge: 'BMR' },

  { id: 'finance-akuntansi', label: 'Finance & Accounting', short: 'Finance', icon: Coins, group: 'finance', badge: 'PPN 11%' },

  { id: 'hrd-pelatihan', label: 'HRD & General Affairs (GA)', short: 'HRD & GA', icon: Users, group: 'support' },
  { id: 'it-traceability', label: 'Information Technology (IT)', short: 'IT Hub', icon: Cpu, group: 'support', badge: 'CADDY' },

  { id: 'dokumen-internal', label: 'Internal Document', short: 'Internal Doc', icon: FileCheck2, badge: 'CDAKB' },
  { id: 'overview', label: 'Executive Overview', short: 'Overview', icon: LayoutDashboard, badge: 'Cockpit' },
];

const BOTTOM_PRIORITY: Array<ModuleId | 'overview'> = [
  'overview',
  'ra-pjt',
  'gudang-logistik',
  'pms-vigilance',
];

/** Nama akun aktif — dipakai sebagai pelaku pada audit trail seluruh modul. */
export const namaPengguna = (r: UserRole) => {
  switch (r) {
    case 'pjt': return 'apt. Dewi Kartika - PJT Alkes';
    case 'qa_manager': return 'Budi Utomo, S.T - QA Manager';
    case 'qc_officer': return 'Hendra Setiawan - Lead QC Inspector';
    case 'kepala_gudang': return 'Ahmad Fauzi - Kepala Gudang';
    case 'teknisi_elektromedik': return 'Dian Nugraha - Teknisi Elektromedis';
    case 'manajer_produksi': return 'Ir. Agus Santoso - Manufaktur CPAKB';
    case 'purchasing': return 'Dewi Anggraini - Purchasing Alkes';
    case 'sales_manager': return 'Farhan Maulana - Sales e-Katalog';
    case 'sales_medrep': return 'Sales & Medical Representative';
    case 'karyawan': return 'Karyawan AMS';
    case 'it_admin': return 'Admin IT & Traceability Hub';
    case 'developer_it_support': return 'Developer & IT Support';
    default: return 'Pengguna Terdaftar';
  }
};

/** Peran jabatan akun aktif. */
export const peranPengguna = (r: UserRole) => {
  switch (r) {
    case 'pjt': return 'Penanggung Jawab Teknis';
    case 'qa_manager': return 'Pemastian Mutu ISO 13485';
    case 'qc_officer': return 'Pengawasan Mutu Alkes';
    case 'kepala_gudang': return 'Gudang & Logistik CDAKB';
    case 'teknisi_elektromedik': return 'Elektromedis Ber-STR';
    case 'manajer_produksi': return 'Manufaktur CPAKB';
    case 'purchasing': return 'Purchasing & Pemasok';
    case 'sales_manager': return 'Sales e-Katalog LKPP';
    case 'sales_medrep': return 'Sales & MedRep Lapangan';
    case 'karyawan': return 'Karyawan (HRIS Mobile)';
    case 'it_admin': return 'IT & Traceability Hub';
    case 'developer_it_support': return 'Developer & IT Support';
    default: return 'Staff';
  }
};

/** Avatar peran. Dipasang di level modul: komponen yang didefinisikan di dalam komponen lain
 *  dibuat ulang setiap render, sehingga subtree-nya kehilangan state (noComponentHookFactories). */
function RoleAvatar({ peran }: { peran: UserRole }) {
  if (peran === 'pjt') {
    return (
      <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs">
        <Crown className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (peran === 'qa_manager') {
    return (
      <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs">
        <Shield className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (peran === 'qc_officer') {
    return (
      <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white text-xs">
        <CheckCircle2 className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (peran === 'kepala_gudang') {
    return (
      <div className="w-6 h-6 rounded-md bg-amber-600 flex items-center justify-center text-white text-xs">
        <Warehouse className="w-3.5 h-3.5" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-white text-xs">
      <UserCog className="w-3.5 h-3.5" />
    </div>
  );
}

interface NavbarProps {
  currentTab: NavId;
  setCurrentTab: (tab: NavId) => void;
  currentRole: UserRole;
  sesi?: SesiLogin;
  onRoleChange?: (role: UserRole) => void;
  onOpenTraceability: () => void;
  onKeluar: () => void;
  aksesAktif?: AksesEfektif;
  onITNavigate?: (sub: ITSubTabId) => void;
  onSearchNavigate?: (target: SearchNavigationTarget) => void;
}

export default function Navbar({
  currentTab,
  setCurrentTab,
  currentRole,
  sesi,
  onRoleChange,
  onOpenTraceability,
  onKeluar,
  aksesAktif,
  onITNavigate,
  onSearchNavigate,
}: NavbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [restrictedSearchAlert, setRestrictedSearchAlert] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'mobile'
  );
  const [modalSandi, setModalSandi] = useState(false);
  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [pesanSandi, setPesanSandi] = useState<{ ok: boolean; teks: string } | null>(null);
  const [simpanSandi, setSimpanSandi] = useState(false);

  const kirimGantiSandi = async (e: FormEvent) => {
    e.preventDefault();
    if (simpanSandi) return;
    setSimpanSandi(true);
    const res = await gantiKataSandiServer(sandiLama, sandiBaru);
    setSimpanSandi(false);
    setPesanSandi({ ok: res.ok, teks: res.pesan });
    if (res.ok) {
      setSandiLama('');
      setSandiBaru('');
      setTimeout(() => {
        setModalSandi(false);
        setPesanSandi(null);
      }, 1200);
    }
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connStatus, setConnStatus] = useState(db.getConnectionStatus());

  useEffect(() => {
    const unsub = db.subscribe('connection_status', () => {
      setConnStatus(db.getConnectionStatus());
    });
    return unsub;
  }, []);

  const go = (id: NavId) => {
    setCurrentTab(id);
    setDrawerOpen(false);
    setShowUserMenu(false);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  };

  /* Tutup drawer/dropdown saat Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDrawerOpen(false);
      setShowUserMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Lock body scroll when mobile drawer open */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const aksesEfektif: AksesEfektif = useMemo(
    () =>
      aksesAktif ?? {
        aksesPenuh: true,
        modulDiizinkan: [...SEMUA_ID_MODUL],
        sumber: 'akses-penuh'
      },
    [aksesAktif]
  );

  const activeTabDef = ALL_TABS.find((t) => t.id === currentTab);
  const activeDivision = DIVISION_ORDER.find((id) => id === currentTab);
  const activeTabLabel = activeTabDef?.label || (activeDivision && DIVISION_LABELS[activeDivision]) || 'Ikhtisar';

  const bottomTabs = useMemo(
    () =>
      BOTTOM_PRIORITY.filter((id) => bolehAksesModul(id, aksesEfektif))
        .map((id) => ALL_TABS.find((t) => t.id === id)!)
        .filter(Boolean),
    [aksesEfektif]
  );

  const subMenuMap = useMemo(() => {
    const map = {} as Record<DivisionId, TabDef[]>;
    DIVISION_ORDER.forEach((id) => {
      map[id] = ALL_TABS.filter((t) => t.group === id && bolehAksesModul(t.id, aksesEfektif));
    });
    return map;
  }, [aksesEfektif]);

  return (
    <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.06)] print:shadow-none">
      
      {/* ================= BARIS ATAS (IDENTITAS & STATUS BEJO STYLE) ================= */}
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 h-14 flex items-center gap-2 sm:gap-3">
        
        {/* Tombol menu (mobile) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu aplikasi"
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 bg-white active:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand App Identity */}
        <button
          type="button"
          onClick={() => go('overview')}
          className="flex items-center gap-2.5 min-w-0 shrink sm:shrink text-left"
          title="AMS Integrated System"
        >
          <LogoAplikasi ukuran="md" />
          <div className="min-w-0 text-left">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight truncate whitespace-nowrap">
              AMS Integrated System
            </h1>
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate whitespace-nowrap hidden sm:block">
              Perusahaan Alat Kesehatan • CDAKB & ISO 13485
            </p>
            {/* Judul tab aktif pada mobile */}
            <p className="text-2xs font-semibold text-blue-600 truncate whitespace-nowrap sm:hidden">
              {activeTabLabel}
            </p>
          </div>
        </button>

        <div className="flex-1" />

        {/* Status Sinkronisasi Server Real-Time */}
        {(() => {
          const pendingCount = connStatus.pendingCount ?? 0;
          const syncState = connStatus.syncState ?? 'idle';
          const aktifRealtime = connStatus.isRealtimeSyncConnected || connStatus.isPocketBaseConnected;
          const aktifServer = aktifRealtime || connStatus.isServerSyncActive;

          let toneClass = 'bg-amber-50 text-amber-900 border-amber-300';
          let iconClass = 'text-amber-600';
          let label = 'Mode Cache Lokal';

          if (syncState === 'offline') {
            toneClass = 'bg-amber-50 text-amber-900 border-amber-300';
            iconClass = 'text-amber-600';
            label = pendingCount > 0 ? `Offline (${pendingCount} Antre)` : 'Offline (Lokal)';
          } else if (syncState === 'error') {
            toneClass = 'bg-rose-50 text-rose-900 border-rose-300';
            iconClass = 'text-rose-600';
            label = pendingCount > 0 ? `Gagal Sync (${pendingCount})` : 'Gagal Sync Server';
          } else if (syncState === 'syncing') {
            toneClass = 'bg-blue-50 text-blue-900 border-blue-300';
            iconClass = 'text-blue-600 animate-pulse';
            label = 'Menyinkronkan...';
          } else if (pendingCount > 0) {
            toneClass = 'bg-amber-50 text-amber-900 border-amber-300';
            iconClass = 'text-amber-600';
            label = `${pendingCount} Antre Sync`;
          } else if (aktifRealtime) {
            toneClass = 'bg-emerald-50 text-emerald-900 border-emerald-200';
            iconClass = 'text-emerald-600';
            label = 'Server Sync Realtime';
          } else if (aktifServer) {
            toneClass = 'bg-slate-100 text-slate-800 border-slate-300';
            iconClass = 'text-blue-600';
            label = 'Server Sync Aktif';
          }

          return (
            <button
              type="button"
              onClick={() => void db.syncNow()}
              title={`${connStatus.statusLabel} (klik untuk sinkronisasi manual sekarang)`}
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${toneClass}`}
            >
              <CloudCheck className={`w-3.5 h-3.5 ${iconClass}`} />
              <span className="text-xs">{label}</span>
            </button>
          );
        })()}

        {/* Tombol Pencarian Mobile */}
        <button
          type="button"
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-label="Cari data di seluruh modul"
          title="Cari data berdasarkan keyword"
          className={`lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
            mobileSearchOpen
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 active:bg-slate-100'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Tombol Preview Aplikasi Mobile */}
        <button
          type="button"
          onClick={() => setShowMobilePreview(true)}
          title="Tampilkan Preview Aplikasi Mobile (Android/iOS) di Browser"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition cursor-pointer shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 text-teal-700" />
          <span className="hidden sm:inline">Preview Mobile</span>
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* Profil Pengguna Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Menu pengguna"
            className="flex items-center gap-2 p-1 pl-1.5 pr-1.5 sm:pl-2 sm:pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RoleAvatar peran={currentRole} />
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[160px]">
                {sesi?.namaLengkap || namaPengguna(currentRole).split('-')[0].trim()}
              </div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 truncate max-w-[160px]">
                {sesi?.namaPeran || currentRole.replace('_', ' ')}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100">
                <div className="px-3.5 py-2.5 space-y-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {sesi?.namaLengkap || namaPengguna(currentRole)}
                  </div>
                  {sesi && (
                    <div className="text-2xs text-slate-500 truncate">
                      @{sesi.namaPengguna} · {sesi.departemen}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-2xs bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded inline-block border border-slate-200">
                      {sesi?.namaPeran || peranPengguna(currentRole)}
                    </span>
                    <span className="text-2xs text-slate-500">
                      {aksesEfektif.aksesPenuh ? 'Akses Penuh' : `${aksesEfektif.modulDiizinkan.length} modul`}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    RBAC Server Terverifikasi
                  </div>
                </div>

                <div className="py-1.5 px-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowMobilePreview(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Preview Frame HP (HRIS &amp; CRM)
                  </button>
                  <a
                    href="/mobile"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                    Buka Fullscreen (/mobile)
                  </a>
                  {sesi && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setModalSandi(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      Ganti Kata Sandi
                    </button>
                  )}
                  {sesi && punyaIzin(sesi, 'rbac-admin', 'view') && (
                    <button
                      type="button"
                      onClick={() => {
                        onITNavigate?.('user-roles');
                        go('it-traceability');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      Kelola Akun &amp; Peran (RBAC)
                    </button>
                  )}
                </div>

                <div className="py-1.5 px-1.5">
                  <button
                    type="button"
                    onClick={onKeluar}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>

                <div className="border-t border-slate-100 px-3.5 py-2 text-2xs font-semibold text-slate-400">
                  Sistem Standar CDAKB & ISO 13485:2016
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {/* ================= NAVIGASI UTAMA DESKTOP ================= */}
      <nav className="hidden lg:flex w-full max-w-[1440px] mx-auto px-3 sm:px-5 pb-2 -mt-0.5 items-center justify-between gap-3">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
          {MAIN_MENU.map((entry) => {
            if (entry.kind === 'tab') {
              if (!bolehAksesModul(entry.id, aksesEfektif)) return null;
              const tab = ALL_TABS.find((t) => t.id === entry.id)!;
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => go(tab.id)}
                  title={tab.label}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive ? `${TONE_ACTIVE} shadow-xs` : `text-slate-600 ${TONE_HOVER}`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : TONE_ICON}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-3xs px-1.5 py-0.5 rounded-full font-mono font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            }

            const items = subMenuMap[entry.id];
            if (items.length === 0) return null;
            const Icon = items[0].icon;
            const isActive = currentTab === entry.id || items.some((tab) => tab.id === currentTab);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => go(entry.id)}
                aria-current={currentTab === entry.id ? 'page' : undefined}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive ? `${TONE_ACTIVE} shadow-xs` : `text-slate-600 ${TONE_HOVER}`
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : TONE_ICON}`} />
                <span>{DIVISION_LABELS[entry.id]}</span>
              </button>
            );
          })}
        </div>

        <GlobalSearchBar
          aksesAktif={aksesEfektif}
          sesi={sesi}
          currentRole={currentRole}
          currentTab={currentTab}
          onNavigate={(target) => {
            if (onSearchNavigate) {
              onSearchNavigate(target);
            } else {
              go(target.moduleId);
            }
          }}
          onRestrictedNotification={setRestrictedSearchAlert}
          className="w-60 xl:w-72 shrink-0"
        />
      </nav>

      {/* Bar Pencarian Mobile (muncul di semua halaman modul pada viewport < lg) */}
      {mobileSearchOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-slate-50/70 px-3 py-2">
          <GlobalSearchBar
            aksesAktif={aksesEfektif}
            sesi={sesi}
            currentRole={currentRole}
            currentTab={currentTab}
            autoFocus
            onNavigate={(target) => {
              setMobileSearchOpen(false);
              if (onSearchNavigate) {
                onSearchNavigate(target);
              } else {
                go(target.moduleId);
              }
            }}
            onRestrictedNotification={setRestrictedSearchAlert}
          />
        </div>
      )}

      {/* Notifikasi Pembatasan Akses Pencarian Berbasis Role */}
      {restrictedSearchAlert && (
        <div role="alert" className="bg-rose-50 border-t border-rose-200 px-3 sm:px-5 py-2">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-rose-900">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{restrictedSearchAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setRestrictedSearchAlert(null)}
              aria-label="Tutup notifikasi pencarian"
              className="p-1 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ================= DRAWER SLIDE-OVER (MOBILE BEJO STYLE) ================= */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 flex h-full w-[86%] max-w-[330px] flex-col bg-white shadow-2xl">
            
            {/* Header Drawer */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <LogoAplikasi ukuran="sm" />
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 leading-tight truncate">
                    AMS Integrated System
                  </p>
                  <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                    CDAKB & ISO 13485
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 active:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Isi Drawer: menu utama sesuai urutan MAIN_MENU */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
              {MAIN_MENU.map((entry) => {
                if (entry.kind === 'tab') {
                  if (!bolehAksesModul(entry.id, aksesEfektif)) return null;
                  const tab = ALL_TABS.find((t) => t.id === entry.id)!;
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => go(tab.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isActive ? TONE_ACTIVE : 'text-slate-700 active:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : TONE_ICON}`} />
                      <span className="flex-1 text-base font-semibold truncate">{tab.label}</span>
                      {tab.badge && (
                        <span
                          className={`shrink-0 text-3xs px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                }

                const items = subMenuMap[entry.id];
                if (items.length === 0) return null;
                const Icon = items[0].icon;
                const isActive = currentTab === entry.id || items.some((tab) => tab.id === currentTab);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => go(entry.id)}
                    aria-current={currentTab === entry.id ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive ? TONE_ACTIVE : 'text-slate-700 active:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : TONE_ICON}`} />
                    <span className="flex-1 text-base font-semibold truncate">{DIVISION_LABELS[entry.id]}</span>
                    <span className={`shrink-0 text-2xs ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                      {items.length} modul
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer Drawer */}
            <div className="border-t border-slate-200 p-3 space-y-2">
              <a
                href="/mobile"
                onClick={() => setDrawerOpen(false)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-teal-800 bg-teal-50 border border-teal-200 active:bg-teal-100 text-xs font-semibold"
              >
                <Smartphone className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Aplikasi Mobile (HRIS &amp; CRM)</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onOpenTraceability();
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-slate-700 bg-slate-50 border border-slate-200 active:bg-slate-100 text-xs font-semibold"
              >
                <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Ketelusuran Nomor Batch</span>
              </button>
              <p className="text-center text-2xs font-semibold text-slate-400">
                AMS Integrated System v2.4.0
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ================= BOTTOM BAR (MOBILE BEJO STYLE) ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-2px_12px_rgba(15,23,42,0.06)] flex items-stretch px-1 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))]">
        {bottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              className={`flex-1 min-w-0 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600' : ''}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-2xs truncate max-w-full">{tab.short}</span>
            </button>
          );
        })}
        {/* Tombol Menu Lainnya */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 min-w-0 py-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-slate-500 cursor-pointer"
        >
          <div className="p-1 rounded-lg">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <span className="text-2xs font-semibold truncate">Lainnya</span>
        </button>
      </nav>

      {modalSandi && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Ganti Kata Sandi Akun</h3>
              <button
                type="button"
                onClick={() => {
                  setModalSandi(false);
                  setPesanSandi(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={kirimGantiSandi} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  value={sandiLama}
                  onChange={(e) => setSandiLama(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kata Sandi Baru (min. 6 karakter)</label>
                <input
                  type="password"
                  value={sandiBaru}
                  onChange={(e) => setSandiBaru(e.target.value)}
                  minLength={6}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              {pesanSandi && (
                <p className={`text-xs rounded-xl px-3 py-2 border ${pesanSandi.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  {pesanSandi.teks}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalSandi(false);
                    setPesanSandi(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={simpanSandi}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {simpanSandi ? 'Menyimpan…' : 'Simpan Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showMobilePreview && (
        <Suspense fallback={null}>
          <MobilePreviewModal
            isOpen={showMobilePreview}
            onClose={() => setShowMobilePreview(false)}
          />
        </Suspense>
      )}
    </header>
  );
}
