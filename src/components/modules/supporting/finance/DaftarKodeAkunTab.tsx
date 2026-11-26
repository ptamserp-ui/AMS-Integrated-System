import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { db } from '../../../../services/pocketbase';
import { useDbTick } from '../../../../hooks/useDbSync';
import { DOKUMEN_REFERENSI_AKUN } from '../../../../data/referensiKodeAkun';
import type { ReferensiKodeAkun } from '../../../../utils/daftarKodeAkun';
import { Modal, Panel, inputClass, labelClass, tombolPrimer, tombolSekunder } from '../../../ui';

export default function DaftarKodeAkunTab({ bolehUbah, aktor }: { bolehUbah: boolean; aktor: string }) {
  const tick = useDbTick(['keuangan_referensi_akun']);
  const akun = useMemo(() => { void tick; return db.getReferensiKodeAkun(); }, [tick]);
  const [cari, setCari] = useState('');
  const [draf, setDraf] = useState<ReferensiKodeAkun | null>(null);
  const [awal, setAwal] = useState<ReferensiKodeAkun | null>(null);
  const [pesan, setPesan] = useState('');
  const [hasil, setHasil] = useState('');
  const daftar = akun.filter((item) => `${item.kode} ${item.nama} ${item.kelompok}`.toLowerCase().includes(cari.trim().toLowerCase()));

  const simpan = (event: FormEvent) => {
    event.preventDefault();
    if (!bolehUbah || !draf) { setPesan('Anda tidak memiliki izin update Finance & Accounting.'); return; }
    try {
      db.simpanReferensiKodeAkun(draf, awal, aktor);
      setDraf(null);
      setHasil('Perubahan disimpan di perangkat dan diantrekan ke server. Periksa indikator sinkronisasi; konflik atau kegagalan server tidak berarti perubahan sudah tersimpan di server.');
    } catch (error) {
      setPesan(error instanceof Error ? error.message : 'Penyimpanan gagal. Periksa status sinkronisasi.');
    }
  };

  return (
    <div className="space-y-4">
      <Panel judul="Daftar Kode Akun" keterangan="Referensi perusahaan dagang, distribusi, dan jasa. Terpisah dari CoA aktif; tidak mengubah jurnal atau saldo."
        aksi={bolehUbah && <button type="button" className={tombolPrimer} onClick={() => {
          setAwal(null); setPesan(''); setDraf({ id: crypto.randomUUID(), kode: '', nama: '', kelompok: '1. Aset' });
        }}><Plus className="w-4 h-4" />Tambah Kode Akun</button>}>
        {!bolehUbah && <p className="mb-3 text-xs text-amber-800">Hak lihat saja. Tambah/edit memerlukan izin update Finance &amp; Accounting.</p>}
        {hasil && <p role="status" className="mb-3 text-xs text-blue-800">{hasil}</p>}
        <div className="flex items-center gap-2 mb-3"><Search className="w-4 h-4" />
          <input aria-label="Cari kode akun" className={inputClass} placeholder="Cari kode, nama, atau kelompok" value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500 mb-2">{daftar.length} dari {akun.length} akun referensi</p>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left">
            <thead><tr className="bg-slate-100"><th className="p-3">Kode</th><th className="p-3">Nama Akun</th><th className="p-3">Kelompok</th><th className="p-3">Aksi</th></tr></thead>
            <tbody>{daftar.map((item) => <tr key={item.id} className="border-b border-slate-100">
              <td className="p-3 font-mono">{item.kode}</td><td className="p-3">{item.nama}</td><td className="p-3">{item.kelompok}</td>
              <td className="p-3">{bolehUbah && <button type="button" className={tombolSekunder} onClick={() => {
                setAwal({ ...item }); setDraf({ ...item }); setPesan('');
              }}>Ubah</button>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <Panel judul="Dokumen Acuan Awal Lengkap" keterangan="Isi sumber tetap dipertahankan sebagai referensi historis. Perubahan pengguna berlaku pada daftar di atas, bukan dokumen sumber.">
        <details><summary className="cursor-pointer text-sm font-semibold">Tampilkan seluruh isi daftar-kode-akun.md</summary>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed mt-3 font-sans">{DOKUMEN_REFERENSI_AKUN}</pre>
        </details>
      </Panel>
      {draf && <Modal judul={awal ? 'Ubah Kode Akun Referensi' : 'Tambah Kode Akun Referensi'} onClose={() => setDraf(null)}>
        <form onSubmit={simpan} className="space-y-3">
          <div><label className={labelClass}>Kode Akun</label><input required className={inputClass} value={draf.kode} onChange={(e) => setDraf({ ...draf, kode: e.target.value })} /></div>
          <div><label className={labelClass}>Nama Akun</label><input required className={inputClass} value={draf.nama} onChange={(e) => setDraf({ ...draf, nama: e.target.value })} /></div>
          <div><label className={labelClass}>Kelompok</label><input required list="kelompok-akun" className={inputClass} value={draf.kelompok} onChange={(e) => setDraf({ ...draf, kelompok: e.target.value })} />
            <datalist id="kelompok-akun">{[...new Set(akun.map((item) => item.kelompok))].map((item) => <option key={item} value={item} />)}</datalist>
          </div>
          {pesan && <p role="alert" className="text-xs text-rose-800">{pesan}</p>}
          <button type="submit" className={tombolPrimer} disabled={!bolehUbah}>Simpan</button>
        </form>
      </Modal>}
    </div>
  );
}
