import React from 'react';
import { ClipboardCheck, MessageSquare, TrendingUp, Wallet } from 'lucide-react';

interface Props { fitur: 'tugas' | 'pesan' | 'performa' | 'reimburse'; }
const KONTEN = {
  tugas: { judul: 'Task Hari Ini', keterangan: 'Penugasan pribadi dan pembaruan status tugas belum terhubung ke mobile.', icon: ClipboardCheck },
  pesan: { judul: 'Pesan Saya', keterangan: 'Pesan dan notifikasi pribadi belum terhubung ke mobile.', icon: MessageSquare },
  performa: { judul: 'Progress Kinerja Bulan Ini', keterangan: 'Target dan realisasi KPI pribadi belum terhubung ke mobile. Tidak ada persentase kinerja contoh.', icon: TrendingUp },
  reimburse: { judul: 'Riwayat Klaim Reimburse', keterangan: 'Pengajuan, persetujuan dan pembayaran reimbursement belum tersedia di mobile.', icon: Wallet }
};
export default function MobileUnavailableView({ fitur }: Props) {
  const { judul, keterangan, icon: Icon } = KONTEN[fitur];
  return <section className="mobile-card space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">{judul}</h2><span className="rounded-full bg-amber-50 px-2 py-1 text-2xs font-bold text-amber-800">Belum aktif</span></div>
    <div className="rounded-xl bg-blue-50 px-4 py-6 text-center space-y-3"><Icon className="h-9 w-9 text-blue-600 mx-auto" /><p className="text-xs text-slate-600">{keterangan}</p></div>
  </section>;
}
