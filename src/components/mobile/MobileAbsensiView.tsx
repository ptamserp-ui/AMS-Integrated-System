import React, { useState } from 'react';
import { Camera, Crosshair, LogIn, LogOut, MapPin } from 'lucide-react';
import { db } from '../../services/pocketbase';
import type { KaryawanHRIS, LogAbsensi } from '../../types';
import { evaluasiKeterlambatan, hitungJarakKm, verifikasiGeofence } from '../../utils/hris';
import { formatTanggal } from '../ui';
import { LOKASI_GEOFENCE_AMS, ambilLokasiGpsPerangkat, type HasilGpsPerangkat } from './mobileHelpers';

interface Props { karyawan: KaryawanHRIS | undefined; absensiList: LogAbsensi[]; onRefresh: () => void; }
export const MobileAbsensiView: React.FC<Props> = ({ karyawan, absensiList, onRefresh }) => {
  const awal = LOKASI_GEOFENCE_AMS.find((t) => t.id === karyawan?.lokasi) || LOKASI_GEOFENCE_AMS[0];
  const [titikId, setTitikId] = useState(awal.id);
  const [gps, setGps] = useState<HasilGpsPerangkat | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [dinasLuar, setDinasLuar] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [detail, setDetail] = useState(false);
  const hariIni = new Date().toISOString().slice(0, 10);
  const riwayat = karyawan ? absensiList.filter((a) => a.karyawanId === karyawan.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal)) : [];
  const log = riwayat.find((a) => a.tanggal === hariIni);
  const sudahPulang = Boolean(log?.jamKeluar && log.jamKeluar !== '-');
  const bulanIni = riwayat.filter((a) => a.tanggal.slice(0, 7) === hariIni.slice(0, 7));
  const titik = LOKASI_GEOFENCE_AMS.find((t) => t.id === titikId) || awal;

  const ambilGps = async () => {
    setSibuk(true);
    try {
      const hasil = await ambilLokasiGpsPerangkat();
      if (!hasil.ok) { setPesan({ ok: false, teks: hasil.pesan }); return null; }
      setGps(hasil);
      return hasil;
    } finally { setSibuk(false); }
  };
  const absen = async (keluar: boolean) => {
    if (!karyawan) { setPesan({ ok: false, teks: 'Akun belum ditautkan ke data karyawan HRIS.' }); return; }
    if ((!keluar && log) || (keluar && (!log || sudahPulang))) {
      setPesan({ ok: false, teks: 'Status absensi sudah berubah. Periksa catatan terbaru.' }); return;
    }
    setPesan(null);
    const posisi = await ambilGps();
    if (!posisi) return;
    const geo = verifikasiGeofence(hitungJarakKm(posisi.lat, posisi.lon, titik.lat, titik.lon), titik.radiusMeter);
    if (!keluar && !geo.dalamPagar && !dinasLuar) { setPesan({ ok: false, teks: `${geo.label}. Pilih dinas luar jika berada di lokasi klien.` }); return; }
    const jam = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const lokasi = `GPS ${posisi.lat}, ${posisi.lon} (±${posisi.accuracyMeter}m)`;
    try {
      if (keluar && log) db.checkOutAbsensi(log.id, jam, lokasi, true);
      else db.addAbsensi({
        id: `ABS-MOB-${Date.now()}`, karyawanId: karyawan.id, nama: karyawan.nama, tanggal: hariIni,
        jamMasuk: jam, jamKeluar: '-', sumber: 'Geofencing GPS (Mobile)',
        status: evaluasiKeterlambatan(jam).menitTerlambat > 0 ? 'Terlambat' : 'Hadir',
        lokasi: `${lokasi} — ${dinasLuar ? `Dinas Luar: ${catatan.trim()}` : geo.label}`
      }, true);
      db.logAudit('HRIS Mobile — Absensi GPS', `Clock-${keluar ? 'out' : 'in'} mobile pukul ${jam}`, karyawan.id, karyawan.nama, karyawan.jabatan);
      onRefresh();
      setPesan({ ok: !db.getSyncHoldReason(), teks: db.getSyncHoldReason() || `Absen ${keluar ? 'pulang' : 'masuk'} ${jam} dicatat di perangkat dan diantrekan ke server.` });
    } catch (error) {
      setPesan({ ok: false, teks: error instanceof Error ? error.message : 'Absensi gagal disimpan.' });
    }
  };
  return (
    <div className="space-y-4">
      <section className="mobile-card space-y-3">
        <label className="block text-xs font-bold space-y-1"><span>Lokasi Kerja</span><select className="mobile-input" value={titikId} onChange={(e) => {
          const cocok = LOKASI_GEOFENCE_AMS.find((t) => t.id === e.target.value);
          if (cocok) setTitikId(cocok.id);
        }}>{LOKASI_GEOFENCE_AMS.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></label>
        <div className="rounded-xl bg-blue-50 p-5 space-y-3 text-center">
          <MapPin className="h-10 w-10 mx-auto text-blue-600" />
          <h2 className="text-sm font-bold">{titik.nama}</h2>
          <p className="text-xs text-slate-600">Peta belum aktif. GPS perangkat dan geofence AMS existing tetap digunakan; lokasi kantor perlu divalidasi administrator.</p>
          <p className="text-xs font-mono break-words">{gps ? `${gps.lat}, ${gps.lon} · Akurasi ±${gps.accuracyMeter} m` : 'Koordinat perangkat belum diambil'}</p>
          <button type="button" disabled={sibuk} onClick={() => void ambilGps()} className="mobile-outline w-full"><Crosshair className="h-4 w-4" />{sibuk ? 'Mencari GPS...' : 'Ambil Lokasi GPS'}</button>
        </div>
      </section>
      <section className="mobile-card flex items-center gap-3">
        <Camera className="h-8 w-8 shrink-0 text-blue-600" />
        <div><h2 className="text-sm font-bold">Selfie · Belum aktif</h2><p className="text-xs text-slate-600">Pengambilan dan verifikasi foto absensi belum tersedia. Tidak ada foto atau klaim selfie berhasil.</p></div>
      </section>
      <section className="mobile-card space-y-3">
        <h2 className="text-sm font-bold">{formatTanggal(hariIni)}</h2>
        <p className="text-2xl text-center font-bold tabular-nums">{log?.jamMasuk || '--:--'} <span className="text-xs text-slate-600">/ {sudahPulang ? log?.jamKeluar : '--:--'}</span></p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={dinasLuar} onChange={(e) => setDinasLuar(e.target.checked)} />Dinas Luar / Kunjungan Fasyankes</label>
        {dinasLuar && <label className="block text-xs space-y-1"><span>Catatan Dinas Luar</span><input className="mobile-input" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={sibuk || !karyawan || Boolean(log)} className="mobile-primary" onClick={() => void absen(false)}><LogIn className="h-4 w-4" />Clock In</button>
          <button type="button" disabled={sibuk || !karyawan || !log || sudahPulang} className="mobile-outline" onClick={() => void absen(true)}><LogOut className="h-4 w-4" />Clock Out</button>
        </div>
        {pesan && <p role={pesan.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-xs ${pesan.ok ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'}`}>{pesan.teks}</p>}
      </section>
      <section aria-label="Ringkasan kehadiran bulan ini" className="mobile-card space-y-3">
        <div className="flex justify-between gap-2"><h2 className="text-sm font-bold">Ringkasan Kehadiran</h2><span className="text-xs">{hariIni.slice(0, 7)}</span></div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Hadir', status: ['Hadir'], warna: 'bg-emerald-50 text-emerald-800' },
            { label: 'Terlambat', status: ['Terlambat'], warna: 'bg-blue-50 text-blue-800' },
            { label: 'Izin/Sakit', status: ['Izin', 'Sakit'], warna: 'bg-amber-50 text-amber-800' },
            { label: 'Mangkir', status: ['Mangkir'], warna: 'bg-rose-50 text-rose-800' }
          ].map(({ label, status, warna }) => <div key={label} className={`rounded-xl py-3 px-1 text-center ${warna}`}><p className="text-xl font-bold">{bulanIni.filter((a) => status.includes(a.status)).length}</p><p className="text-2xs">{label}</p></div>)}
        </div>
        <p className="text-2xs text-slate-600">Jumlah catatan bulan ini, bukan hari kerja atau saldo cuti.</p>
        <button type="button" className="mobile-outline w-full" aria-expanded={detail} onClick={() => setDetail(!detail)}>{detail ? 'Tutup Detail Absensi' : 'Lihat Detail Absensi'}</button>
        {detail && <div className="space-y-3">
          {!riwayat.length && <p className="text-xs text-slate-600">Belum ada catatan absensi Anda.</p>}
          {riwayat.slice(0, 12).map((a) => <article key={a.id} className="border-t border-blue-50 pt-3 space-y-1"><p className="text-xs font-bold">{formatTanggal(a.tanggal)} · {a.status}</p><p className="text-xs">{a.jamMasuk} – {a.jamKeluar}</p><p className="text-2xs text-slate-600 break-words">{a.lokasi}</p></article>)}
        </div>}
      </section>
    </div>
  );
};
