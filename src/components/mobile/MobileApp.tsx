import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  Crosshair,
  Home,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UserCheck,
  UserCircle2
} from 'lucide-react';
import { db } from '../../services/pocketbase';
import {
  akhiriSesi,
  ambilSesiServer,
  bacaSesi,
  EVENT_SESI_BERAKHIR,
  keluarDariServer,
  type SesiLogin
} from '../../utils/autentikasi';
import LogoAplikasi, {
  terapkanFaviconAplikasi,
  useIdentitasVisualAplikasi
} from '../common/LogoAplikasi';
import KartuMasuk from '../modules/website/site/KartuMasuk';
import ErrorBoundary from '../common/ErrorBoundary';
import SyncAccessHold, { useSyncHoldReason } from '../common/SyncAccessHold';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { MobileAbsensiView } from './MobileAbsensiView';
import { MobileCrmView, type CrmSubTab } from './MobileCrmView';
import { MobileHomeView, type MobileNavTarget } from './MobileHomeView';
import { MobileProfilView } from './MobileProfilView';
import { MobileSalesView, type SalesSubTab } from './MobileSalesView';
import { MobileShiftCutiView } from './MobileShiftCutiView';
import { MobileSlipGajiView } from './MobileSlipGajiView';
import { findKaryawanForSession, getMobileCapabilities } from './mobileHelpers';

type MobileTabId =
  | 'beranda'
  | 'absensi'
  | 'shift-cuti'
  | 'slip-gaji'
  | 'hris'
  | 'crm'
  | 'penjualan'
  | 'profil';

const KOLEKSI_MOBILE_SINKRON = [
  'hris_karyawan',
  'hris_shift',
  'hris_absensi',
  'hris_cuti',
  'hris_slip_gaji',
  'sales_pelanggan',
  'sales_prospek',
  'sales_website_rfq',
  'sales_kunjungan',
  'sales_pra_order',
  'penjualan',
  'sales_tender',
  'sales_pengetahuan_produk',
  'stok_gudang',
  'izin_edar',
  'sales_skema_harga',
  'connection_status'
] as const;

