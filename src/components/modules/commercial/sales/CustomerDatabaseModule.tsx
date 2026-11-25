import { useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useDbTick } from '../../../../hooks/useDbSync';
import { db } from '../../../../services/pocketbase';
import type { PelangganB2B } from '../../../../types';
import { detailCustomerBerubah, detailCustomerDatabase, rapikanDetailCustomer, validasiDetailCustomer, type DetailCustomerDatabase } from '../../../../utils/customerDatabase';
import { Modal, Panel, inputClass, labelClass, tombolPrimer, tombolSekunder } from '../../../ui';

const UKURAN_HALAMAN = 50;
type FieldTeks = 'kodePelanggan' | 'namaInstalasi' | 'namaPajak' | 'npwp' | 'kodeFakturPajak' |
  'alamat1' | 'alamat2' | 'kotaSurat' | 'wilayahCustomer' | 'penanggungJawabSales' |
  'nomorTelepon' | 'nomorFax' | 'nomorWhatsapp' | 'emailCustomer' | 'afiliasiKeterangan' |
  'setHarga' | 'kontakPerson' | 'jabatanKontak' | 'izinCustomer';
const IDENTITAS: { key: FieldTeks; label: string; type?: string }[] = [
  { key: 'kodePelanggan', label: 'Kode Customer' },
  { key: 'namaInstalasi', label: 'Nama Customer' },
  { key: 'namaPajak', label: 'Nama Pajak (jika berbeda)' },
  { key: 'wilayahCustomer', label: 'Wilayah' },
  { key: 'penanggungJawabSales', label: 'Sales / penanggung jawab' },
  { key: 'npwp', label: 'NPWP' },
  { key: 'kodeFakturPajak', label: 'Kode Faktur Pajak' }
];
const KONTAK: { key: FieldTeks; label: string; type?: string }[] = [
  { key: 'nomorTelepon', label: 'Telepon', type: 'tel' },
  { key: 'nomorFax', label: 'Fax', type: 'tel' },
  { key: 'nomorWhatsapp', label: 'No. WhatsApp', type: 'tel' },
  { key: 'kontakPerson', label: 'Kontak Person' },
  { key: 'jabatanKontak', label: 'Jabatan' },
  { key: 'emailCustomer', label: 'Email', type: 'email' },
  { key: 'izinCustomer', label: 'Izin' },
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
  const [alamatAktif, setAlamatAktif] = useState(0);
  const daftar = useMemo(() => {
    const kata = pencarian.trim().toLocaleLowerCase();
    return pelanggan.filter((p) => !kata || [
      p.kodePelanggan, p.namaInstalasi, p.alamat1, p.alamat2, p.wilayahCustomer, p.provinsi,
      p.penanggungJawabSales, p.emailCustomer, p.nomorTelepon, p.nomorWhatsapp, p.afiliasiKeterangan
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
    setAlamatAktif(0);
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
    if (db.getPelangganB2B().some((p) => p.id !== pilihan.id && p.kodePelanggan.trim().toLocaleLowerCase() === bersih.kodePelanggan.toLocaleLowerCase())) {
      setPesan('Kode customer sudah digunakan oleh pelanggan lain.');
      return;
    }
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
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{p.nomorTelepon || p.nomorWhatsapp || '—'}</td>
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
          <form onSubmit={simpan} className="space-y-5">
            <div className="space-y-5">
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Identitas Customer</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {IDENTITAS.map(({ key, label, type }) => (
                    <div key={key}>
                      <label htmlFor={`customer-db-${key}`} className={labelClass}>{label}</label>
                      <input id={`customer-db-${key}`} type={type || 'text'} className={inputClass} disabled={!bolehUbah}
                        value={draf[key] || ''} onChange={(event) => { setDraf({ ...draf, [key]: event.target.value }); setPesan(''); }} />
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" disabled={!bolehUbah} checked={draf.bl ?? false} onChange={(event) => setDraf({ ...draf, bl: event.target.checked })} /> BL
                  </label>
                </div>
              </section>
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Alamat</h4>
                <div className="flex gap-1 overflow-x-auto mb-3">
                  {['Alamat Surat', 'Alamat Pengiriman', 'Alamat Pengiriman 2', 'Alamat Pengiriman 3', 'Alamat Pajak'].map((nama, index) => (
                    <button key={nama} type="button" onClick={() => setAlamatAktif(index)}
                      aria-pressed={alamatAktif === index} className={`${tombolSekunder} whitespace-nowrap ${alamatAktif === index ? 'bg-blue-50 text-blue-800 border-blue-300' : ''}`}>{nama}</button>
                  ))}
                </div>
                {alamatAktif === 0 ? (
                  <div className="grid gap-3">
                    {([{ key: 'alamat1', label: 'Alamat 1' }, { key: 'alamat2', label: 'Alamat 2' }, { key: 'kotaSurat', label: 'Kota' }] as const).map(({ key, label }) => (
                      <div key={key}><label htmlFor={`customer-db-${key}`} className={labelClass}>{label}</label>
                        <input id={`customer-db-${key}`} className={inputClass} disabled={!bolehUbah} value={draf[key] || ''} onChange={(event) => setDraf({ ...draf, [key]: event.target.value })} /></div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {(['alamat1', 'alamat2', 'kota'] as const).map((key, i) => {
                      const alamat = alamatAktif === 4 ? draf.alamatPajak : draf.alamatPengiriman?.[alamatAktif - 1];
                      return <div key={key}><label htmlFor={`customer-db-address-${key}`} className={labelClass}>{['Alamat 1', 'Alamat 2', 'Kota'][i]}</label>
                        <input id={`customer-db-address-${key}`} className={inputClass} disabled={!bolehUbah} value={alamat?.[key] || ''} onChange={(event) => {
                          const baru = { alamat1: '', alamat2: '', kota: '', ...alamat, [key]: event.target.value };
                          if (alamatAktif === 4) setDraf({ ...draf, alamatPajak: baru });
                          else {
                            const pengiriman = [...(draf.alamatPengiriman || [])];
                            pengiriman[alamatAktif - 1] = baru;
                            setDraf({ ...draf, alamatPengiriman: pengiriman });
                          }
                        }} /></div>;
                    })}
                  </div>
                )}
              </section>
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Ketentuan dan Kontak</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { key: 'termsOfPaymentHari', label: 'Jatuh Tempo (hari)', step: '1' },
                    { key: 'batasKredit', label: 'Batas Kredit', step: 'any' },
                    { key: 'maxCnPersen', label: 'Max. CN (%)', step: 'any' },
                    { key: 'maxSkiPersen', label: 'Max. SKI (%)', step: 'any' }
                  ] as const).map(({ key, label, step }) => (
                    <div key={key}><label htmlFor={`customer-db-${key}`} className={labelClass}>{label}</label>
                      <input id={`customer-db-${key}`} type="number" min="0" step={step} className={inputClass} disabled={!bolehUbah} value={draf[key] ?? ''}
                        onChange={(event) => setDraf({ ...draf, [key]: event.target.value === '' ? undefined : event.target.valueAsNumber })} /></div>
                  ))}
                  <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" disabled={!bolehUbah} checked={draf.noCn ?? false} onChange={(event) => setDraf({ ...draf, noCn: event.target.checked })} /> No.CN</label>
                  {([{ key: 'setHarga', label: 'Set Harga' }, ...KONTAK] as { key: FieldTeks; label: string; type?: string }[]).map(({ key, label, type }) => (
                    <div key={key}><label htmlFor={`customer-db-${key}`} className={labelClass}>{label}</label>
                      <input id={`customer-db-${key}`} type={type || 'text'} className={inputClass} disabled={!bolehUbah} value={draf[key] || ''}
                        onChange={(event) => setDraf({ ...draf, [key]: event.target.value })} /></div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">Batas kredit 0 mengikuti aturan ERP saat ini: perlu persetujuan manajemen, bukan unlimited. BL, No.CN, Max. CN/SKI dan set harga hanya disimpan sebagai referensi.</p>
                <p className="text-xs text-slate-500 mt-1">Mengubah nama customer tidak mengubah nama pada transaksi atau dokumen yang sudah tercatat.</p>
              </section>
            </div>
            {pesan && <p role="alert" className="text-xs text-rose-700">{pesan}</p>}
            {!bolehUbah && <p className="text-xs text-slate-500">Akun ini hanya memiliki akses baca.</p>}
            {bolehUbah && <button type="submit" className={tombolPrimer}>Simpan perubahan</button>}
          </form>
        </Modal>
      )}
    </Panel>
  );
}
