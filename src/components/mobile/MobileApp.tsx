import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ChevronLeft, ClipboardCheck, Home, MessageSquare, Settings, TrendingUp, UserCircle2 } from 'lucide-react';
import { db } from '../../services/pocketbase';
import { akhiriSesi, ambilSesiServer, bacaSesi, EVENT_SESI_BERAKHIR, keluarDariServer, type SesiLogin } from '../../utils/autentikasi';
import { saringHanyaDataUser } from '../../utils/dataOrigin';
import { terapkanFaviconAplikasi, useIdentitasVisualAplikasi } from '../common/LogoAplikasi';
import KartuMasuk from '../modules/website/site/KartuMasuk';
import ErrorBoundary from '../common/ErrorBoundary';
import SyncAccessHold, { useSyncHoldReason } from '../common/SyncAccessHold';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { MobileAbsensiView } from './MobileAbsensiView';
import { MobileHomeView, type MobilePage } from './MobileHomeView';
import { MobileProfilView } from './MobileProfilView';
import { MobileShiftCutiView } from './MobileShiftCutiView';
import { MobileSlipGajiView } from './MobileSlipGajiView';
import MobileUnavailableView from './MobileUnavailableView';
import { findKaryawanForSession, getMobileCapabilities } from './mobileHelpers';

const KOLEKSI_MOBILE_SINKRON = ['hris_karyawan', 'hris_shift', 'hris_absensi', 'hris_cuti', 'hris_slip_gaji', 'sistem_data_manifest', 'connection_status'] as const;
const JUDUL: Record<MobilePage, string> = {
  beranda: 'Employee ERP', absensi: 'Absensi & Lokasi', cuti: 'Cuti & Izin',
  'slip-gaji': 'Slip Gaji & Reimburse', reimburse: 'Reimburse', jadwal: 'Jadwal Kerja',
  tugas: 'Tugas & KPI', pesan: 'Pesan', performa: 'Performa', profil: 'Profil Saya'
};
const NAVIGASI: { id: MobilePage; label: string; icon: typeof Home }[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'tugas', label: 'Tugas', icon: ClipboardCheck },
  { id: 'pesan', label: 'Pesan', icon: MessageSquare },
  { id: 'performa', label: 'Performa', icon: TrendingUp },
  { id: 'profil', label: 'Profil', icon: UserCircle2 }
];