export default function MobileApp() {
  const [sesi, setSesi] = useState<SesiLogin | null>(() => bacaSesi());
  const [memeriksaSesi, setMemeriksaSesi] = useState<boolean>(() => Boolean(bacaSesi()));
  const [tabAktif, setTabAktif] = useState<MobileTabId>('beranda');
  const [hrisSubTab, setHrisSubTab] = useState<'absensi' | 'shift-cuti' | 'slip-gaji'>('absensi');
  const [crmSubTab, setCrmSubTab] = useState<CrmSubTab>('prospek');
  const [salesSubTab, setSalesSubTab] = useState<SalesSubTab>('order');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [syncingPb, setSyncingPb] = useState(false);
  const [lastPbResult, setLastPbResult] = useState<string | null>(null);
  const alasanTahan = useSyncHoldReason();

  const identitasVisual = useIdentitasVisualAplikasi();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [tabAktif, hrisSubTab, crmSubTab, salesSubTab]);

  useEffect(() => {
    terapkanFaviconAplikasi(identitasVisual.faviconUrl || identitasVisual.logoUrl);
  }, [identitasVisual.faviconUrl, identitasVisual.logoUrl]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const sinkronkanPocketBase = useCallback(async () => {
    setSyncingPb(true);
    try {
      await db.syncFromServer(true);
      if (db.getSyncHoldReason()) return;
      const pbRes = await db.syncFromPocketBaseAMS();
      const jam = new Date(pbRes.syncedAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
      setLastPbResult(
        pbRes.pocketbaseOnline
          ? `PocketBase AMS tersinkron (${pbRes.updatedCollections.length} koleksi diperbarui, ${jam})`
          : `Server Real-Time Sync aktif (${jam}) · PocketBase AMS port 8091 standby`
      );
      refresh();
    } finally {
      setSyncingPb(false);
    }
  }, [refresh]);

  useEffect(() => {
    let aktif = true;
    const cekServer = async () => {
      if (!bacaSesi()) {
        await db.hydratePublicSettingsFromServer();
        if (aktif) setMemeriksaSesi(false);
        return;
      }
      const segar = await ambilSesiServer();
      if (segar) {
        db.prepareSessionSync(segar);
        await db.syncFromServer(false);
        if (bacaSesi()?.token === segar.token && !db.getSyncHoldReason()) void db.syncFromPocketBaseAMS();
      } else {
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
    const unsubKoleksi = db.subscribeKoleksi(KOLEKSI_MOBILE_SINKRON, refresh);
    return () => {
      unsubRbac();
      unsubKoleksi();
    };
  }, [sesi?.token, refresh]);

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
        'Masuk berhasil ke AMS Mobile (RBAC server terverifikasi)',
        sesiBaru.namaPengguna,
        sesiBaru.namaLengkap,
        sesiBaru.namaPeran,
        [{ kolom: 'sesi', nilaiLama: 'Keluar', nilaiBaru: `Masuk ${sesiBaru.masukPada}` }]
      );
    }
    if (sesiAktif && !db.getSyncHoldReason()) void db.syncFromPocketBaseAMS();
    db.connectRealtimeSync(sesiAktif?.token || null);
    setSesi(sesiAktif);
    setTabAktif('beranda');
    setMemeriksaSesi(false);
  };

  const tanganiKeluar = async () => {
    const hasil = await keluarDariServer();
    db.connectRealtimeSync(null);
    setSesi(null);
    if (!hasil.ok && hasil.pesan) window.alert(hasil.pesan);
  };

  const capabilities = useMemo(() => getMobileCapabilities(sesi), [sesi]);

  // Baca data live dari store
  void tick;
  const bolehBacaCache = Boolean(sesi && !memeriksaSesi && !alasanTahan);
  const karyawanList = bolehBacaCache ? db.getKaryawanHRIS() : [];
  const absensiList = bolehBacaCache ? db.getAbsensi() : [];
  const shiftList = bolehBacaCache ? db.getJadwalShift() : [];
  const cutiList = bolehBacaCache ? db.getCuti() : [];
  const slipList = bolehBacaCache ? db.getSlipGaji() : [];
  const pelangganList = bolehBacaCache ? db.getPelangganB2B() : [];
  const prospekList = bolehBacaCache ? db.getProspek() : [];
  const kunjunganList = bolehBacaCache ? db.getKunjunganMedRep() : [];
  const praOrderList = bolehBacaCache ? db.getPraOrder() : [];
  const penjualanList = bolehBacaCache ? db.getPenjualan() : [];
  const tenderList = bolehBacaCache ? db.getTender() : [];
  const produkList = bolehBacaCache ? db.getPengetahuanProduk() : [];
  const izinEdarList = bolehBacaCache ? db.getIzinEdar() : [];
  const stokList = bolehBacaCache ? db.getStokGudang() : [];
  const skemaHargaList = bolehBacaCache ? db.getSkemaHarga() : [];
  const conn = db.getConnectionStatus();

  const karyawanAktif = useMemo(
    () => findKaryawanForSession(karyawanList, sesi, selectedEmployeeId),
    [karyawanList, sesi, selectedEmployeeId]
  );

  const tanganiNavigasi = (target: MobileNavTarget) => {
    if (target.tab === 'hris') {
      if (target.sub) setHrisSubTab(target.sub);
      setTabAktif('hris');
      return;
    }
    if (target.tab === 'crm') {
      if (target.sub) setCrmSubTab(target.sub);
      setTabAktif('crm');
      return;
    }
    if (target.tab === 'penjualan') {
      if (target.sub) setSalesSubTab(target.sub);
      setTabAktif('penjualan');
      return;
    }
    setTabAktif(target.tab);
  };

  const daftarTabBawah: {
    id: MobileTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = capabilities.isSales
    ? [
        { id: 'beranda', label: 'Beranda', icon: Home },
        { id: 'hris', label: 'HRIS', icon: UserCheck },
        { id: 'crm', label: 'CRM', icon: BriefcaseBusiness },
        { id: 'penjualan', label: 'Penjualan', icon: ShoppingBag },
        { id: 'profil', label: 'Profil', icon: UserCircle2 }
      ]
    : [
        { id: 'beranda', label: 'Beranda', icon: Home },
        { id: 'absensi', label: 'Absensi', icon: Crosshair },
        { id: 'shift-cuti', label: 'Shift/Cuti', icon: CalendarClock },
        ...(capabilities.canViewAllEmployees
          ? [{ id: 'slip-gaji' as const, label: 'Slip Gaji', icon: ReceiptText }]
          : []),
        { id: 'profil', label: 'Profil', icon: UserCircle2 }
      ];

  const namaPemakai = karyawanAktif?.nama || sesi?.namaLengkap || 'Pengguna AMS';
  const judulHalaman: Record<MobileTabId, string> = {
    beranda: 'AMS Mobile',
    absensi: 'Absensi & Lokasi',
    'shift-cuti': 'Cuti & Jadwal Kerja',
    'slip-gaji': 'Slip Gaji',
    hris: 'Layanan HRIS',
    crm: 'CRM & Kunjungan',
    penjualan: 'Penjualan',
    profil: 'Profil Saya'
  };

  if (memeriksaSesi) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Menyelaraskan sesi AMS Mobile…
        </p>
      </div>
    );
  }

  if (!sesi) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8">
        <div className="mx-auto w-full max-w-md my-auto space-y-4">
          <div className="text-center space-y-1">
            <p className="text-2xs font-bold uppercase tracking-widest text-teal-700">
              AMS Mobile App · HRIS &amp; CRM
            </p>
            <h1 className="text-lg font-bold text-slate-900">
              PT Anugrahmitra Selaras
            </h1>
          </div>
          <KartuMasuk
            logoUrl={identitasVisual.logoUrl}
            onTerima={(s) => void tanganiMasuk(s)}
            onBatal={() => {
              window.location.href = '/web/';
            }}
          />
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <a href="/web/" className="hover:text-teal-700 font-medium underline-offset-2 hover:underline">
              Lihat Situs Perusahaan
            </a>
            <span>·</span>
            <a href="/" className="hover:text-teal-700 font-medium underline-offset-2 hover:underline">
              Dashboard Web Desktop
            </a>
          </div>
        </div>
        <OfflineIndicator />
      </div>
    );
  }

  if (alasanTahan) {
    return <SyncAccessHold reason={alasanTahan} onRetry={segarkanSesi} onLogout={() => void tanganiKeluar()} />;
  }

  return (
    <div className="ams-mobile min-h-screen bg-blue-50/60 text-slate-900">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-blue-700 bg-blue-800 text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {tabAktif === 'beranda' ? <LogoAplikasi ukuran="sm" /> : (
              <button type="button" onClick={() => setTabAktif('beranda')}
                aria-label="Kembali ke beranda"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-none truncate">
                {judulHalaman[tabAktif]}
              </h1>
              <p className="text-2xs text-blue-100 truncate mt-1">
                {capabilities.isSales ? 'HRIS · CRM · Sales' : 'HRIS Karyawan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => void sinkronkanPocketBase()}
              disabled={syncingPb}
              aria-label="Sinkronkan PocketBase AMS"
              title="Sinkronkan PocketBase AMS & Server Real-Time"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-60 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncingPb ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
        {conn.lastSyncError && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900">
            Sinkronisasi belum berhasil: {conn.lastSyncError}. Perubahan tetap tertunda; periksa data atau hubungi administrator.
          </div>
        )}
        {!capabilities.canViewAllEmployees && !karyawanAktif && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            Akun belum ditautkan ke ID karyawan HRIS yang aktif. Hubungi admin untuk mengaitkan akun sebelum memakai fitur self-service.
          </div>
        )}
        <ErrorBoundary
          resetKey={`${tabAktif}-${hrisSubTab}-${crmSubTab}-${salesSubTab}`}
          label="halaman mobile"
        >
        {tabAktif === 'beranda' && (
          <MobileHomeView
            namaPengguna={sesi.namaLengkap}
            capabilities={capabilities}
            karyawan={karyawanAktif}
            absensiList={absensiList}
            shiftList={shiftList}
            cutiList={cutiList}
            slipList={slipList}
            prospekList={prospekList}
            kunjunganList={kunjunganList}
            praOrderList={praOrderList}
            tenderList={tenderList}
            statusKoneksiLabel={conn.statusLabel}
            pocketbaseOnline={conn.isPocketBaseServerReachable}
            onNavigate={tanganiNavigasi}
          />
        )}

        {tabAktif === 'absensi' && (
          <MobileAbsensiView
            karyawan={karyawanAktif}
            absensiList={absensiList}
            onRefresh={refresh}
          />
        )}

        {tabAktif === 'shift-cuti' && (
          <MobileShiftCutiView
            karyawan={karyawanAktif}
            shiftList={shiftList}
            cutiList={cutiList}
            canApproveLeave={capabilities.canApproveLeave}
            approverName={sesi.namaLengkap}
            onRefresh={refresh}
          />
        )}

        {tabAktif === 'slip-gaji' && capabilities.canViewAllEmployees && (
          <MobileSlipGajiView
            karyawan={karyawanAktif}
            slipList={slipList}
            canViewAllEmployees={capabilities.canViewAllEmployees}
          />
        )}

        {tabAktif === 'hris' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200/70 p-1">
              {(
                [
                  { id: 'absensi', label: 'Absensi GPS' },
                  { id: 'shift-cuti', label: 'Shift & Cuti' },
                  ...(capabilities.canViewAllEmployees
                    ? [{ id: 'slip-gaji' as const, label: 'Slip Gaji' }]
                    : [])
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setHrisSubTab(sub.id)}
                  className={`min-h-[44px] rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
                    hrisSubTab === sub.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {hrisSubTab === 'absensi' && (
              <MobileAbsensiView
                karyawan={karyawanAktif}
                absensiList={absensiList}
                onRefresh={refresh}
              />
            )}
            {hrisSubTab === 'shift-cuti' && (
              <MobileShiftCutiView
                karyawan={karyawanAktif}
                shiftList={shiftList}
                cutiList={cutiList}
                canApproveLeave={capabilities.canApproveLeave}
                approverName={sesi.namaLengkap}
                onRefresh={refresh}
              />
            )}
            {hrisSubTab === 'slip-gaji' && capabilities.canViewAllEmployees && (
              <MobileSlipGajiView
                karyawan={karyawanAktif}
                slipList={slipList}
                canViewAllEmployees={capabilities.canViewAllEmployees}
              />
            )}
          </div>
        )}

        {tabAktif === 'crm' && capabilities.isSales && (
          <MobileCrmView
            key={crmSubTab}
            salesName={namaPemakai}
            pelangganList={pelangganList}
            prospekList={prospekList}
            kunjunganList={kunjunganList}
            initialSubTab={crmSubTab}
            onRefresh={refresh}
          />
        )}

        {tabAktif === 'penjualan' && capabilities.isSales && (
          <MobileSalesView
            key={salesSubTab}
            salesName={namaPemakai}
            canManageOrders={capabilities.canManageOrders}
            pelangganList={pelangganList}
            praOrderList={praOrderList}
            penjualanList={penjualanList}
            tenderList={tenderList}
            produkList={produkList}
            izinEdarList={izinEdarList}
            stokList={stokList}
            skemaHargaList={skemaHargaList}
            initialSubTab={salesSubTab}
            onRefresh={refresh}
          />
        )}

        {tabAktif === 'profil' && (
          <MobileProfilView
            sesi={sesi}
            karyawan={karyawanAktif}
            allKaryawan={karyawanList}
            canSwitchProfile={capabilities.canViewAllEmployees}
            canViewSensitiveHris={capabilities.canViewAllEmployees}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            onSyncPocketBase={sinkronkanPocketBase}
            syncingPb={syncingPb}
            lastPbResult={lastPbResult}
            onKeluar={() => void tanganiKeluar()}
          />
        )}
        </ErrorBoundary>
      </main>

      <OfflineIndicator />

      {/* Fixed Bottom Navigation */}
      <nav
        aria-label="Navigasi Mobile AMS"
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-blue-100 bg-white/95 shadow-[0_-4px_20px_rgb(25_56_86_/_0.06)] backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      >
        <div className={`mx-auto grid h-16 max-w-3xl ${daftarTabBawah.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {daftarTabBawah.map((item) => {
            const Icon = item.icon;
            const aktif = tabAktif === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTabAktif(item.id)}
                aria-current={aktif ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-2xs font-bold transition cursor-pointer ${
                  aktif ? 'text-blue-600' : 'text-slate-600 hover:text-blue-800'
                }`}
              >
                <span className={`rounded-xl px-3 py-1 ${aktif ? 'bg-blue-50' : ''}`}>
                  <Icon className={`w-5 h-5 ${aktif ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
                </span>
                <span className="truncate max-w-full px-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
