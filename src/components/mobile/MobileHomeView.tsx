import React from 'react';
import { CalendarCheck, CalendarClock, ClipboardCheck, LogIn, LogOut, MapPin, Plane, ReceiptText, UserCircle2, Wallet } from 'lucide-react';
import type { KaryawanHRIS, LogAbsensi } from '../../types';

export type MobilePage = 'beranda' | 'absensi' | 'cuti' | 'slip-gaji' | 'reimburse' | 'jadwal' | 'tugas' | 'pesan' | 'performa' | 'profil';
export type MobileNavTarget = { tab: MobilePage };

interface MobileHomeViewProps {
  namaPengguna: string;
  namaPeran: string;
  karyawan: KaryawanHRIS | undefined;
  absensiList: LogAbsensi[];
  onNavigate: (target: MobileNavTarget) => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  namaPengguna, namaPeran, karyawan, absensiList, onNavigate
}) => {
  const hariIni = new Date().toISOString().slice(0, 10);
  const log = karyawan ? absensiList.find((a) => a.karyawanId === karyawan.id && a.tanggal === hariIni) : undefined;
  const pulang = Boolean(log?.jamKeluar && log.jamKeluar !== '-');
  const nama = karyawan?.nama || namaPengguna;
  const modul: { tab: MobilePage; label: string; icon: typeof CalendarCheck }[] = [
    { tab: 'absensi', label: 'Absensi', icon: CalendarCheck },
    { tab: 'cuti', label: 'Cuti & Izin', icon: Plane },
    { tab: 'slip-gaji', label: 'Slip Gaji', icon: ReceiptText },
    { tab: 'reimburse', label: 'Reimburse', icon: Wallet },
    { tab: 'tugas', label: 'Tugas & KPI', icon: ClipboardCheck },
    { tab: 'jadwal', label: 'Jadwal Kerja', icon: CalendarClock }
  ];
  return (
    <div className="space-y-5">
      <section className="-mx-4 -mt-4 bg-blue-800 px-4 pt-3 pb-10 text-white">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onNavigate({ tab: 'profil' })} aria-label="Buka profil saya"
            className="h-12 w-12 shrink-0 rounded-full border-2 border-white bg-blue-100 text-blue-800 flex items-center justify-center">
            <UserCircle2 className="h-8 w-8" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold break-words">{nama}</h2>
            <p className="text-xs text-blue-100">{karyawan?.jabatan || namaPeran}</p>
            <p className="text-2xs text-blue-100">ID: {karyawan?.id || 'Belum ditautkan'}</p>
          </div>
        </div>
      </section>
      <section aria-label="Absensi hari ini" className="relative -mt-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow-lg shadow-blue-900/15 space-y-3">
        <h3 className="text-sm font-bold">Absensi Hari Ini</h3>
        <p className="text-4xl font-bold text-center tabular-nums">{pulang ? log?.jamKeluar : log?.jamMasuk || '--:--'}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onNavigate({ tab: 'absensi' })} disabled={!log || pulang}
            className="min-h-[44px] rounded-full bg-white text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
            <LogOut className="h-4 w-4" />Clock Out
          </button>
          <button type="button" onClick={() => onNavigate({ tab: 'absensi' })}
            className="min-h-[44px] rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center gap-1">
            <LogIn className="h-4 w-4" />{log ? 'Lihat Absensi' : 'Clock In'}
          </button>
        </div>
        <p className="text-2xs">{log ? `Masuk ${log.jamMasuk} · ${pulang ? `Pulang ${log.jamKeluar}` : log.status}` : 'Belum ada catatan absensi hari ini'}</p>
        <p className="text-2xs flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{karyawan?.lokasi || 'Lokasi belum ditautkan'} · Verifikasi di halaman absensi</p>
      </section>
      <section aria-label="Menu modul mobile" className="space-y-3">
        <h3 className="text-sm font-bold text-blue-950">Menu Modul</h3>
        <div className="grid grid-cols-3 gap-3">
          {modul.map(({ tab, label, icon: Icon }) => (
            <button key={tab} type="button" onClick={() => onNavigate({ tab })}
              className="min-h-[96px] rounded-xl bg-white border border-blue-100 shadow-sm p-2 flex flex-col items-center justify-center gap-2 text-xs font-bold text-blue-950 hover:bg-blue-50">
              <Icon className="h-6 w-6 text-blue-600" />{label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
