/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * coded by Langgo Bramandityo
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Navbar, { ALL_TABS, DIVISION_ORDER, type NavId } from './components/layout/Navbar';
import DivisionWorkspace from './components/layout/DivisionWorkspace';
import { terapkanFaviconAplikasi, useIdentitasVisualAplikasi } from './components/common/LogoAplikasi';
import InitialLoadingScreen from './components/common/InitialLoadingScreen';
import ErrorBoundary from './components/common/ErrorBoundary';
import SyncAccessHold, { useSyncHoldReason } from './components/common/SyncAccessHold';
import type { SalesTab } from './components/modules/commercial/SalesModule';
import type { ITSubTabId } from './components/modules/supporting/ITModule';
import type { GudangTabId } from './components/modules/operations/gudang/ui';

import type { AksesEfektif, DivisionId, ModuleNavId, PelangganB2B, RbacResourceId, UserRole } from './types';
import { Lock, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  akhiriSesi,
  ambilSesiServer,
  bacaSesi,
  bolehAksesModul as bolehAksesModulSesi,
  EVENT_SESI_BERAKHIR,
  keluarDariServer,
  type SesiLogin
} from './utils/autentikasi';
import { SEMUA_ID_MODUL, bolehAksesModul } from './utils/hakAkses';
import { db } from './services/pocketbase';

const ExecutiveOverview = lazy(() => import('./components/dashboard/ExecutiveOverview'));
const TraceabilityModal = lazy(() => import('./components/traceability/TraceabilityModal'));
const PrintModal = lazy(() => import('./components/common/PrintModal'));
const HalamanDepan = lazy(() => import('./components/modules/website/site/HalamanDepan'));
const RegulatoryModule = lazy(() => import('./components/modules/regulatory/RegulatoryModule'));
const QAModule = lazy(() => import('./components/modules/regulatory/QAModule'));
const QCModule = lazy(() => import('./components/modules/regulatory/QCModule'));
const WarehouseModule = lazy(() => import('./components/modules/operations/WarehouseModule'));
const ServiceModule = lazy(() => import('./components/modules/operations/ServiceModule'));
const ProductionModule = lazy(() => import('./components/modules/operations/ProductionModule'));
const ProcurementModule = lazy(() => import('./components/modules/operations/ProcurementModule'));
const SalesModule = lazy(() => import('./components/modules/commercial/SalesModule'));
const PMSModule = lazy(() => import('./components/modules/commercial/PMSModule'));
const HRDModule = lazy(() => import('./components/modules/supporting/HRDModule'));
const FinanceModule = lazy(() => import('./components/modules/supporting/FinanceModule'));
const ITModule = lazy(() => import('./components/modules/supporting/ITModule'));
const DokumenInternalModule = lazy(() => import('./components/modules/supporting/DokumenInternalModule'));
const WebsiteModule = lazy(() => import('./components/modules/website/WebsiteModule'));
const ProductCatalogModule = lazy(() => import('./components/modules/commercial/ProductCatalogModule'));