export default function MobileApp() {
  const [sesi, setSesi] = useState<SesiLogin | null>(() => bacaSesi());
  const [memeriksaSesi, setMemeriksaSesi] = useState(() => Boolean(bacaSesi()));
  const [tabAktif, setTabAktif] = useState<MobilePage>('beranda');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [pesanSync, setPesanSync] = useState<{ ok: boolean; teks: string } | null>(null);
  const alasanTahan = useSyncHoldReason();
  const identitasVisual = useIdentitasVisualAplikasi();
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [tabAktif]);
  useEffect(() => {
    terapkanFaviconAplikasi(identitasVisual.faviconUrl || identitasVisual.logoUrl);
  }, [identitasVisual.faviconUrl, identitasVisual.logoUrl]);

  const segarkanSesi = useCallback(async () => {
    const segar = await ambilSesiServer();
    if (segar) {
      db.prepareSessionSync(segar);
      await db.syncFromServer(false);
    }
    setSesi(segar && bacaSesi()?.token === segar.token ? segar : null);
  }, []);

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
      } else await db.hydratePublicSettingsFromServer();
      if (aktif) {
        setSesi(segar && bacaSesi()?.token === segar.token ? segar : null);
        setMemeriksaSesi(false);
      }
    };
    void cekServer();
    const kedaluwarsa = () => { akhiriSesi(); setSesi(null); setMemeriksaSesi(false); };
    window.addEventListener(EVENT_SESI_BERAKHIR, kedaluwarsa);
    return () => { aktif = false; window.removeEventListener(EVENT_SESI_BERAKHIR, kedaluwarsa); };
  }, []);
  useEffect(() => { db.connectRealtimeSync(sesi?.token || null); }, [sesi?.token]);
  useEffect(() => {
    if (!sesi?.token) return;
    const rbac = db.subscribeRbacUpdated(() => {
      setMemeriksaSesi(true);
      void segarkanSesi().finally(() => setMemeriksaSesi(false));
    });
    const koleksi = db.subscribeKoleksi(KOLEKSI_MOBILE_SINKRON, refresh);
    return () => { rbac(); koleksi(); };
  }, [sesi?.token, refresh, segarkanSesi]);

  const tanganiMasuk = async (baru: SesiLogin) => {
    setMemeriksaSesi(true);
    db.prepareSessionSync(baru);
    await db.syncFromServer(false);
    const aktif = bacaSesi()?.token === baru.token ? baru : null;
    if (aktif && !db.getSyncHoldReason() && !aktif.isHiddenDeveloper) {
      db.logAudit('Autentikasi & Akses', 'Masuk berhasil ke AMS Mobile (RBAC server terverifikasi)', baru.namaPengguna, baru.namaLengkap, baru.namaPeran);
    }
    db.connectRealtimeSync(aktif?.token || null);
    setSesi(aktif);
    setTabAktif('beranda');
    setMemeriksaSesi(false);
  };
  const tanganiKeluar = async () => {
    const hasil = await keluarDariServer();
    db.connectRealtimeSync(null);
    setSesi(null);
    setSelectedEmployeeId(undefined);
    if (!hasil.ok && hasil.pesan) window.alert(hasil.pesan);
  };
  const sinkronkan = async () => {
    setSyncing(true);
    try {
      const hasil = await db.syncNow();
      const error = db.getConnectionStatus().lastSyncError;
      setPesanSync({ ok: hasil.ok && !error, teks: db.getSyncHoldReason() || error || (hasil.ok ? 'Sinkronisasi server selesai.' : `Sinkronisasi belum selesai; ${hasil.remaining} perubahan tertunda.`) });
      refresh();
    } catch (error) {
      setPesanSync({ ok: false, teks: error instanceof Error ? error.message : 'Sinkronisasi gagal.' });
    } finally { setSyncing(false); }
  };

  const capabilities = useMemo(() => getMobileCapabilities(sesi), [sesi]);
  const bolehBaca = Boolean(sesi && !memeriksaSesi && !alasanTahan);
  const manifest = db.getManifestData();
  const karyawanList = bolehBaca ? saringHanyaDataUser('hris_karyawan', db.getKaryawanHRIS(), manifest) : [];
  const absensiList = bolehBaca ? saringHanyaDataUser('hris_absensi', db.getAbsensi(), manifest) : [];
  const shiftList = bolehBaca ? saringHanyaDataUser('hris_shift', db.getJadwalShift(), manifest) : [];
  const cutiList = bolehBaca ? saringHanyaDataUser('hris_cuti', db.getCuti(), manifest) : [];
  const slipList = bolehBaca ? saringHanyaDataUser('hris_slip_gaji', db.getSlipGaji(), manifest) : [];
  const karyawan = findKaryawanForSession(karyawanList, sesi, selectedEmployeeId);
  const conn = db.getConnectionStatus();

  if (memeriksaSesi) return <div className="min-h-screen bg-blue-50 flex items-center justify-center"><p className="text-sm">Menyelaraskan sesi karyawan...</p></div>;
  if (!sesi) return <div className="ams-mobile min-h-screen bg-blue-50 px-4 py-10">
    <div className="max-w-md mx-auto space-y-5"><h1 className="text-2xl text-center font-bold text-blue-950">Employee ERP</h1><p className="text-sm text-center text-slate-600">AMS · Dashboard Karyawan</p>
      <KartuMasuk logoUrl={identitasVisual.logoUrl} onTerima={(s) => void tanganiMasuk(s)} onBatal={() => { window.location.href = '/web/'; }} />
    </div><OfflineIndicator />
  </div>;
  if (alasanTahan) return <SyncAccessHold reason={alasanTahan} onRetry={segarkanSesi} onLogout={() => void tanganiKeluar()} />;

  return (
    <div className="ams-mobile min-h-screen bg-blue-50/60 text-blue-950">
      <header className="sticky top-0 z-30 bg-blue-800 text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto min-h-14 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {tabAktif !== 'beranda' && <button type="button" aria-label="Kembali ke beranda" onClick={() => setTabAktif('beranda')} className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>}
            <h1 className="text-sm font-bold truncate">{JUDUL[tabAktif]}</h1>
          </div>
          <div className="flex gap-1">
            <button type="button" aria-label="Buka pesan" className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-white/10" onClick={() => setTabAktif('pesan')}><Bell className="h-4 w-4" /></button>
            <button type="button" aria-label="Buka pengaturan profil" className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-white/10" onClick={() => setTabAktif('profil')}><Settings className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <ErrorBoundary resetKey={tabAktif} label="halaman mobile karyawan">
          {tabAktif === 'beranda' && <MobileHomeView namaPengguna={sesi.namaLengkap} namaPeran={sesi.namaPeran} karyawan={karyawan} absensiList={absensiList} onNavigate={({ tab }) => setTabAktif(tab)} />}
          {tabAktif === 'absensi' && <MobileAbsensiView karyawan={karyawan} absensiList={absensiList} onRefresh={refresh} />}
          {(tabAktif === 'cuti' || tabAktif === 'jadwal') && <MobileShiftCutiView key={tabAktif} mode={tabAktif} karyawan={karyawan} shiftList={shiftList} cutiList={cutiList} canApproveLeave={capabilities.canApproveLeave} approverName={sesi.namaLengkap} onRefresh={refresh} />}
          {tabAktif === 'slip-gaji' && <div className="space-y-4">
            {capabilities.canViewAllEmployees ? <MobileSlipGajiView karyawan={karyawan} slipList={slipList} canViewAllEmployees /> : <section className="mobile-card space-y-3"><h2 className="text-sm font-bold">Slip Gaji Saya</h2><p className="text-xs text-slate-600">Belum aktif untuk karyawan reguler. Penerbitan dan akses slip pribadi belum tersedia di mobile; hubungi HRD.</p></section>}
            <MobileUnavailableView fitur="reimburse" />
          </div>}
          {tabAktif === 'tugas' && <div className="space-y-4"><MobileUnavailableView fitur="performa" /><MobileUnavailableView fitur="tugas" /></div>}
          {(tabAktif === 'performa' || tabAktif === 'pesan' || tabAktif === 'reimburse') && <MobileUnavailableView fitur={tabAktif} />}
          {tabAktif === 'profil' && <MobileProfilView sesi={sesi} karyawan={karyawan} allKaryawan={karyawanList} canSwitchProfile={capabilities.canViewAllEmployees} selectedEmployeeId={selectedEmployeeId} onSelectEmployee={setSelectedEmployeeId} onSync={sinkronkan} syncing={syncing} onKeluar={() => void tanganiKeluar()} />}
        </ErrorBoundary>
        <div className="mt-4 space-y-2">
          {!karyawan && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Belum ada data karyawan non-contoh yang ditautkan ke akun ini. Hubungi administrator HRIS.</p>}
          {conn.lastSyncError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">Sinkronisasi belum berhasil: {conn.lastSyncError}. Perubahan tetap tertunda.</p>}
          {pesanSync && <p role={pesanSync.ok ? 'status' : 'alert'} className="mobile-card text-xs">{pesanSync.teks}</p>}
          <p className="text-2xs text-slate-600">{conn.statusLabel} · Data contoh tidak ditampilkan.</p>
        </div>
      </main>
      <OfflineIndicator />
      <nav aria-label="Navigasi Mobile AMS" className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-blue-100 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-16">
          {NAVIGASI.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tabAktif === id ? 'page' : undefined} onClick={() => setTabAktif(id)}
            className={`flex flex-col items-center justify-center gap-1 text-2xs font-semibold ${tabAktif === id ? 'text-blue-600' : 'text-slate-600'}`}>
            <Icon className="h-5 w-5" /><span>{label}</span>
          </button>)}
        </div>
      </nav>
    </div>
  );
}
