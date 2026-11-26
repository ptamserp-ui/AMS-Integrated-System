import React, { useState } from 'react';
import { Calendar, Check, Plane, X } from 'lucide-react';
import { db } from '../../services/pocketbase';
import type { JadwalShift, KaryawanHRIS, PengajuanCuti } from '../../types';
import { formatTanggal } from '../ui';
import { hitungJumlahHariCuti } from './mobileHelpers';

interface MobileShiftCutiViewProps {
  karyawan: KaryawanHRIS | undefined;
  shiftList: JadwalShift[];
  cutiList: PengajuanCuti[];
  canApproveLeave: boolean;
  approverName: string;
  onRefresh: () => void;
  mode: 'cuti' | 'jadwal';
}

const JENIS_CUTI: PengajuanCuti['jenis'][] = ['Cuti Tahunan', 'Izin Khusus', 'Sakit', 'Cuti Melahirkan'];

export const MobileShiftCutiView: React.FC<MobileShiftCutiViewProps> = ({
  karyawan, shiftList, cutiList, canApproveLeave, approverName, onRefresh, mode
}) => {
  const [jenis, setJenis] = useState<PengajuanCuti['jenis']>('Cuti Tahunan');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const jumlahHari = hitungJumlahHariCuti(tanggalMulai, tanggalSelesai);
  const cutiTampil = canApproveLeave ? cutiList : cutiList.filter((c) => karyawan && c.karyawanId === karyawan.id);
  const shiftSaya = karyawan ? shiftList.filter((s) => s.tim.includes(karyawan.nama)) : [];

  const kirimPengajuan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!karyawan || jumlahHari <= 0 || !alasan.trim()) {
      setPesan({ ok: false, teks: !karyawan ? 'Akun belum ditautkan ke data karyawan HRIS.' : 'Isi alasan dan rentang tanggal yang valid.' });
      return;
    }
    try {
      db.addCuti({
        id: `CUTI-${Date.now()}`, karyawanId: karyawan.id, namaKaryawan: karyawan.nama,
        jenis, tanggalMulai, tanggalSelesai, jumlahHari, alasan: alasan.trim(),
        status: 'Menunggu', tanggalPengajuan: new Date().toISOString().slice(0, 10)
      }, true);
      const hold = db.getSyncHoldReason();
      setPesan({ ok: !hold, teks: hold || 'Pengajuan dicatat di perangkat dan diantrekan untuk sinkronisasi; belum disetujui.' });
      onRefresh();
      setAlasan('');
    } catch (error) {
      setPesan({ ok: false, teks: error instanceof Error ? error.message : 'Pengajuan cuti gagal disimpan.' });
    }
  };
  const putuskanCuti = (id: string, status: 'Disetujui' | 'Ditolak') => {
    try {
      db.ubahStatusCuti(id, status, approverName, true);
      onRefresh();
      setPesan({ ok: !db.getSyncHoldReason(), teks: db.getSyncHoldReason() || 'Keputusan dicatat di perangkat; periksa status sinkronisasi server.' });
    } catch (error) {
      setPesan({ ok: false, teks: error instanceof Error ? error.message : 'Keputusan gagal disimpan.' });
    }
  };
  if (mode === 'jadwal') return (
    <section className="mobile-card space-y-3">
      <h2 className="text-sm font-bold">Jadwal Kerja Saya</h2>
      {!shiftSaya.length && <p className="text-xs text-slate-600">Belum ada jadwal shift yang ditautkan kepada Anda. Jam kerja non-shift belum dikonfigurasi di mobile.</p>}
      {shiftSaya.map((s) => <article key={s.id} className="rounded-xl bg-blue-50 p-3 space-y-1">
        <h3 className="text-sm font-bold text-blue-800">{s.namaShift}</h3>
        <p className="text-xs">{s.area}</p><p className="text-xs">{formatTanggal(s.tanggalMulai)} – {formatTanggal(s.tanggalBerakhir)}</p>
        <p className="text-xs text-slate-600">{s.polaRotasi}</p>
      </article>)}
    </section>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(['Cuti Tahunan', 'Izin Khusus'] as const).map((label) => <section key={label} className="rounded-xl bg-blue-600 p-4 text-white shadow-sm space-y-2">
          {label === 'Cuti Tahunan' ? <Plane className="h-6 w-6" /> : <Calendar className="h-6 w-6" />}
          <h2 className="text-xs font-bold">{label}</h2><p className="text-2xl font-bold">--</p>
          <p className="text-2xs">Saldo belum dikonfigurasi</p>
        </section>)}
      </div>
      <section className="mobile-card space-y-3">
        <h2 className="text-sm font-bold">Ajukan Cuti / Izin</h2>
        <form onSubmit={kirimPengajuan} className="space-y-3">
          <div role="group" aria-label="Jenis pengajuan" className="flex flex-wrap gap-2">
            {JENIS_CUTI.map((j) => <button key={j} type="button" aria-pressed={jenis === j} onClick={() => setJenis(j)}
              className={`min-h-[44px] rounded-xl px-3 text-xs font-bold ${jenis === j ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800'}`}>{j}</button>)}
          </div>
          <label className="block text-xs font-bold space-y-1"><span>Tanggal Mulai</span><input className="mobile-input" type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} /></label>
          <label className="block text-xs font-bold space-y-1"><span>Tanggal Selesai</span><input className="mobile-input" type="date" required value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} /></label>
          <label className="block text-xs font-bold space-y-1"><span>Alasan</span><textarea className="mobile-input p-3" rows={3} required placeholder="Tulis alasan pengajuan..." value={alasan} onChange={(e) => setAlasan(e.target.value)} /></label>
          <p className="text-xs text-slate-600">Durasi: {jumlahHari} hari</p>
          <button type="submit" className="mobile-primary w-full">Ajukan Permohonan</button>
        </form>
      </section>
      {pesan && <p role={pesan.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-xs ${pesan.ok ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'}`}>{pesan.teks}</p>}
      <section className="mobile-card space-y-3">
        <h2 className="text-sm font-bold">{canApproveLeave ? 'Pengajuan & Persetujuan Cuti' : 'Riwayat Pengajuan Saya'}</h2>
        {!cutiTampil.length && <p className="text-xs text-slate-600">Belum ada pengajuan cuti atau izin.</p>}
        {cutiTampil.map((c) => <article key={c.id} className="border-t border-blue-50 pt-3 space-y-2">
          <div className="flex justify-between gap-2"><h3 className="text-xs font-bold">{c.jenis} · {c.jumlahHari} hari</h3><span className="text-2xs font-bold text-blue-700">{c.status}</span></div>
          <p className="text-xs text-slate-600">{c.namaKaryawan} · {formatTanggal(c.tanggalMulai)} – {formatTanggal(c.tanggalSelesai)}</p>
          <p className="text-xs">{c.alasan}</p>
          {c.disetujuiOleh && <p className="text-2xs text-slate-600">Diputuskan oleh: {c.disetujuiOleh}</p>}
          {canApproveLeave && c.status === 'Menunggu' && <div className="grid grid-cols-2 gap-2">
            <button type="button" className="mobile-primary" onClick={() => putuskanCuti(c.id, 'Disetujui')}><Check className="h-4 w-4" />Setujui</button>
            <button type="button" className="mobile-outline" onClick={() => putuskanCuti(c.id, 'Ditolak')}><X className="h-4 w-4" />Tolak</button>
          </div>}
        </article>)}
      </section>
    </div>
  );
};