function PemuatModul({ layarPenuh = false }: { layarPenuh?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 text-sm font-medium text-slate-500 ${
        layarPenuh ? 'min-h-screen bg-slate-50' : 'min-h-[40vh]'
      }`}
    >
      <RefreshCw className="h-4 w-4 animate-spin" />
      Memuat modul…
    </div>
  );
}

function modulUntukKunciSync(key: string): RbacResourceId | 'all' {
  if (key === 'all') return 'all';
  if (key.startsWith('website_')) return 'website';
  if (key === 'izin_edar' || key === 'sertifikat') return 'ra-pjt';
  if (key === 'dokumen_mutu' || key === 'capa' || key === 'produk_kembalian' || key === 'audit_internal_iso') {
    return 'qa-mutu';
  }
  if (key === 'inspeksi_qc') return 'qc-inspeksi';
  if (key === 'laporan_ktd' || key === 'penarikan_produk') return 'pms-vigilance';
  if (key === 'stok_gudang' || key === 'log_suhu' || key === 'pest_control' || key.startsWith('gudang_')) {
    return 'gudang-logistik';
  }
  if (key === 'layanan_teknis') return 'teknisi-service';
  if (key === 'bets_produksi') return 'produksi-cpakb';
  if (key === 'pemasok' || key === 'purchase_order') return 'purchasing-procurement';
  if (key === 'product_catalog') return 'product-catalog';
  if (
    key === 'penjualan' ||
    key.startsWith('sales_') ||
    key.startsWith('surat_') ||
    key.startsWith('listmonk_') ||
    key.startsWith('catalog_')
  ) {
    return 'sales-marketing';
  }
  if (key === 'pelatihan' || key === 'pelatihan_personil' || key === 'sertifikasi_pegawai' || key.startsWith('hris_')) {
    return 'hrd-pelatihan';
  }
  if (key === 'transaksi' || key === 'transaksi_keuangan' || key.startsWith('keuangan_')) {
    return 'finance-akuntansi';
  }
  if (key.startsWith('dokumen_internal') || key.startsWith('quotation_')) return 'dokumen-internal';
  if (key === 'sistem_data_manifest') return 'it-traceability';
  if (key === 'audit_trail') return 'audit-trail';
  return 'overview';
}

function isDivisionId(id: NavId): id is DivisionId {
  return DIVISION_ORDER.some((division) => division === id);
}

export default function App() {
  const [sesi, setSesi] = useState<SesiLogin | null>(() => bacaSesi());
  const [memeriksaSesi, setMemeriksaSesi] = useState<boolean>(() => Boolean(bacaSesi()));
  const [statusPemuatan, setStatusPemuatan] = useState('Menunggu inisialisasi koneksi...');
  const alasanTahan = useSyncHoldReason();
  const identitasVisual = useIdentitasVisualAplikasi();

  useEffect(() => {
    terapkanFaviconAplikasi(identitasVisual.faviconUrl || identitasVisual.logoUrl);
  }, [identitasVisual.faviconUrl, identitasVisual.logoUrl]);

  useEffect(() => {
    let aktif = true;
    const cekServer = async () => {
      if (!bacaSesi()) {
        if (aktif) setMemeriksaSesi(false);
        return;
      }
      setStatusPemuatan('Memverifikasi token sesi & hak akses pengguna (RBAC)...');
      const segar = await ambilSesiServer();
      if (segar) {
        db.prepareSessionSync(segar);
        setStatusPemuatan('Menyinkronkan state database real-time...');
        await db.syncFromServer(false);
      } else {
        setStatusPemuatan('Memuat pengaturan publik...');
        await db.hydratePublicSettingsFromServer();
      }
      if (aktif) {
        setSesi(segar && bacaSesi()?.token === segar.token ? segar : null);
        setMemeriksaSesi(false);
      }
    };
    void cekServer();

    const padaKedaluwarsa = () => {
      akhiriSesi();
      setSesi(null);
      setMemeriksaSesi(false);
    };
    window.addEventListener(EVENT_SESI_BERAKHIR, padaKedaluwarsa);
    return () => {
      aktif = false;
      window.removeEventListener(EVENT_SESI_BERAKHIR, padaKedaluwarsa);
    };
  }, []);

  useEffect(() => {
    db.connectRealtimeSync(sesi?.token || null);
  }, [sesi?.token]);

  useEffect(() => {
    if (!sesi?.token) return;
    const unsubRbac = db.subscribeRbacUpdated(() => {
      setMemeriksaSesi(true);
      void segarkanSesi().finally(() => setMemeriksaSesi(false));
    });
    return unsubRbac;
  }, [sesi?.token]);

  const segarkanSesi = async () => {
    const segar = await ambilSesiServer();
    if (segar) {
      db.prepareSessionSync(segar);
      await db.syncFromServer(false);
    }
    setSesi(segar && bacaSesi()?.token === segar.token ? segar : null);
  };

  const tanganiMasuk = async (sesiBaru: SesiLogin) => {
    setMemeriksaSesi(true);
    db.prepareSessionSync(sesiBaru);
    await db.syncFromServer(false);
    const sesiAktif = bacaSesi()?.token === sesiBaru.token ? sesiBaru : null;
    if (sesiAktif && !db.getSyncHoldReason() && !sesiAktif.isHiddenDeveloper) {
      db.logAudit(
        'Autentikasi & Akses',
        'Masuk berhasil (RBAC server terverifikasi)',
        sesiBaru.namaPengguna,
        sesiBaru.namaLengkap,
        sesiBaru.namaPeran,
        [{ kolom: 'sesi', nilaiLama: 'Keluar', nilaiBaru: `Masuk ${sesiBaru.masukPada}` }]
      );
    }
    db.connectRealtimeSync(sesiAktif?.token || null);
    setSesi(sesiAktif);
    setMemeriksaSesi(false);
  };

  const tanganiKeluar = () => {
    void keluarDariServer().then((hasil) => {
      setSesi(null);
      db.connectRealtimeSync(null);
      if (!hasil.ok && hasil.pesan) window.alert(hasil.pesan);
    });
  };

  if (memeriksaSesi) {
    return <InitialLoadingScreen message={statusPemuatan} />;
  }

  if (!sesi) {
    return (
      <Suspense fallback={<PemuatModul layarPenuh />}>
        <HalamanDepan onMasuk={(s) => void tanganiMasuk(s)} />
      </Suspense>
    );
  }

  if (alasanTahan) {
    return <SyncAccessHold reason={alasanTahan} onRetry={segarkanSesi} onLogout={tanganiKeluar} />;
  }

  return (
    <Dasbor
      key={`${sesi.userId}:${sesi.peran}:${sesi.employeeId || ''}:${JSON.stringify(sesi.permissions)}`}
      sesi={sesi}
      onSegarkanSesi={segarkanSesi}
      onKeluar={tanganiKeluar}
    />
  );
}

/** Isi dashboard; tab awal 'overview' adalah menu CDAKB & ISO. */
function Dasbor({
  sesi,
  onSegarkanSesi,
  onKeluar
}: {
  sesi: SesiLogin;
  onSegarkanSesi: () => Promise<void>;
  onKeluar: () => void;
}) {
  const currentRole: UserRole = sesi.peran;
  const aksesAktif: AksesEfektif = useMemo(() => {
    const diizinkan: ModuleNavId[] = SEMUA_ID_MODUL.filter((id) =>
      bolehAksesModulSesi(sesi, id)
    );
    return {
      aksesPenuh: diizinkan.length === SEMUA_ID_MODUL.length,
      modulDiizinkan: diizinkan,
      sumber: 'role'
    };
  }, [sesi]);

  const [activeTab, setActiveTab] = useState<NavId>(() => {
    if (bolehAksesModulSesi(sesi, 'overview')) return 'overview';
    return aksesAktif.modulDiizinkan[0] || 'overview';
  });
  const [itSubTab, setItSubTab] = useState<ITSubTabId>('traceability');
  const [salesSubTab, setSalesSubTab] = useState<SalesTab>('order');
  const [isTraceabilityOpen, setIsTraceabilityOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showComplianceBanner, setShowComplianceBanner] = useState(true);
  const [gudangTabAwal, setGudangTabAwal] = useState<GudangTabId | undefined>(undefined);
  const [quotationPelangganAwal, setQuotationPelangganAwal] = useState<PelangganB2B | null>(null);
  const [remoteModuleVersion, setRemoteModuleVersion] = useState(0);
  const [pendingRemoteSync, setPendingRemoteSync] = useState(false);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(() => {
    const st = db.getConnectionStatus();
    return st.syncState === 'error' ? st.lastSyncError : null;
  });

  useEffect(() => {
    const unsubConn = db.subscribe('connection_status', () => {
      const st = db.getConnectionStatus();
      setSyncErrorMsg(st.syncState === 'error' ? st.lastSyncError : null);
    });
    return unsubConn;
  }, []);

  useEffect(() => {
    setPendingRemoteSync(false);
  }, [activeTab]);

  useEffect(() => {
    const unsub = db.subscribeRemoteUpdate((keys, reason) => {
      if (reason === 'hydrate-public') return;
      // Modul yang sudah mengelola state sinkronisasinya sendiri tidak perlu remount penuh
      if (activeTab === 'website' || activeTab === 'it-traceability') return;

      const relevan = keys.some((k) => {
        if (k === 'all') return true;
        if (k === 'audit_trail') return activeTab === 'overview';
        const target = modulUntukKunciSync(k);
        return activeTab === 'overview' || target === activeTab || target === 'all';
      });
      if (!relevan) return;

      const elAktif = typeof document !== 'undefined' ? document.activeElement : null;
      const tag = elAktif?.tagName?.toUpperCase() || '';
      const sedangMengetik = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (sedangMengetik) {
        setPendingRemoteSync(true);
        return;
      }
      setRemoteModuleVersion((v) => v + 1);
      setPendingRemoteSync(false);
    });
    return unsub;
  }, [activeTab]);

  const activeDivision = isDivisionId(activeTab) ? activeTab : null;
  const bolehBukaTabAktif = isDivisionId(activeTab)
    ? ALL_TABS.some(
        (tab) =>
          tab.group === activeTab &&
          tab.id !== 'website' &&
          tab.id !== 'overview' &&
          bolehAksesModul(tab.id, aksesAktif)
      )
    : bolehAksesModul(activeTab, aksesAktif);
  const namaPelakuAktif = sesi.namaLengkap || sesi.namaPengguna;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-[#00AAFF] selection:text-white">
      
      {/* Top Banner (Diselaraskan dengan gaya banner notifikasi bejo-pos) */}
      {showComplianceBanner && (
        <div className="bg-slate-900 text-slate-200 px-3 sm:px-5 py-1.5 text-xs border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 max-w-[1440px] mx-auto flex-1 justify-center text-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0 hidden sm:inline-block" />
            <span className="text-xs text-slate-300">
              <strong className="text-white">Standar Resmi Kementerian Kesehatan RI:</strong> Kepatuhan Izin Edar Alkes (NIE), Sertifikat Distribusi (SDAK), CDAKB Permenkes 4/2014 & ISO 13485:2016.
            </span>
          </div>
          <button 
            type="button"
            onClick={() => setShowComplianceBanner(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Navbar (2-Baris Desktop, Drawer & Bottom Bar Mobile sesuai bejo-pos) */}
      <Navbar
        currentTab={activeTab}
        setCurrentTab={setActiveTab}
        currentRole={currentRole}
        sesi={sesi}
        onOpenTraceability={() => setIsTraceabilityOpen(true)}
        onKeluar={onKeluar}
        aksesAktif={aksesAktif}
        onITNavigate={(sub) => {
          setItSubTab(sub);
          setActiveTab('it-traceability');
        }}
        onSearchNavigate={(target) => {
          if (target.salesSubTab) setSalesSubTab(target.salesSubTab);
          if (target.itSubTab) setItSubTab(target.itSubTab);
          if (target.gudangTab) setGudangTabAwal(target.gudangTab);
          setActiveTab(target.moduleId);
        }}
      />

      {syncErrorMsg && (
        <div role="alert" className="no-print bg-rose-50 border-b border-rose-200 px-3 sm:px-5 py-2">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-rose-900 font-medium">
              Sinkronisasi server ditolak/gagal ({syncErrorMsg}). Periksa koneksi dan coba sinkronkan ulang.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void db.syncNow();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sinkronkan Ulang
              </button>
              <button
                type="button"
                onClick={() => db.clearLastSyncError()}
                className="text-rose-700 hover:text-rose-900 p-1 rounded-lg cursor-pointer"
                title="Tutup peringatan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRemoteSync && (
        <div className="no-print bg-blue-50 border-b border-blue-200 px-3 sm:px-5 py-2">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
            <span className="text-xs text-blue-900 font-medium">
              Ada pembaruan data real-time dari pengguna lain pada modul ini.
            </span>
            <button
              type="button"
              onClick={() => {
                setRemoteModuleVersion((v) => v + 1);
                setPendingRemoteSync(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Muat Data Terbaru
            </button>
          </div>
        </div>
      )}

      {/* Main Application Content Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 py-4 sm:py-6 pb-24 lg:pb-8">
        {!bolehBukaTabAktif ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Akses Modul Dibatasi</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Akun <strong>{namaPelakuAktif}</strong> tidak memiliki izin untuk membuka modul ini sesuai konfigurasi User Account &amp; Roles. Hubungi user dengan Akses Penuh untuk memperbarui daftar modul yang dicentang.
            </p>
            {aksesAktif.modulDiizinkan.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab(aksesAktif.modulDiizinkan[0])}
                className="mt-5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Kembali ke Modul yang Diizinkan
              </button>
            )}
          </div>
        ) : (
          <ErrorBoundary resetKey={`${activeTab}-${remoteModuleVersion}`} label="modul ini">
          <Suspense fallback={<PemuatModul />}>
          <div key={`${activeTab}-${remoteModuleVersion}`}>
            {activeDivision && (
              <DivisionWorkspace
                division={activeDivision}
                aksesAktif={aksesAktif}
                onSelectModule={setActiveTab}
              />
            )}

            {activeTab === 'overview' && (
              <ExecutiveOverview
                onSelectModule={(mod) => setActiveTab(mod)}
                onOpenTraceability={() => setIsTraceabilityOpen(true)}
                onOpenPrintModal={() => setIsPrintModalOpen(true)}
                aksesAktif={aksesAktif}
              />
            )}

            {/* Website */}
            {activeTab === 'website' && <WebsiteModule currentRole={currentRole} sesi={sesi} />}

            {/* Regulatory Affairs */}
            {activeTab === 'ra-pjt' && <RegulatoryModule />}
            {activeTab === 'qa-mutu' && <QAModule />}
            {activeTab === 'qc-inspeksi' && <QCModule />}

            {/* Operations & Technical */}
            {activeTab === 'gudang-logistik' && (
              <WarehouseModule
                currentRole={currentRole}
                initialTab={gudangTabAwal}
                onOpenPrintModal={() => setIsPrintModalOpen(true)}
                onNavigateModule={(mod) => setActiveTab(mod)}
              />
            )}
            {activeTab === 'teknisi-service' && <ServiceModule />}
            {activeTab === 'produksi-cpakb' && <ProductionModule />}
            {activeTab === 'purchasing-procurement' && <ProcurementModule />}

            {/* Sales & Marketing */}
            {activeTab === 'product-catalog' && <ProductCatalogModule currentRole={currentRole} sesi={sesi} />}
            {activeTab === 'sales-marketing' && (
              <SalesModule
                currentRole={currentRole}
                initialTab={salesSubTab}
                onTabChange={setSalesSubTab}
                onBuatQuotationUntukPelanggan={(pel) => {
                  setQuotationPelangganAwal(pel);
                  setActiveTab('dokumen-internal');
                }}
              />
            )}
            {activeTab === 'pms-vigilance' && (
              <PMSModule
                onBukaRecallGudang={() => {
                  setGudangTabAwal('recall');
                  setActiveTab('gudang-logistik');
                }}
              />
            )}

            {/* Supporting System */}
            {activeTab === 'hrd-pelatihan' && <HRDModule />}
            {activeTab === 'dokumen-internal' && (
              <DokumenInternalModule
                currentRole={currentRole}
                sesi={sesi}
                pelangganQuotationAwal={quotationPelangganAwal}
                onKonsumsiPelangganQuotation={() => setQuotationPelangganAwal(null)}
              />
            )}
            {activeTab === 'finance-akuntansi' && <FinanceModule currentRole={currentRole} />}
            {activeTab === 'it-traceability' && (
              <ITModule
                currentRole={currentRole}
                currentUserName={namaPelakuAktif}
                activeTab={itSubTab}
                onTabChange={setItSubTab}
                sesi={sesi}
                onPermissionsUpdated={onSegarkanSesi}
              />
            )}
          </div>
          </Suspense>
          </ErrorBoundary>
        )}
      </main>

      {/* Elegant Footer Watermark */}
      <footer className="no-print mt-auto py-4 px-4 border-t border-slate-200 bg-white/80 backdrop-blur text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>© 2026 PT Anugrahmitra Selaras (AMS) • Sistem Terintegrasi CDAKB & ISO 13485</span>
          </div>
          <div className="font-semibold text-slate-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
            coded by Langgo Bramandityo
          </div>
        </div>
      </footer>

      {/* Universal Batch / Lot Traceability Dialog Modal */}
      {isTraceabilityOpen && (
        <Suspense fallback={null}>
          <TraceabilityModal isOpen onClose={() => setIsTraceabilityOpen(false)} />
        </Suspense>
      )}

      {/* Official Regulatory Printable Document Modal */}
      {isPrintModalOpen && (
        <Suspense fallback={null}>
          <PrintModal isOpen onClose={() => setIsPrintModalOpen(false)} />
        </Suspense>
      )}

    </div>
  );
}
