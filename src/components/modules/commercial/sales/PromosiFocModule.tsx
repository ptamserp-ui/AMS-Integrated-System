import { useMemo, useState } from 'react';
import { useDbTick } from '../../../../hooks/useDbSync';
import { db } from '../../../../services/pocketbase';
import type { KomponenPaketFOC, PenjualanAlkes, PromosiFOC } from '../../../../types';
import { produkKatalogUntukPenjualan } from '../../../../utils/productCatalog';
import { validasiPromosiFOC } from '../../../../utils/promosiFoc';
import { Badge, Panel, formatTanggal, inputClass, labelClass, tombolBahaya, tombolPrimer, tombolSekunder } from '../../../ui';
import { Plus, Save, X } from 'lucide-react';

const JALUR_PENJUALAN: PenjualanAlkes['jalurPenjualan'][] = [
  'e-Katalog LKPP',
  'Tender RS Pemerintah',
  'Pembelian Langsung RS Swasta',
  'Klinik & Laboratorium'
];

const tanggalHariIni = () => new Date().toISOString().slice(0, 10);

function promosiKosong(): PromosiFOC {
  const id = `FOC-${Date.now()}`;
  return {
    id,
    nama: '',
    aktif: true,
    skuPemicu: '',
    minimumPembelian: 1,
    maksimumKitPerPesanan: 1,
    berlakuMulai: tanggalHariIni(),
    berlakuSampai: `${new Date().getFullYear() + 1}-12-31`,
    jalurPenjualan: [...JALUR_PENJUALAN],
    pelangganIds: [],
    paket: [{ id: `${id}-KIT-1`, nama: '', komponen: [] }]
  };
}

