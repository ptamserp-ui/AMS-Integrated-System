import React, { useMemo } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Crosshair,
  Gavel,
  MapPin,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserCircle2,
  LogIn,
  LogOut
} from 'lucide-react';
import type {
  JadwalShift,
  KaryawanHRIS,
  KunjunganMedRep,
  LogAbsensi,
  PengajuanCuti,
  PraOrderMedRep,
  ProspekAlkes,
  SlipGaji,
  TenderAlkes
} from '../../types';
import { formatRupiah, formatTanggal } from '../ui';
import type { MobileCapabilities } from './mobileHelpers';
import type { CrmSubTab } from './MobileCrmView';
import type { SalesSubTab } from './MobileSalesView';

export type MobileNavTarget =
  | { tab: 'beranda' }
  | { tab: 'absensi' }
  | { tab: 'shift-cuti' }
  | { tab: 'slip-gaji' }
  | { tab: 'hris'; sub?: 'absensi' | 'shift-cuti' | 'slip-gaji' }
  | { tab: 'crm'; sub?: CrmSubTab }
  | { tab: 'penjualan'; sub?: SalesSubTab }
  | { tab: 'profil' };

interface MobileHomeViewProps {
  namaPengguna: string;
  capabilities: MobileCapabilities;
  karyawan: KaryawanHRIS | undefined;
  absensiList: LogAbsensi[];
  shiftList: JadwalShift[];
  cutiList: PengajuanCuti[];
  slipList: SlipGaji[];
  prospekList: ProspekAlkes[];
  kunjunganList: KunjunganMedRep[];
  praOrderList: PraOrderMedRep[];
  tenderList: TenderAlkes[];
  statusKoneksiLabel: string;
  pocketbaseOnline: boolean;
  onNavigate: (target: MobileNavTarget) => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  namaPengguna,
  capabilities,
  karyawan,
  absensiList,
  shiftList,
  cutiList,
  slipList,
  prospekList,
  kunjunganList,
  praOrderList,
  tenderList,
  statusKoneksiLabel,
  pocketbaseOnline,
  onNavigate
}) => {
  const hariIni = new Date().toISOString().split('T')[0];
  const karyawanId = karyawan?.id || '';
  const namaKaryawan = karyawan?.nama || namaPengguna;

  const logHariIni = useMemo(
    () =>
      absensiList.find(
        (a) => a.tanggal === hariIni && a.karyawanId === karyawanId
      ),
    [absensiList, hariIni, karyawanId]
  );

  const shiftAktif = useMemo(() => {
    const cocok = shiftList.filter((s) => s.tim.includes(namaKaryawan));
    return cocok.find((s) => s.tanggalMulai <= hariIni && s.tanggalBerakhir >= hariIni) || null;
  }, [shiftList, namaKaryawan, hariIni]);

  const cutiMenunggu = useMemo(
    () =>
      cutiList.filter(
        (c) => c.status === 'Menunggu' && (capabilities.canApproveLeave || c.karyawanId === karyawanId)
      ).length,
    [cutiList, capabilities.canApproveLeave, karyawanId]
  );

  const slipTerbaru = useMemo(() => {
    const milik = slipList.filter((s) => s.karyawanId === karyawanId);
    return milik[0] || (capabilities.canViewAllEmployees ? slipList[0] : null) || null;
  }, [slipList, karyawanId, capabilities.canViewAllEmployees]);

  // Ringkasan Sales & CRM
  const kunjunganBelumCheckIn = useMemo(
    () => kunjunganList.filter((k) => !k.koordinatCheckIn).length,
    [kunjunganList]
  );

  const pipelineAktif = useMemo(() => {
    const aktif = prospekList.filter((p) => p.tahap !== 'Pemenang' && p.tahap !== 'Gagal');
    const nilai = aktif.reduce((acc, p) => acc + p.nilaiEstimasi, 0);
    return { jumlah: aktif.length, nilai };
  }, [prospekList]);

  const tenderAktif = useMemo(
    () => tenderList.filter((t) => t.statusTender === 'Aktif' || t.statusTender === 'Hampir Tutup'),
    [tenderList]
  );

  const praOrderMenunggu = useMemo(
    () => praOrderList.filter((p) => p.statusPraOrder === 'Terkirim ke Gudang').length,
    [praOrderList]
  );

  const keAbsensi = () =>
    onNavigate(capabilities.isSales ? { tab: 'hris', sub: 'absensi' } : { tab: 'absensi' });
  const keShiftCuti = () =>
    onNavigate(capabilities.isSales ? { tab: 'hris', sub: 'shift-cuti' } : { tab: 'shift-cuti' });
  const keSlipGaji = () =>
    onNavigate(capabilities.isSales ? { tab: 'hris', sub: 'slip-gaji' } : { tab: 'slip-gaji' });

  const sudahPulang = Boolean(logHariIni?.jamKeluar && logHariIni.jamKeluar !== '-');
  const inisial = namaKaryawan.trim().split(/\s+/).slice(0, 2).map((bagian) => bagian[0]).join('');
  const menuModul = [
    { label: 'Absensi', icon: Crosshair, buka: keAbsensi },
    { label: 'Cuti & Izin', icon: Sparkles, buka: keShiftCuti },
    ...(capabilities.canViewAllEmployees
      ? [{ label: 'Slip Gaji', icon: ReceiptText, buka: keSlipGaji }]
      : []),
    { label: 'Jadwal Kerja', icon: CalendarClock, buka: keShiftCuti },
    ...(capabilities.isSales
      ? [
          { label: 'Kunjungan', icon: MapPin, buka: () => onNavigate({ tab: 'crm', sub: 'kunjungan' }) },
          { label: 'Pre-Order', icon: ShoppingCart, buka: () => onNavigate({ tab: 'penjualan', sub: 'order' }) }
        ]
      : []),
    { label: 'Profil Saya', icon: UserCircle2, buka: () => onNavigate({ tab: 'profil' }) }
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-blue-800 via-blue-600 to-blue-500 text-white p-4 shadow-lg shadow-blue-900/10 space-y-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onNavigate({ tab: 'profil' })}
            aria-label="Buka profil saya"
            className="h-12 w-12 shrink-0 rounded-full border-2 border-white/60 bg-white/15 text-lg font-bold flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {inisial}
          </button>
          <div className="min-w-0">
            <p className="text-xs text-blue-100">
              Selamat datang
            </p>
            <h2 className="text-lg font-bold tracking-tight mt-0.5 break-words">
              {namaKaryawan}
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              {karyawan?.jabatan || capabilities.roleLabel}
              {karyawan && ` · ID: ${karyawan.id}`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 border border-white/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold">
              Absensi Hari Ini
            </p>
            <span className="text-2xs text-blue-100">{formatTanggal(hariIni)}</span>
          </div>
          <p className="text-4xl font-bold text-center tabular-nums">
            {sudahPulang ? logHariIni?.jamKeluar : logHariIni?.jamMasuk || '--:--'}
          </p>
          <p className="text-xs text-center text-blue-100">
            {logHariIni
              ? `Masuk ${logHariIni.jamMasuk} · ${sudahPulang ? `Pulang ${logHariIni.jamKeluar}` : logHariIni.status}`
              : 'Belum ada catatan absensi hari ini'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={keAbsensi}
              className="min-h-[44px] rounded-xl bg-white px-2 text-xs font-bold text-blue-800 inline-flex items-center justify-center gap-1.5 hover:bg-blue-50">
              <LogIn className="h-4 w-4" />
              {logHariIni ? 'Lihat Absensi' : 'Absen Masuk'}
            </button>
            <button type="button" onClick={keAbsensi} disabled={!logHariIni || sudahPulang}
              className="min-h-[44px] rounded-xl border border-white/40 bg-white/10 px-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <LogOut className="h-4 w-4" />
              Absen Pulang
            </button>
          </div>
          <p className="text-2xs text-blue-100 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {karyawan?.lokasi || 'Lokasi kerja belum ditautkan'} · Verifikasi GPS di halaman absensi
          </p>
        </div>

        <p className="text-2xs text-blue-100">
          {pocketbaseOnline ? 'PB AMS Aktif · ' : ''}{statusKoneksiLabel}
        </p>
      </section>

      <section aria-label="Menu modul mobile" className="space-y-3">
        <h3 className="text-sm font-bold text-blue-950">Menu Modul</h3>
        <div className="grid grid-cols-3 gap-3">
          {menuModul.map(({ label, icon: Icon, buka }) => (
            <button key={label} type="button" onClick={buka}
              className="min-h-[96px] rounded-2xl border border-blue-100 bg-white p-3 shadow-sm shadow-blue-900/5 flex flex-col items-center justify-center gap-2 text-xs font-bold text-blue-950 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Ringkasan HRIS Personal */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Layanan HRIS Karyawan
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={keShiftCuti}
            className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <CalendarClock className="w-5 h-5 text-teal-700" />
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-900">Jadwal Shift Aktif</p>
            <p className="text-2xs text-slate-600 truncate">
              {shiftAktif ? `${shiftAktif.namaShift} · ${shiftAktif.area}` : 'Lihat jadwal shift'}
            </p>
          </button>

          <button
            type="button"
            onClick={keShiftCuti}
            className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-900">Pengajuan Cuti &amp; Izin</p>
            <p className="text-2xs text-slate-600">
              {cutiMenunggu > 0
                ? `${cutiMenunggu} pengajuan menunggu persetujuan`
                : 'Ajukan atau pantau cuti Anda'}
            </p>
          </button>

          {capabilities.canViewAllEmployees && (
            <button
              type="button"
              onClick={keSlipGaji}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <ReceiptText className="w-5 h-5 text-sky-700" />
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-900">Slip Gaji Digital</p>
              <p className="text-2xs text-slate-600 tabular-nums">
                {slipTerbaru
                  ? `${slipTerbaru.periode} · ${formatRupiah(slipTerbaru.takeHomePay)}`
                  : 'Lihat rincian payroll'}
              </p>
            </button>
          )}
        </div>
      </section>

      {/* Ringkasan CRM & Sales (hanya untuk peran Sales / Manager / Admin) */}
      {capabilities.isSales && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Aktivitas CRM &amp; Penjualan Lapangan
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ tab: 'crm', sub: 'kunjungan' })}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1"
            >
              <MapPin className="w-5 h-5 text-teal-700" />
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                {kunjunganBelumCheckIn}
              </p>
              <p className="text-2xs font-semibold text-slate-600">
                Kunjungan Belum Check-In
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ tab: 'crm', sub: 'prospek' })}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1"
            >
              <TrendingUp className="w-5 h-5 text-sky-700" />
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                {pipelineAktif.jumlah}
              </p>
              <p className="text-2xs font-semibold text-slate-600">
                Prospek Aktif · {formatRupiah(pipelineAktif.nilai)}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ tab: 'penjualan', sub: 'tender' })}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1"
            >
              <Gavel className="w-5 h-5 text-amber-600" />
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                {tenderAktif.length}
              </p>
              <p className="text-2xs font-semibold text-slate-600">
                Tender e-Katalog LKPP Aktif
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ tab: 'penjualan', sub: 'order' })}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-teal-300 transition cursor-pointer space-y-1"
            >
              <ShoppingCart className="w-5 h-5 text-emerald-700" />
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                {praOrderMenunggu}
              </p>
              <p className="text-2xs font-semibold text-slate-600">
                Pre-Order Antre Verifikasi
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate({ tab: 'crm', sub: 'kunjungan' })}
              className="min-h-[48px] rounded-xl border border-teal-200 bg-teal-50 px-4 text-xs font-bold text-teal-900 inline-flex items-center justify-between hover:bg-teal-100 transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-700" />
                Mulai Check-In Kunjungan Sales (GPS)
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ tab: 'penjualan', sub: 'katalog' })}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 inline-flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <PackageSearch className="w-4 h-4 text-slate-700" />
                Cek Katalog Produk, NIE &amp; Stok FEFO
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
