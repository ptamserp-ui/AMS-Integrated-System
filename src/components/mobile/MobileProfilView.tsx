import React, { useState } from 'react';
import { KeyRound, LogOut, RefreshCw, UserCircle2 } from 'lucide-react';
import type { KaryawanHRIS } from '../../types';
import { gantiKataSandiServer, type SesiLogin } from '../../utils/autentikasi';
import { formatTanggal } from '../ui';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface MobileProfilViewProps {
  sesi: SesiLogin;
  karyawan: KaryawanHRIS | undefined;
  allKaryawan: KaryawanHRIS[];
  canSwitchProfile: boolean;
  selectedEmployeeId?: string;
  onSelectEmployee: (id: string) => void;
  onSync: () => Promise<void>;
  syncing: boolean;
  onKeluar: () => void;
}
export const MobileProfilView: React.FC<MobileProfilViewProps> = ({
  sesi, karyawan, allKaryawan, canSwitchProfile, selectedEmployeeId, onSelectEmployee, onSync, syncing, onKeluar
}) => {
  const [ubahSandi, setUbahSandi] = useState(false);
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const simpan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sibuk) return;
    setSibuk(true);
    try {
      const hasil = await gantiKataSandiServer(lama, baru);
      setPesan({ ok: hasil.ok, teks: hasil.pesan });
      if (hasil.ok) { setLama(''); setBaru(''); setUbahSandi(false); }
    } catch (error) {
      setPesan({ ok: false, teks: error instanceof Error ? error.message : 'Perubahan kata sandi gagal.' });
    } finally { setSibuk(false); }
  };
  return (
    <div className="space-y-4">
      <section className="mobile-card space-y-4">
        <div className="flex items-center gap-3"><UserCircle2 className="h-12 w-12 shrink-0 text-blue-600" />
          <div><h2 className="text-lg font-bold">{karyawan?.nama || sesi.namaLengkap}</h2><p className="text-xs text-slate-600">{karyawan?.jabatan || sesi.namaPeran}</p><p className="text-2xs">ID: {karyawan?.id || 'Belum ditautkan'}</p></div>
        </div>
        {canSwitchProfile && allKaryawan.length > 1 && <label className="block text-xs font-bold space-y-1"><span>Pilih profil HRIS (akses berwenang)</span>
          <select className="mobile-input" value={selectedEmployeeId || karyawan?.id || ''} onChange={(e) => onSelectEmployee(e.target.value)}>
            {allKaryawan.map((k) => <option key={k.id} value={k.id}>{k.nama} · {k.divisi}</option>)}
          </select>
        </label>}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          {[
            ['Divisi', karyawan?.divisi || sesi.departemen || 'Belum tersedia'],
            ['Lokasi Kerja', karyawan?.lokasi || 'Belum tersedia'],
            ['Status Karyawan', karyawan?.statusKaryawan || 'Belum tersedia'],
            ['Bergabung', karyawan ? formatTanggal(karyawan.tanggalBergabung) : 'Belum tersedia']
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-blue-50 p-3"><dt className="text-slate-600">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}
        </dl>
      </section>
      {Boolean(karyawan?.sertifikasi.length) && <section className="mobile-card space-y-3"><h2 className="text-sm font-bold">Sertifikasi Saya</h2>
        {karyawan?.sertifikasi.map((s) => <div key={s.nomor} className="text-xs border-t border-blue-50 pt-2"><p className="font-bold">{s.nama}</p><p>{s.nomor} · Berlaku hingga {formatTanggal(s.masaBerlaku)}</p></div>)}
      </section>}
      <section className="mobile-card space-y-3">
        <h2 className="text-sm font-bold">Pengaturan Akun</h2>
        <PWAInstallButton />
        <button type="button" className="mobile-outline w-full" onClick={() => void onSync()} disabled={syncing}><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Menyelaraskan...' : 'Sinkronkan Data'}</button>
        <button type="button" className="mobile-outline w-full" onClick={() => setUbahSandi(!ubahSandi)} aria-expanded={ubahSandi}><KeyRound className="h-4 w-4" />Ganti Kata Sandi</button>
        {ubahSandi && <form onSubmit={simpan} className="space-y-3">
          <label className="block text-xs space-y-1"><span>Kata Sandi Lama</span><input type="password" autoComplete="current-password" className="mobile-input" required value={lama} onChange={(e) => setLama(e.target.value)} /></label>
          <label className="block text-xs space-y-1"><span>Kata Sandi Baru</span><input type="password" autoComplete="new-password" className="mobile-input" required value={baru} onChange={(e) => setBaru(e.target.value)} /></label>
          <button type="submit" className="mobile-primary w-full" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan Kata Sandi'}</button>
        </form>}
        {pesan && <p role={pesan.ok ? 'status' : 'alert'} className="text-xs text-blue-800">{pesan.teks}</p>}
        <button type="button" className="mobile-outline w-full text-rose-700" onClick={onKeluar}><LogOut className="h-4 w-4" />Keluar</button>
      </section>
    </div>
  );
};
