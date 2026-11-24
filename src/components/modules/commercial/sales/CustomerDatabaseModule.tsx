import { useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useDbTick } from '../../../../hooks/useDbSync';
import { db } from '../../../../services/pocketbase';
import type { PelangganB2B } from '../../../../types';
import { detailCustomerBerubah, detailCustomerDatabase, rapikanDetailCustomer, validasiDetailCustomer, type DetailCustomerDatabase } from '../../../../utils/customerDatabase';
import { Modal, Panel, inputClass, labelClass, tombolPrimer, tombolSekunder } from '../../../ui';

const UKURAN_HALAMAN = 50;
const KOLOM: { key: keyof DetailCustomerDatabase; label: string; type?: string }[] = [
  { key: 'alamat1', label: 'Alamat 1' },
  { key: 'alamat2', label: 'Alamat 2' },
  { key: 'wilayahCustomer', label: 'Wilayah' },
  { key: 'penanggungJawabSales', label: 'Sales / penanggung jawab' },
  { key: 'nomorWhatsapp', label: 'No. Telp (WA)', type: 'tel' },
  { key: 'emailCustomer', label: 'Email', type: 'email' },
  { key: 'afiliasiKeterangan', label: 'Afiliasi / Keterangan' }
];

export default function CustomerDatabaseModule({ bolehUbah, aktor }: { bolehUbah: boolean; aktor: string }) {
  const tick = useDbTick(['sales_pelanggan']);
  const pelanggan = useMemo(() => {
    void tick;
    return db.getPelangganB2B();
  }, [tick]);
  const [pencarian, setPencarian] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [pilihan, setPilihan] = useState<PelangganB2B | null>(null);
  const [awal, setAwal] = useState<DetailCustomerDatabase | null>(null);
  const [draf, setDraf] = useState<DetailCustomerDatabase | null>(null);
  const [pesan, setPesan] = useState('');
  const [hasil, setHasil] = useState('');
  const daftar = useMemo(() => {
    const kata = pencarian.trim().toLocaleLowerCase();
    return pelanggan.filter((p) => !kata || [
      p.kodePelanggan, p.namaInstalasi, p.alamat1, p.alamat2, p.wilayahCustomer, p.provinsi,
      p.penanggungJawabSales, p.emailCustomer, p.nomorWhatsapp, p.afiliasiKeterangan
    ].some((nilai) => (nilai || '').toLocaleLowerCase().includes(kata)));
  }, [pelanggan, pencarian]);
  const jumlahHalaman = Math.max(1, Math.ceil(daftar.length / UKURAN_HALAMAN));
  const halamanAktif = Math.min(halaman, jumlahHalaman);
  const baris = daftar.slice((halamanAktif - 1) * UKURAN_HALAMAN, halamanAktif * UKURAN_HALAMAN);

  const buka = (p: PelangganB2B) => {
    const detail = detailCustomerDatabase(p);
    setPilihan(p);
    setAwal(detail);
    setDraf(detail);
    setPesan('');
    setHasil('');
  };

  const simpan = (event: FormEvent) => {
    event.preventDefault();
    if (!bolehUbah || !pilihan || !draf || !awal) return;
    const error = validasiDetailCustomer(draf);
    if (error) { setPesan(error); return; }
    const terbaru = db.getPelangganB2B().find((p) => p.id === pilihan.id);
    if (!terbaru || detailCustomerBerubah(awal, detailCustomerDatabase(terbaru))) {
      setPesan('Data pelanggan berubah atau tidak lagi tersedia. Salin draf Anda, tutup, lalu buka kembali data terbaru.');
      return;
    }
    const bersih = rapikanDetailCustomer(draf);
    try {
      db.updatePelangganB2B(pilihan.id, bersih, { aktor, throwOnFailure: true });
      setPilihan(null);
      setHasil('Perubahan disimpan di perangkat dan dikirim melalui antrean sinkronisasi. Periksa status sinkronisasi untuk memastikan tersimpan di server.');
    } catch (error) {
      setPesan(error instanceof Error ? `Penyimpanan belum selesai: ${error.message}. Periksa data lokal dan status sinkronisasi sebelum mencoba lagi.` : 'Penyimpanan belum selesai. Periksa data lokal dan status sinkronisasi sebelum mencoba lagi.');
    }
  };

  return (
    <Panel judul="Master Data Pelanggan" keterangan="Data induk pelanggan Sales. Data dapat berisi contoh; kolom yang belum diketahui tetap kosong.">
      <div className="space-y-4">
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Email di sini adalah kontak customer, bukan email penautan Customer Portal. Impor Excel belum tersedia dari menu ini dan menunggu backup, validasi serta persetujuan.
        </p>
        {hasil && <p role="status" className="text-xs text-slate-700">{hasil}</p>}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input aria-label="Cari customer" className={`${inputClass} pl-9`} placeholder="Cari kode, nama, wilayah atau kontak" value={pencarian}
            onChange={(event) => { setPencarian(event.target.value); setHalaman(1); }} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                {['Kode', 'Nama / Instansi', 'Alamat', 'No. Telp', 'Email', 'Afiliasi / Keterangan'].map((label) => (
                  <th key={label} scope="col" className="py-3 px-4 whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 align-top">
                  <td className="py-3 px-4 font-mono text-slate-500">{p.kodePelanggan}</td>
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => buka(p)} className="font-bold text-slate-900 hover:text-blue-700 cursor-pointer text-left">
                      {p.namaInstalasi}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {[p.alamat1, p.alamat2, p.wilayahCustomer || p.provinsi].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{p.nomorWhatsapp || '—'}</td>
                  <td className="py-3 px-4 text-slate-700">{p.emailCustomer || '—'}</td>
                  <td className="py-3 px-4 text-slate-700">{p.afiliasiKeterangan || '—'}</td>
                </tr>
              ))}
              {baris.length === 0 && (
                <tr><td colSpan={6} className="py-6 px-4 text-center text-slate-500">Tidak ada pelanggan yang cocok dengan pencarian.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>{daftar.length} customer · halaman {halamanAktif} dari {jumlahHalaman}</span>
          <div className="flex gap-2">
            <button type="button" className={tombolSekunder} disabled={halamanAktif <= 1} onClick={() => setHalaman(halamanAktif - 1)}>Sebelumnya</button>
            <button type="button" className={tombolSekunder} disabled={halamanAktif >= jumlahHalaman} onClick={() => setHalaman(halamanAktif + 1)}>Berikutnya</button>
          </div>
        </div>
      </div>
      {pilihan && draf && (
        <Modal judul={pilihan.namaInstalasi} keterangan={`Kode: ${pilihan.kodePelanggan}`} onClose={() => setPilihan(null)}>
          <form onSubmit={simpan} className="space-y-3">
            {KOLOM.map(({ key, label, type }) => (
              <div key={key}>
                <label htmlFor={`customer-db-${key}`} className={labelClass}>{label}</label>
                <input id={`customer-db-${key}`} type={type || 'text'} className={inputClass} disabled={!bolehUbah}
                  value={draf[key] || ''} onChange={(event) => { setDraf({ ...draf, [key]: event.target.value }); setPesan(''); }} />
              </div>
            ))}
            {pesan && <p role="alert" className="text-xs text-rose-700">{pesan}</p>}
            {!bolehUbah && <p className="text-xs text-slate-500">Akun ini hanya memiliki akses baca.</p>}
            {bolehUbah && <button type="submit" className={tombolPrimer}>Simpan perubahan</button>}
          </form>
        </Modal>
      )}
    </Panel>
  );
}
