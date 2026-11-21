import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, Tag, Trash2, Upload, X } from 'lucide-react';
import type { ProdukKatalog, UserRole, VarianSkuProduk } from '../../../types';
import { db } from '../../../services/pocketbase';
import { useDbTick } from '../../../hooks/useDbSync';
import { punyaIzin, type SesiLogin } from '../../../utils/autentikasi';
import { normalisasiProdukKatalog } from '../../../utils/productCatalog';
import { bangunProduk, selesaikanGambar } from '../../../utils/website';
import { MedanGambarBanyak } from '../website/editor/medanEditor';

const PERUNTUKAN_BAWAAN = ['UGD', 'Operasi', 'Umum'];

function idBaru(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function varianBaru(): VarianSkuProduk {
  return {
    id: idBaru('sku'),
    kodeSKU: '',
    tipeModel: '',
    nomorIzinEdar: '',
    statusIzinEdar: 'Verifikasi Register RA'
  };
}

function produkBaru(): ProdukKatalog {
  const sku = varianBaru();
  return {
    id: idBaru('produk'),
    isActive: true,
    nama: '',
    tipeModel: '',
    kategori: 'General',
    kategoriRegulasi: '',
    kelasRisiko: '',
    nomorIzinEdar: '',
    statusIzinEdar: 'Verifikasi Register RA',
    produsen: '',
    negaraAsal: '',
    spesifikasi: '',
    poinJual: [],
    imageUrls: [],
    peruntukan: [],
    varianSku: [sku]
  };
}

function bisaKelola(currentRole: UserRole, sesi?: SesiLogin): boolean {
  if (sesi) return punyaIzin(sesi, 'product-catalog', 'create') || punyaIzin(sesi, 'product-catalog', 'update');
  return ['pjt', 'sales_manager', 'developer_it_support'].includes(currentRole);
}

function formatStok(varian: VarianSkuProduk): string {
  const kode = varian.kodeSKU.trim().toLowerCase();
  const nie = varian.nomorIzinEdar.trim().toUpperCase();
  const dataStok = db.getStokGudang();
  const stokDenganSku = kode
    ? dataStok.filter((baris) => baris.kodeSKU.trim().toLowerCase() === kode)
    : [];
  const barisTerpilih = stokDenganSku.length > 0
    ? stokDenganSku
    : dataStok.filter((baris) => nie && baris.nomorIzinEdar.trim().toUpperCase() === nie);
  const stok = barisTerpilih
    .filter((baris) => baris.statusFEFO !== 'Kedaluwarsa')
    .reduce((total, baris) => total + Math.max(baris.jumlahStok - (baris.qtyDipesan ?? 0), 0), 0);
  return `${stok} unit bebas`;
}

export default function ProductCatalogModule({
  currentRole,
  sesi
}: {
  currentRole: UserRole;
  sesi?: SesiLogin;
}) {
  const bisaUbah = bisaKelola(currentRole, sesi);
  const tick = useDbTick(['product_catalog', 'stok_gudang', 'izin_edar']);
  const daftar = useMemo(() => {
    void tick;
    return db.getProdukKatalog();
  }, [tick]);
  const [pilihanId, setPilihanId] = useState<string | null>(null);
  const [draf, setDraf] = useState<ProdukKatalog | null>(null);
  const [cari, setCari] = useState('');
  const [filterPeruntukan, setFilterPeruntukan] = useState('Semua');
  const [peruntukanBaru, setPeruntukanBaru] = useState('');
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    if (bisaUbah) db.inisialisasiProdukKatalog();
  }, [bisaUbah]);

  useEffect(() => {
    if (!pilihanId) {
      setDraf(null);
      return;
    }
    const dipilih = daftar.find((produk) => produk.id === pilihanId);
    if (dipilih) setDraf(dipilih);
  }, [daftar, pilihanId]);

  const peruntukanTersedia = useMemo(
    () => Array.from(new Set([...PERUNTUKAN_BAWAAN, ...daftar.flatMap((produk) => produk.peruntukan)])),
    [daftar]
  );
  const produkTampil = daftar.filter((produk) => {
    const cocokCari = `${produk.nama} ${produk.tipeModel} ${produk.produsen} ${produk.varianSku.map((v) => `${v.kodeSKU} ${v.tipeModel} ${v.nomorIzinEdar}`).join(' ')}`
      .toLowerCase().includes(cari.toLowerCase());
    const cocokPeruntukan = filterPeruntukan === 'Semua' || produk.peruntukan.includes(filterPeruntukan);
    return cocokCari && cocokPeruntukan;
  });

  const perbaruiDraf = (patch: Partial<ProdukKatalog>) => {
    setDraf((lama) => (lama ? { ...lama, ...patch } : lama));
  };

  const perbaruiVarian = (id: string, patch: Partial<VarianSkuProduk>) => {
    setDraf((lama) => lama ? {
      ...lama,
      varianSku: lama.varianSku.map((varian) => varian.id === id ? { ...varian, ...patch } : varian)
    } : lama);
  };

  const simpan = () => {
    if (!draf) return;
    if (!draf.nama.trim()) {
      setPesan('Isi nama produk sebelum menyimpan.');
      return;
    }
    if (draf.varianSku.length === 0 || draf.varianSku.some((varian) => !varian.kodeSKU.trim())) {
      setPesan('Setiap varian SKU harus memiliki kode SKU.');
      return;
    }
    const kodeSku = draf.varianSku.map((varian) => varian.kodeSKU.trim().toLowerCase());
    if (new Set(kodeSku).size !== kodeSku.length) {
      setPesan('Kode SKU pada satu produk tidak boleh duplikat.');
      return;
    }
    const skuLain = daftar
      .filter((produk) => produk.id !== draf.id)
      .flatMap((produk) => produk.varianSku.map((varian) => varian.kodeSKU.trim().toLowerCase()))
      .filter(Boolean);
    if (kodeSku.some((kode) => skuLain.includes(kode))) {
      setPesan('Kode SKU sudah digunakan pada produk lain.');
      return;
    }
    const tersimpan = { ...draf, dikunci: true };
    const terbaru = [...daftar.filter((produk) => produk.id !== draf.id), tersimpan];
    db.simpanProdukKatalog(terbaru);
    setPesan('Master produk dan SKU berhasil disimpan.');
    setDraf(tersimpan);
    setPilihanId(tersimpan.id);
  };

  const imporRegister = () => {
    const sumber = db.getSumberKontenWebsite();
    const produkRegister = bangunProduk(sumber);
    const ada = new Set(daftar.flatMap((produk) => [
      produk.sumberId,
      produk.nomorIzinEdar.trim().toUpperCase()
    ]));
    const tambahan = produkRegister
      .filter((produk) => !ada.has(produk.sumberId) && !ada.has(produk.nomorIzinEdar.trim().toUpperCase()))
      .map(normalisasiProdukKatalog);
    if (tambahan.length === 0) {
      setPesan('Tidak ada produk register izin edar baru untuk diimpor.');
      return;
    }
    db.simpanProdukKatalog([...daftar, ...tambahan]);
    setPesan(`${tambahan.length} produk baru diimpor dari register izin edar.`);
  };

  const hapusProduk = () => {
    if (!draf || !window.confirm(`Hapus produk "${draf.nama}" beserta seluruh SKU turunannya?`)) return;
    db.simpanProdukKatalog(daftar.filter((produk) => produk.id !== draf.id));
    setPilihanId(null);
    setDraf(null);
    setPesan('Produk dan seluruh SKU turunannya telah dihapus dari master.');
  };

  const tambahPeruntukan = () => {
    const nilai = peruntukanBaru.trim();
    if (!nilai || !draf || draf.peruntukan.some((p) => p.toLowerCase() === nilai.toLowerCase())) return;
    perbaruiDraf({ peruntukan: [...draf.peruntukan, nilai] });
    setPeruntukanBaru('');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Commercial</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Product Catalog</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Master pusat detail produk dan SKU. Stok serta status izin aktual tetap ditarik dari modul Gudang dan Regulatory Affairs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={imporRegister} disabled={!bisaUbah}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <Upload className="h-4 w-4" /> Impor dari Register
          </button>
          <button type="button" onClick={() => { const baru = produkBaru(); setDraf(baru); setPilihanId(baru.id); setPesan(''); }}
            disabled={!bisaUbah}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> Produk Baru
          </button>
        </div>
      </header>

      {!bisaUbah && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Akses baca-saja. Hubungi Sales Manager atau PJT untuk mengubah master produk.</p>}
      {pesan && <div role="status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">{pesan}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
        <section className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari produk, SKU, atau NIE"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500" />
            </div>
            <select value={filterPeruntukan} onChange={(e) => setFilterPeruntukan(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
              <option>Semua</option>
              {peruntukanTersedia.map((item) => <option key={item}>{item}</option>)}
            </select>
            <p className="text-2xs text-slate-500">{daftar.length} produk · {daftar.reduce((n, produk) => n + produk.varianSku.length, 0)} SKU</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
            {produkTampil.map((produk) => {
              const fotoUtama = selesaikanGambar(produk.imageUrls?.[0] ?? produk.imageUrl);
              return (
                <button key={produk.id} type="button" onClick={() => { setPilihanId(produk.id); setPesan(''); }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${pilihanId === produk.id ? 'bg-blue-50' : ''}`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {fotoUtama
                      ? <img src={fotoUtama} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <Tag className="h-5 w-5 text-slate-300" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-900">{produk.nama || '(tanpa nama)'}</span>
                    <span className="mt-1 block truncate text-2xs text-slate-500">{produk.produsen || 'Produsen belum diisi'} · {produk.varianSku.length} SKU</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {produk.peruntukan.map((item) => <span key={item} className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs text-slate-600">{item}</span>)}
                    </span>
                  </span>
                </button>
              );
            })}
            {produkTampil.length === 0 && <p className="p-5 text-center text-xs text-slate-500">Produk tidak ditemukan.</p>}
          </div>
        </section>

        {draf ? (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{draf.nama || 'Produk Baru'}</h2>
                <p className="text-xs text-slate-500">Detail master yang digunakan website, penawaran, dan katalog penjualan.</p>
              </div>
              <button type="button" onClick={hapusProduk} disabled={!bisaUbah || !daftar.some((produk) => produk.id === draf.id)}
                className="rounded-lg border border-rose-200 p-2 text-rose-700 disabled:opacity-40" aria-label="Hapus produk">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <fieldset disabled={!bisaUbah} className="space-y-5 disabled:opacity-70">
              <section className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">Nama produk
                  <input value={draf.nama} onChange={(e) => perbaruiDraf({ nama: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Tipe / model utama
                  <input value={draf.tipeModel} onChange={(e) => perbaruiDraf({ tipeModel: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Grup katalog
                  <input value={draf.kategori} onChange={(e) => perbaruiDraf({ kategori: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Produsen / merek
                  <input value={draf.produsen} onChange={(e) => perbaruiDraf({ produsen: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Negara asal
                  <input value={draf.negaraAsal} onChange={(e) => perbaruiDraf({ negaraAsal: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Kategori regulasi
                  <input value={draf.kategoriRegulasi ?? ''} onChange={(e) => perbaruiDraf({ kategoriRegulasi: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Kelas risiko
                  <input value={draf.kelasRisiko} onChange={(e) => perbaruiDraf({ kelasRisiko: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Tautan brosur
                  <input value={draf.tautanBrosur ?? ''} onChange={(e) => perbaruiDraf({ tautanBrosur: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tautan video
                  <input value={draf.tautanVideo ?? ''} onChange={(e) => perbaruiDraf({ tautanVideo: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Spesifikasi
                  <textarea rows={3} value={draf.spesifikasi} onChange={(e) => perbaruiDraf({ spesifikasi: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Poin jual (satu per baris)
                  <textarea rows={3} value={draf.poinJual.join('\n')} onChange={(e) => perbaruiDraf({ poinJual: e.target.value.split('\n').filter(Boolean) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-700">Foto produk</p>
                  <MedanGambarBanyak
                    nilai={draf.imageUrls?.length ? draf.imageUrls : draf.imageUrl ? [draf.imageUrl] : []}
                    onChange={(imageUrls) => perbaruiDraf({ imageUrls, imageUrl: imageUrls[0] })}
                    petunjuk="Unggah beberapa foto sekaligus atau tambahkan URL. Foto pertama menjadi foto utama; urutan dapat diubah."
                  />
                </div>
                <label className="text-xs font-semibold text-slate-700">Lencana produk
                  <input value={draf.badge ?? ''} onChange={(e) => perbaruiDraf({ badge: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tanya jawab teknis (satu baris: pertanyaan | jawaban)
                  <textarea rows={3} value={(draf.tanyaJawabTeknis ?? []).map((item) => `${item.pertanyaan} | ${item.jawaban}`).join('\n')}
                    onChange={(e) => perbaruiDraf({ tanyaJawabTeknis: e.target.value.split('\n').filter(Boolean).map((baris) => {
                      const [pertanyaan, ...jawaban] = baris.split('|');
                      return { pertanyaan: pertanyaan.trim(), jawaban: jawaban.join('|').trim() };
                    }) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-900">Peruntukan</h3><p className="text-2xs text-slate-500">Satu produk dapat berada di beberapa kelompok.</p></div>
                  <Tag className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set([...PERUNTUKAN_BAWAAN, ...draf.peruntukan])).map((item) => (
                    <label key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs">
                      <input type="checkbox" checked={draf.peruntukan.includes(item)} onChange={(e) => perbaruiDraf({
                        peruntukan: e.target.checked ? [...draf.peruntukan, item] : draf.peruntukan.filter((v) => v !== item)
                      })} />
                      {item}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={peruntukanBaru} onChange={(e) => setPeruntukanBaru(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambahPeruntukan(); } }}
                    placeholder="Tambah peruntukan sendiri" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                  <button type="button" onClick={tambahPeruntukan} className="rounded-lg border border-slate-300 px-3 text-xs font-semibold">Tambah</button>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-900">Varian SKU</h3><p className="text-2xs text-slate-500">Setiap varian punya kode, NIE, harga, dan stok operasional sendiri.</p></div>
                  <button type="button" onClick={() => perbaruiDraf({ varianSku: [...draf.varianSku, varianBaru()] })} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> Tambah SKU</button>
                </div>
                {draf.varianSku.map((varian, index) => (
                  <div key={varian.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">SKU {index + 1} · {formatStok(varian)}</h4>
                      <button type="button" disabled={draf.varianSku.length === 1} onClick={() => perbaruiDraf({ varianSku: draf.varianSku.filter((item) => item.id !== varian.id) })}
                        className="rounded p-1 text-rose-700 disabled:opacity-30" aria-label="Hapus SKU"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ['kodeSKU', 'Kode SKU'],
                        ['tipeModel', 'Model / ukuran / tipe'],
                        ['nomorIzinEdar', 'Nomor izin edar'],
                        ['statusIzinEdar', 'Status izin edar'],
                        ['hargaTayang', 'Harga tayang'],
                        ['referensiHarga', 'Referensi'],
                        ['produsen', 'Produsen (opsional)'],
                        ['negaraAsal', 'Negara asal (opsional)'],
                        ['satuan', 'Satuan'],
                        ['zonaSuhu', 'Zona suhu'],
                        ['imageUrl', 'Foto khusus varian (URL)'],
                        ['tkdn', 'TKDN / status PDN'],
                        ['dokumenUrl', 'Dokumen produk (URL)'],
                        ['tautanLkpp', 'Tautan e-Katalog LKPP']
                      ] as const).map(([field, label]) => (
                        <label key={field} className="text-2xs font-semibold text-slate-600">{label}
                          <input value={varian[field] ?? ''} onChange={(e) => perbaruiVarian(varian.id, { [field]: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </fieldset>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button type="button" onClick={simpan} disabled={!bisaUbah}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                <Check className="h-4 w-4" /> Simpan Produk
              </button>
            </div>
          </section>
        ) : (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-5 text-center">
            <Tag className="h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-sm font-bold text-slate-800">Pilih atau tambahkan produk</h2>
            <p className="mt-1 max-w-sm text-xs text-slate-500">Detail produk disimpan di master ini. CMS Website hanya memilih produk yang akan dipublikasikan.</p>
          </section>
        )}
      </div>
    </div>
  );
}