export default function PromosiFocModule({ bolehUbah }: { bolehUbah: boolean }) {
  const dbTick = useDbTick(['sales_promosi_foc', 'product_catalog', 'stok_gudang', 'izin_edar', 'sales_pelanggan']);
  const promosi = useMemo(() => { void dbTick; return db.getPromosiFOC(); }, [dbTick]);
  const pelanggan = useMemo(() => { void dbTick; return db.getPelangganB2B(); }, [dbTick]);
  const produk = useMemo(() => {
    void dbTick;
    const hasil = new Map<string, { kodeSKU: string; namaAlkes: string; satuan: string }>();
    for (const item of produkKatalogUntukPenjualan(db.getProdukKatalog())) {
      if (item.kodeSKU?.trim()) hasil.set(item.kodeSKU.trim(), { kodeSKU: item.kodeSKU.trim(), namaAlkes: item.nama, satuan: item.satuan || 'Unit' });
    }
    for (const item of db.getStokGudang()) {
      if (item.kodeSKU?.trim() && !hasil.has(item.kodeSKU.trim()))
        hasil.set(item.kodeSKU.trim(), { kodeSKU: item.kodeSKU.trim(), namaAlkes: item.namaAlkes, satuan: item.satuan || 'Unit' });
    }
    for (const item of db.getIzinEdar()) {
      if (item.skuCode?.trim() && !hasil.has(item.skuCode.trim()))
        hasil.set(item.skuCode.trim(), { kodeSKU: item.skuCode.trim(), namaAlkes: item.namaAlkes, satuan: 'Unit' });
    }
    return [...hasil.values()].sort((a, b) => a.namaAlkes.localeCompare(b.namaAlkes));
  }, [dbTick]);
  const [draft, setDraft] = useState<PromosiFOC>(() => promosiKosong());
  const [editId, setEditId] = useState<string | null>(null);
  const [galat, setGalat] = useState<string[]>([]);

  const pilihProduk = (sku: string): KomponenPaketFOC => {
    const item = produk.find((entry) => entry.kodeSKU === sku);
    return { kodeSKU: sku, namaAlkes: item?.namaAlkes ?? '', qtyPerKit: 1, satuan: item?.satuan ?? 'Unit' };
  };

  const simpan = (event: React.FormEvent) => {
    event.preventDefault();
    if (!bolehUbah) return;
    const sebab = validasiPromosiFOC(draft);
    if (sebab.length) {
      setGalat(sebab);
      return;
    }
    const daftarBaru = editId
      ? promosi.map((item) => item.id === editId ? { ...draft } : item)
      : [{ ...draft }, ...promosi];
    db.savePromosiFOC(daftarBaru);
    setDraft(promosiKosong());
    setEditId(null);
    setGalat([]);
  };

  const ubahStatus = (item: PromosiFOC) => {
    if (!bolehUbah) return;
    db.savePromosiFOC(promosi.map((promosiLama) => promosiLama.id === item.id ? { ...item, aktif: !item.aktif } : item));
  };

  const mulaiEdit = (item: PromosiFOC) => {
    setDraft({ ...item, paket: item.paket.map((paket) => ({ ...paket, komponen: paket.komponen.map((c) => ({ ...c })) })) });
    setEditId(item.id);
    setGalat([]);
  };

  const tambahPaket = () => setDraft((sebelum) => ({
    ...sebelum,
    paket: [...sebelum.paket, { id: `${sebelum.id}-KIT-${Date.now()}`, nama: '', komponen: [] }]
  }));

  const ubahPaket = (id: string, patch: Partial<PromosiFOC['paket'][number]>) =>
    setDraft((sebelum) => ({ ...sebelum, paket: sebelum.paket.map((paket) => paket.id === id ? { ...paket, ...patch } : paket) }));

  const tambahKomponen = (paketId: string) =>
    setDraft((sebelum) => ({
      ...sebelum,
      paket: sebelum.paket.map((paket) =>
        paket.id === paketId ? { ...paket, komponen: [...paket.komponen, pilihProduk(produk[0]?.kodeSKU ?? '')] } : paket
      )
    }));

  const ubahKomponen = (paketId: string, index: number, patch: Partial<KomponenPaketFOC>) =>
    setDraft((sebelum) => ({
      ...sebelum,
      paket: sebelum.paket.map((paket) => paket.id === paketId
        ? { ...paket, komponen: paket.komponen.map((komponen, nomor) => nomor === index ? { ...komponen, ...patch } : komponen) }
        : paket)
    }));

  return (
    <div className="space-y-4">
      <Panel
        judul="Konfigurasi Promosi FOC & Sales Kit"
        keterangan="Atur SKU pemicu, minimum pembelian, komposisi paket, batas kit per pesanan, periode, kanal, dan pelanggan sasaran. Pilihan SKU diambil dari katalog, izin edar, dan stok yang sudah terdaftar."
      >
        {!bolehUbah && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Hak lihat aktif. Perubahan konfigurasi hanya dapat dilakukan pengguna dengan izin pembaruan modul Sales &amp; Marketing.
          </div>
        )}
        {produk.length === 0 && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            Belum ada produk dengan SKU pada katalog, izin edar, atau kartu stok. Tambahkan master produk lebih dahulu; sistem tidak menerima SKU placeholder.
          </div>
        )}
        <form onSubmit={simpan} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Nama Promosi</label>
              <input required className={inputClass} value={draft.nama} onChange={(e) => setDraft({ ...draft, nama: e.target.value })} disabled={!bolehUbah} />
            </div>
            <div>
              <label className={labelClass}>SKU Produk Pemicu</label>
              <select required className={inputClass} value={draft.skuPemicu} onChange={(e) => setDraft({ ...draft, skuPemicu: e.target.value })} disabled={!bolehUbah}>
                <option value="">Pilih SKU pemicu</option>
                {produk.map((item) => <option key={item.kodeSKU} value={item.kodeSKU}>{item.namaAlkes} · {item.kodeSKU}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Minimum Pembelian</label>
                <input type="number" min={1} step={1} required className={inputClass} value={draft.minimumPembelian} onChange={(e) => setDraft({ ...draft, minimumPembelian: Number(e.target.value) })} disabled={!bolehUbah} />
              </div>
              <div>
                <label className={labelClass}>Maksimum Kit per Pesanan</label>
                <input type="number" min={1} step={1} required className={inputClass} value={draft.maksimumKitPerPesanan} onChange={(e) => setDraft({ ...draft, maksimumKitPerPesanan: Number(e.target.value) })} disabled={!bolehUbah} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Berlaku Mulai</label>
                <input type="date" required className={inputClass} value={draft.berlakuMulai} onChange={(e) => setDraft({ ...draft, berlakuMulai: e.target.value })} disabled={!bolehUbah} />
              </div>
              <div>
                <label className={labelClass}>Berlaku Sampai</label>
                <input type="date" required className={inputClass} value={draft.berlakuSampai} onChange={(e) => setDraft({ ...draft, berlakuSampai: e.target.value })} disabled={!bolehUbah} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Kanal Penjualan (kosong = semua kanal)</label>
              <select
                multiple
                size={4}
                className={`${inputClass} h-auto`}
                value={draft.jalurPenjualan}
                onChange={(e) => setDraft({ ...draft, jalurPenjualan: Array.from(e.currentTarget.selectedOptions, (option) => option.value as PenjualanAlkes['jalurPenjualan']) })}
                disabled={!bolehUbah}
              >
                {JALUR_PENJUALAN.map((jalur) => <option key={jalur} value={jalur}>{jalur}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Pelanggan Sasaran (kosong = semua pelanggan)</label>
              <select
                multiple
                size={4}
                className={`${inputClass} h-auto`}
                value={draft.pelangganIds}
                onChange={(e) => setDraft({ ...draft, pelangganIds: Array.from(e.currentTarget.selectedOptions, (option) => option.value) })}
                disabled={!bolehUbah}
              >
                {pelanggan.map((item) => <option key={item.id} value={item.id}>{item.namaInstalasi} · {item.kodePelanggan}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Pilihan Paket &amp; Komponen</h3>
              {bolehUbah && <button type="button" className={tombolSekunder} onClick={tambahPaket}><Plus className="w-3.5 h-3.5" />Tambah pilihan kit</button>}
            </div>
            {draft.paket.map((paket) => (
              <div key={paket.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                <div className="flex gap-2">
                  <input required className={inputClass} placeholder="Nama paket (mis. Complimentary B+)" value={paket.nama} onChange={(e) => ubahPaket(paket.id, { nama: e.target.value })} disabled={!bolehUbah} />
                  {bolehUbah && draft.paket.length > 1 && <button type="button" title="Hapus kit" className={tombolBahaya} onClick={() => setDraft({ ...draft, paket: draft.paket.filter((item) => item.id !== paket.id) })}><X className="w-4 h-4" /></button>}
                </div>
                {paket.komponen.map((komponen, index) => (
                  <div key={`${paket.id}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_auto] gap-2 items-end">
                    <div>
                      <label className={labelClass}>Produk Komponen</label>
                      <select
                        required
                        className={inputClass}
                        value={komponen.kodeSKU}
                        onChange={(e) => ubahKomponen(paket.id, index, pilihProduk(e.target.value))}
                        disabled={!bolehUbah}
                      >
                        <option value="">Pilih produk</option>
                        {produk.map((item) => <option key={item.kodeSKU} value={item.kodeSKU}>{item.namaAlkes} · {item.kodeSKU}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Qty / Kit</label>
                      <input type="number" min={1} step={1} required className={inputClass} value={komponen.qtyPerKit} onChange={(e) => ubahKomponen(paket.id, index, { qtyPerKit: Number(e.target.value) })} disabled={!bolehUbah} />
                    </div>
                    <div>
                      <label className={labelClass}>Satuan</label>
                      <input required className={inputClass} value={komponen.satuan} onChange={(e) => ubahKomponen(paket.id, index, { satuan: e.target.value })} disabled={!bolehUbah} />
                    </div>
                    {bolehUbah && <button type="button" title="Hapus komponen" className={tombolBahaya} onClick={() => ubahPaket(paket.id, { komponen: paket.komponen.filter((_, nomor) => nomor !== index) })}><X className="w-4 h-4" /></button>}
                  </div>
                ))}
                {bolehUbah && <button type="button" className={tombolSekunder} onClick={() => tambahKomponen(paket.id)} disabled={produk.length === 0}><Plus className="w-3.5 h-3.5" />Tambah komponen</button>}
              </div>
            ))}
          </div>

          {galat.length > 0 && (
            <ul className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 list-disc pl-7">
              {galat.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          {bolehUbah && (
            <div className="flex gap-2">
              <button type="submit" className={tombolPrimer}><Save className="w-4 h-4" />{editId ? 'Simpan perubahan' : 'Simpan promosi'}</button>
              {editId && <button type="button" className={tombolSekunder} onClick={() => { setDraft(promosiKosong()); setEditId(null); setGalat([]); }}>Batal</button>}
            </div>
          )}
        </form>
      </Panel>

      <Panel judul="Promosi FOC Terdaftar" keterangan="Menonaktifkan promosi mempertahankan riwayat transaksi dan snapshot paket pada pesanan yang telah dibuat.">
        <div className="space-y-2">
          {promosi.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2"><strong className="text-sm text-slate-900">{item.nama}</strong><Badge tone={item.aktif ? 'emerald' : 'slate'}>{item.aktif ? 'Aktif' : 'Nonaktif'}</Badge></div>
                <div className="text-xs text-slate-600">
                  Pemicu {item.skuPemicu} · minimal {item.minimumPembelian} · maks {item.maksimumKitPerPesanan} kit · {formatTanggal(item.berlakuMulai)}—{formatTanggal(item.berlakuSampai)}
                </div>
                <div className="text-2xs text-slate-500">{item.paket.map((paket) => `${paket.nama}: ${paket.komponen.map((c) => `${c.qtyPerKit} ${c.satuan} ${c.namaAlkes}`).join(', ')}`).join(' | ')}</div>
              </div>
              {bolehUbah && (
                <div className="flex gap-2">
                  <button type="button" className={tombolSekunder} onClick={() => mulaiEdit(item)}>Ubah</button>
                  <button type="button" className={item.aktif ? tombolBahaya : tombolSekunder} onClick={() => ubahStatus(item)}>{item.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                </div>
              )}
            </div>
          ))}
          {promosi.length === 0 && <p className="text-xs text-slate-500">Belum ada konfigurasi promosi FOC.</p>}
        </div>
      </Panel>
    </div>
  );
}
