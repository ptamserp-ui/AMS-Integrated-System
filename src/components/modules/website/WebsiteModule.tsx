/**
 * DASHBOARD WEBSITE — CMS konten situs publik AMS.
 *
 * Semua isi halaman /web disunting di sini: identitas & SEO, navigasi, hero, setiap seksi
 * daftar, kontak, hingga footer. Draf tersimpan terpisah dari snapshot tayang, dan setiap
 * penyimpanan/sinkronisasi/penerbitan tercatat pada jejak audit dengan nilai lama & baru.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import DeveloperNotes from '../../common/DeveloperNotes';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  Globe,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Monitor,
  Palette,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Tablet,
  UploadCloud
} from 'lucide-react';
import { KonfigurasiSitus, ProdukWebsite, SeksiDaftar, UserRole } from '../../../types';
import { authFetch, punyaIzin, type SesiLogin } from '../../../utils/autentikasi';
import { db } from '../../../services/pocketbase';
import { produkKatalogUntukWebsite } from '../../../utils/productCatalog';
import { selesaikanGambar } from '../../../utils/website';
import { namaPengguna, peranPengguna } from '../../layout/Navbar';
import {
  BAGIAN_WEBSITE,
  OBJEK_WEBSITE,
  POLOS_WEBSITE,
  jumlahButir,
  type ItemLoose,
  type KunciDaftar,
  type KunciEditorSitus,
  type KunciObjek,
  type KunciPolos
} from './skema';
import { EditorObjek, EditorPolos, EditorSeksiDaftar, EditorTeksPolos } from './editor/sectionsEditor';
import { EditorTampilan, EditorTataLetak } from './editor/tampilanEditor';
import { Badge, Panel, Stat, tombolPrimer, tombolSekunder, chipFilter, formatTanggal } from '../../ui';

interface PropsWebsite {
  currentRole: UserRole;
  sesi?: SesiLogin;
}

const GRUP_RAIL: { judul: string; kunci: KunciEditorSitus[] }[] = [
  {
    judul: 'Template & Tampilan',
    kunci: ['tampilan', 'tataLetak']
  },
  {
    judul: 'Identitas & Navigasi',
    kunci: ['identitas', 'header', 'menu', 'footerKolom', 'footerCatatan']
  },
  {
    judul: 'Konten Beranda',
    kunci: ['hero', 'slide', 'kepercayaan', 'solusi', 'konsultasi', 'statistik', 'merek', 'perjalanan', 'institusi', 'kegiatan', 'promo']
  },
  {
    judul: 'Katalog & Sumber Daya',
    kunci: ['produk', 'artikel', 'galeri', 'testimoni', 'faq', 'tentang', 'kantor', 'kontak', 'sosial']
  }
];

const LABEL_RAIL: Record<string, string> = (() => {
  const peta: Record<string, string> = { footerCatatan: 'Catatan Footer', tampilan: 'Template, Warna & Font', tataLetak: 'Susunan Seksi Beranda' };
  BAGIAN_WEBSITE.forEach((b) => (peta[b.kunci] = b.label));
  OBJEK_WEBSITE.forEach((b) => (peta[b.kunci] = b.label));
  POLOS_WEBSITE.forEach((b) => (peta[b.kunci] = b.label));
  return peta;
})();

const IKON_RAIL: Record<string, ComponentType<{ className?: string }>> = (() => {
  const peta: Record<string, ComponentType<{ className?: string }>> = { footerCatatan: Pencil, tampilan: Palette, tataLetak: LayoutGrid };
  BAGIAN_WEBSITE.forEach((b) => (peta[b.kunci] = b.ikon));
  OBJEK_WEBSITE.forEach((b) => (peta[b.kunci] = b.ikon));
  POLOS_WEBSITE.forEach((b) => (peta[b.kunci] = b.ikon));
  return peta;
})();

/** Hanya peran ini yang boleh mengubah status tayang situs publik. */
const PERAN_PENERBIT: UserRole[] = ['pjt', 'it_admin'];

const PERANGKAT = {
  desktop: { label: 'Desktop', lebar: 1440, ikon: Monitor },
  tablet: { label: 'Tablet', lebar: 834, ikon: Tablet },
  mobile: { label: 'Ponsel', lebar: 390, ikon: Smartphone }
} as const;

type Mode = 'sunting' | 'pratinjau' | 'jejak';

const tanpaMeta = (cfg: KonfigurasiSitus) => {
  const { lastModifiedAt: _m, lastPublishedAt: _p, isPublished: _i, ...isi } = cfg;
  return JSON.stringify(isi);
};

function sinkronkanProdukKatalog(cfg: KonfigurasiSitus): KonfigurasiSitus {
  return {
    ...cfg,
    produk: {
      ...cfg.produk,
      item: produkKatalogUntukWebsite(db.getProdukKatalog(), cfg.produk.item)
    }
  };
}

function adalahProdukInputBaru(produk: ProdukWebsite): boolean {
  return !produk.sumberId?.startsWith('daftar-harga-ams-v6:');
}

function EditorPemilihProduk({
  seksi,
  bolehUbah,
  onGanti
}: {
  seksi: SeksiDaftar<ProdukWebsite>;
  bolehUbah: boolean;
  onGanti: (seksi: SeksiDaftar<ProdukWebsite>) => void;
}) {
  const [cari, setCari] = useState('');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'baru' | 'publish' | 'draft'>('semua');
  const [previewId, setPreviewId] = useState(seksi.item[0]?.id ?? '');
  const [gagalPreviewFoto, setGagalPreviewFoto] = useState(false);

  const jumlahBaru = useMemo(
    () => seksi.item.filter(adalahProdukInputBaru).length,
    [seksi.item]
  );
  const terbit = useMemo(
    () => seksi.item.filter((produk) => produk.isActive).length,
    [seksi.item]
  );
  const itemTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return seksi.item.filter((produk) => {
      if (filterStatus === 'baru' && !adalahProdukInputBaru(produk)) return false;
      if (filterStatus === 'publish' && !produk.isActive) return false;
      if (filterStatus === 'draft' && produk.isActive) return false;
      if (!q) return true;
      const skuTeks = (produk.varianSku ?? [])
        .map((v) => `${v.kodeSKU} ${v.tipeModel} ${v.nomorIzinEdar}`)
        .join(' ');
      return `${produk.nama} ${produk.tipeModel} ${produk.kategori} ${produk.produsen} ${produk.nomorIzinEdar} ${produk.kodeSKU ?? ''} ${skuTeks}`
        .toLowerCase()
        .includes(q);
    });
  }, [cari, filterStatus, seksi.item]);

  const produkPreview =
    itemTersaring.find((produk) => produk.id === previewId) ??
    seksi.item.find((produk) => produk.id === previewId) ??
    itemTersaring[0] ??
    seksi.item[0];
  const fotoUtama = produkPreview
    ? selesaikanGambar(produkPreview.imageUrls?.[0] ?? produkPreview.imageUrl)
    : undefined;

  useEffect(() => {
    setGagalPreviewFoto(false);
  }, [fotoUtama, produkPreview?.id]);

  useEffect(() => {
    if (seksi.item.some((produk) => produk.id === previewId)) return;
    setPreviewId(seksi.item[0]?.id ?? '');
  }, [previewId, seksi.item]);

  const terapkanStatusMassal = (aktifBaru: boolean) => {
    const ids = new Set(itemTersaring.map((p) => p.id));
    if (ids.size === 0) return;
    onGanti({
      ...seksi,
      item: seksi.item.map((item) => (ids.has(item.id) ? { ...item, isActive: aktifBaru } : item))
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-blue-950">Pilih produk untuk dipublikasikan</h3>
            <p className="mt-1 text-xs leading-relaxed text-blue-900">
              Seluruh produk yang diinput di <strong>Commercial → Product Catalog</strong> otomatis muncul di daftar ini.
              Centang produk yang ingin ditayangkan lalu klik <strong>Terbitkan</strong>.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={seksi.isActive}
              disabled={!bolehUbah}
              onChange={(e) => onGanti({ ...seksi, isActive: e.target.checked })}
              className="h-4 w-4 accent-slate-800"
            />
            Tampilkan seksi Katalog di situs
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-200/70">
          <p className="text-xs font-semibold text-blue-950 tabular-nums">
            {terbit} dari {seksi.item.length} produk berstatus Publish
            {jumlahBaru > 0 && <span className="ml-2 text-blue-800">· {jumlahBaru} Input Baru / Custom</span>}
          </p>
          {bolehUbah && itemTersaring.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => terapkanStatusMassal(true)}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-2xs font-bold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
              >
                Publish Terfilter ({itemTersaring.length})
              </button>
              <button
                type="button"
                onClick={() => terapkanStatusMassal(false)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-2xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Jadikan Draft
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama produk, tipe/model, kode SKU, NIE, atau produsen…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            { id: 'semua', label: `Semua (${seksi.item.length})` },
            { id: 'baru', label: `Input Baru (${jumlahBaru})` },
            { id: 'publish', label: `Publish (${terbit})` },
            { id: 'draft', label: `Draft (${seksi.item.length - terbit})` }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-2xs font-semibold transition-colors cursor-pointer ${
                filterStatus === tab.id
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {itemTersaring.map((produk) => {
            const inputBaru = adalahProdukInputBaru(produk);
            return (
              <div
                key={produk.id}
                className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${
                  produkPreview?.id === produk.id ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Publikasikan ${produk.nama || 'produk tanpa nama'}`}
                  checked={produk.isActive}
                  disabled={!bolehUbah}
                  onChange={(e) => onGanti({
                    ...seksi,
                    item: seksi.item.map((item) => item.id === produk.id ? { ...item, isActive: e.target.checked } : item)
                  })}
                  className="h-4 w-4 shrink-0 accent-slate-800 cursor-pointer"
                />
                <button
                  type="button"
                  aria-pressed={produkPreview?.id === produk.id}
                  onClick={() => setPreviewId(produk.id)}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-slate-900">{produk.nama || '(tanpa nama)'}</span>
                    {inputBaru && (
                      <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-3xs font-bold text-blue-700">
                        Input Baru
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-2xs text-slate-500">
                    {[
                      produk.tipeModel,
                      produk.kategori,
                      produk.produsen,
                      produk.hargaTayang || produk.varianSku?.[0]?.hargaTayang
                    ].filter(Boolean).join(' · ') || 'Belum ada keterangan'}
                  </span>
                  {produk.varianSku && produk.varianSku.length > 0 && (
                    <span className="mt-1 block truncate text-2xs text-slate-500">
                      {produk.varianSku.length} SKU ({produk.varianSku.map((v) => v.kodeSKU).filter(Boolean).slice(0, 3).join(', ')})
                      {(produk.nomorIzinEdar || produk.varianSku[0]?.nomorIzinEdar) ? ` · NIE ${produk.nomorIzinEdar || produk.varianSku[0]?.nomorIzinEdar}` : ''}
                    </span>
                  )}
                </button>
                <span className={`shrink-0 rounded-md px-2 py-1 text-2xs font-bold ${produk.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {produk.isActive ? 'Publish' : 'Draft'}
                </span>
              </div>
            );
          })}
          {itemTersaring.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              {seksi.item.length === 0
                ? 'Belum ada produk tersimpan di Product Catalog.'
                : 'Tidak ada produk yang cocok dengan pencarian atau filter ini.'}
            </p>
          )}
        </div>
        <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Foto utama · 400 × 400</h4>
            <p className="mt-1 truncate text-xs text-slate-500">{produkPreview?.nama || 'Pilih produk untuk melihat foto'}</p>
          </div>
          <div className="mx-auto flex aspect-square w-full max-w-[400px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {fotoUtama && !gagalPreviewFoto
              ? (
                <img
                  src={fotoUtama}
                  alt={`Foto utama ${produkPreview?.nama ?? 'produk'}`}
                  loading="lazy"
                  onError={() => setGagalPreviewFoto(true)}
                  className="h-full w-full object-contain"
                />
              )
              : (
                <div className="flex flex-col items-center gap-2 px-4 text-center text-slate-400">
                  <ImageIcon className="h-10 w-10" />
                  <span className="text-xs">
                    {fotoUtama ? 'Foto tidak dapat dimuat dari server media.' : 'Foto utama belum ditambahkan di Product Catalog.'}
                  </span>
                </div>
              )}
          </div>
          {produkPreview && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-2xs">
              <div>
                <dt className="text-slate-400 font-semibold">Kode SKU Utama</dt>
                <dd className="text-slate-800 font-mono truncate">{produkPreview.kodeSKU || produkPreview.varianSku?.[0]?.kodeSKU || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold">Harga Tayang</dt>
                <dd className="text-slate-800 font-semibold truncate">{produkPreview.hargaTayang || produkPreview.varianSku?.[0]?.hargaTayang || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold">Nomor Izin Edar</dt>
                <dd className="text-slate-800 font-mono truncate">{produkPreview.nomorIzinEdar || produkPreview.varianSku?.[0]?.nomorIzinEdar || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold">Kategori</dt>
                <dd className="text-slate-800 truncate">{produkPreview.kategori || '-'}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function WebsiteModule({ currentRole, sesi }: PropsWebsite) {
  const [draf, setDraf] = useState<KonfigurasiSitus>(() => sinkronkanProdukKatalog(db.getWebsiteDraft()));
  const drafRef = useRef(draf);
  drafRef.current = draf;
  const [baseline, setBaseline] = useState<string>(() => tanpaMeta(sinkronkanProdukKatalog(db.getWebsiteDraft())));
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const sedangSimpanLokalRef = useRef(false);
  const [drafRemoteTerbaru, setDrafRemoteTerbaru] = useState(false);
  const [terbit, setTerbit] = useState<KonfigurasiSitus | null>(() => db.getWebsiteTerbit());
  const [kunci, setKunci] = useState<KunciEditorSitus>('identitas');
  const [mode, setMode] = useState<Mode>('sunting');
  const [perangkat, setPerangkat] = useState<keyof typeof PERANGKAT>('desktop');
  const [pesan, setPesan] = useState<{ nada: 'ok' | 'waspada'; teks: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSiap = useRef(false);

  const pengguna = sesi?.namaLengkap || namaPengguna(currentRole);
  const peran = sesi?.namaPeran || peranPengguna(currentRole);
  const bolehTerbit = sesi
    ? punyaIzin(sesi, 'website', 'publish')
    : PERAN_PENERBIT.includes(currentRole);
  const bolehUbahPilihanProduk = sesi ? punyaIzin(sesi, 'website', 'update') : true;

  useEffect(() => {
    const berhentiTerbit = db.subscribe('website_published', () => setTerbit(db.getWebsiteTerbit()));
    const berhentiDraf = db.subscribe('website_draft', () => {
      if (sedangSimpanLokalRef.current) return;
      const terbaru = sinkronkanProdukKatalog(db.getWebsiteDraft());
      const metaBaru = tanpaMeta(terbaru);
      const curMeta = tanpaMeta(drafRef.current);
      if (metaBaru === curMeta) {
        if (metaBaru !== baselineRef.current) {
          baselineRef.current = metaBaru;
          setBaseline(metaBaru);
        }
        setDrafRemoteTerbaru(false);
        return;
      }
      if (curMeta === baselineRef.current) {
        baselineRef.current = metaBaru;
        drafRef.current = terbaru;
        setDraf(terbaru);
        setBaseline(metaBaru);
        setDrafRemoteTerbaru(false);
      } else {
        setDrafRemoteTerbaru(true);
      }
    });
    const berhentiKatalog = db.subscribe('product_catalog', () => {
      if (sedangSimpanLokalRef.current) return;
      const cur = drafRef.current;
      const curTanpaEditLokal = tanpaMeta(cur) === baselineRef.current;
      const next = sinkronkanProdukKatalog(cur);
      const nextMeta = tanpaMeta(next);
      drafRef.current = next;
      setDraf(next);
      if (curTanpaEditLokal) {
        baselineRef.current = nextMeta;
        setBaseline(nextMeta);
        setDrafRemoteTerbaru(false);
      }
    });
    return () => {
      berhentiTerbit();
      berhentiDraf();
      berhentiKatalog();
    };
  }, []);

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 6000);
    return () => clearTimeout(t);
  }, [pesan]);

  const belumTersimpan = tanpaMeta(draf) !== baseline;
  const belumTerbit = terbit ? tanpaMeta(draf) !== tanpaMeta(terbit) : true;

  const tandaiTersimpan = useCallback((cfg: KonfigurasiSitus) => {
    const meta = tanpaMeta(cfg);
    drafRef.current = cfg;
    baselineRef.current = meta;
    setDraf(cfg);
    setBaseline(meta);
    setDrafRemoteTerbaru(false);
  }, []);

  const simpan = () => {
    sedangSimpanLokalRef.current = true;
    try {
      const hasil = db.simpanWebsiteDraft(draf, pengguna, peran);
      tandaiTersimpan(hasil);
      setPesan({ nada: 'ok', teks: 'Draf konten tersimpan & tersinkronisasi ke server. Jejak perubahan tercatat pada audit trail.' });
    } finally {
      sedangSimpanLokalRef.current = false;
    }
  };

  const sinkron = () => {
    sedangSimpanLokalRef.current = true;
    try {
      const { baru } = db.sinkronkanWebsiteDraft(pengguna, peran);
      const diselaraskan = sinkronkanProdukKatalog(baru);
      tandaiTersimpan(diselaraskan);
      const jumlah = BAGIAN_WEBSITE.filter((b) => b.dinamis).reduce((acc, b) => acc + jumlahButir(diselaraskan, b.kunci), 0);
      setPesan({
        nada: 'ok',
        teks: `Sinkron selesai — ${jumlah} butir konten (termasuk Product Catalog) dibangun ulang dari data aplikasi.`
      });
    } finally {
      sedangSimpanLokalRef.current = false;
    }
  };

  /** Snapshot dikirim ke server agar /web tayang lintas perangkat; hosting statis memakai berkas unduhan. */
  const kirimSnapshot = async (snapshot: KonfigurasiSitus): Promise<{ ok: boolean; pesan?: string; status?: number }> => {
    try {
      const jawaban = await authFetch('/api/website/published', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Client-Id': db.getClientId()
        },
        body: JSON.stringify({ config: snapshot })
      });
      const data = (await jawaban.json().catch(() => ({}))) as { pesan?: string };
      return { ok: jawaban.ok, status: jawaban.status, pesan: data.pesan };
    } catch {
      return { ok: false };
    }
  };

  const terbitkan = async () => {
    let snapshot: KonfigurasiSitus;
    sedangSimpanLokalRef.current = true;
    try {
      db.simpanWebsiteDraft(draf, pengguna, peran);
      snapshot = db.terbitkanWebsite(pengguna, peran);
      tandaiTersimpan(db.getWebsiteDraft());
      setTerbit(snapshot);
    } finally {
      sedangSimpanLokalRef.current = false;
    }
    const hasil = await kirimSnapshot(snapshot);
    setPesan({
      nada: hasil.ok ? 'ok' : 'waspada',
      teks: hasil.ok
        ? 'Konten tayang. Snapshot server diperbarui (terotorisasi RBAC) dan penerbitan tercatat di audit trail.'
        : hasil.status === 401 || hasil.status === 403
          ? hasil.pesan || 'Ditolak oleh RBAC server: Anda tidak memiliki izin publish website.'
          : 'Konten tayang pada perangkat ini. Snapshot server tidak tersedia (hosting statis) — pakai Unduh Snapshot JSON lalu unggah sebagai website-published.json.'
    });
  };

  const tahan = () => {
    sedangSimpanLokalRef.current = true;
    try {
      const tersisa = db.tahanWebsite(pengguna, peran);
      setTerbit(tersisa);
      tandaiTersimpan(db.getWebsiteDraft());
      void kirimSnapshot(tersisa ?? { ...draf, isPublished: false });
      setPesan({ nada: 'waspada', teks: 'Situs publik ditahan. Pengunjung melihat pesan non-aktif sampai penerbitan berikutnya.' });
    } finally {
      sedangSimpanLokalRef.current = false;
    }
  };

  const unduh = () => {
    const isi = JSON.stringify(terbit ?? draf, null, 2);
    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(new Blob([isi], { type: 'application/json' }));
    tautan.download = 'website-published.json';
    tautan.click();
    URL.revokeObjectURL(tautan.href);
    setPesan({ nada: 'ok', teks: 'website-published.json diunduh. Letakkan di folder public/ atau unggah lewat panel Storage situs.' });
  };

  /** Kirim draf ke iframe pratinjau setiap kali konten atau kesiapan iframe berubah. */
  useEffect(() => {
    if (mode !== 'pratinjau') {
      iframeSiap.current = false;
      return;
    }
    if (!iframeSiap.current) return;
    const t = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'ams-website-pratinjau', konfigurasi: draf }, window.location.origin);
    }, 250);
    return () => clearTimeout(t);
  }, [draf, mode]);

  useEffect(() => {
    const terima = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if ((e.data as { type?: string })?.type !== 'ams-website-pratinjau-siap') return;
      iframeSiap.current = true;
      iframeRef.current?.contentWindow?.postMessage({ type: 'ams-website-pratinjau', konfigurasi: draf }, window.location.origin);
    };
    window.addEventListener('message', terima);
    return () => window.removeEventListener('message', terima);
  }, [draf]);

  const jejak = useMemo(
    () => db.getAuditTrail().filter((l) => l.modul?.startsWith('Website')).slice(0, 12),
    // baseline/terbit ikut memicu pembaruan daftar jejak
    [baseline, terbit, mode]
  );

  const nilaiSeksi = (k: KunciEditorSitus) => (draf as unknown as Record<string, unknown>)[k];
  const gantiSeksi = (k: KunciEditorSitus, nilai: unknown) => setDraf({ ...(draf as KonfigurasiSitus), [k]: nilai } as KonfigurasiSitus);

  const seksiAktif = useMemo(
    () => BAGIAN_WEBSITE.filter((b) => (nilaiSeksi(b.kunci) as SeksiDaftar<ItemLoose>)?.isActive).length,
    [draf]
  );

  const statusTayang = !terbit
    ? { label: 'Belum pernah tayang', nada: 'slate' as const }
    : terbit.isPublished
      ? { label: 'Tayang', nada: 'emerald' as const }
      : { label: 'Ditahan', nada: 'amber' as const };

  const kunciRail = GRUP_RAIL.flatMap((g) => g.kunci);
  const totalButir = kunciRail.reduce((acc, k) => acc + jumlahButir(draf, k), 0);

  /** Dipanggil sebagai fungsi (bukan komponen) agar state kartu item tidak hilang saat mengetik. */
  const renderEditor = () => {
    if (kunci === 'tampilan') {
      return <EditorTampilan cfg={draf} onGanti={(t) => setDraf({ ...draf, tampilan: t })} />;
    }
    if (kunci === 'tataLetak') {
      return <EditorTataLetak cfg={draf} onGanti={(t) => setDraf({ ...draf, tampilan: t })} />;
    }
    const bagian = BAGIAN_WEBSITE.find((b) => b.kunci === kunci);
    if (bagian) {
      if (bagian.kunci === 'produk') {
        return (
          <EditorPemilihProduk
            seksi={nilaiSeksi('produk') as SeksiDaftar<ProdukWebsite>}
            bolehUbah={bolehUbahPilihanProduk}
            onGanti={(baru) => gantiSeksi('produk', baru)}
          />
        );
      }
      return (
        <EditorSeksiDaftar
          def={bagian}
          seksi={nilaiSeksi(bagian.kunci) as SeksiDaftar<ItemLoose>}
          onGanti={(baru) => gantiSeksi(bagian.kunci as KunciDaftar, baru)}
        />
      );
    }
    const objek = OBJEK_WEBSITE.find((b) => b.kunci === kunci);
    if (objek) {
      return (
        <EditorObjek
          def={objek}
          objek={nilaiSeksi(objek.kunci) as Record<string, unknown>}
          onGanti={(baru) => gantiSeksi(objek.kunci as KunciObjek, baru)}
        />
      );
    }
    const polos = POLOS_WEBSITE.find((b) => b.kunci === kunci);
    if (polos) {
      return (
        <EditorPolos
          def={polos}
          daftar={(nilaiSeksi(polos.kunci) as Record<string, unknown>[]) ?? []}
          onGanti={(baru) => gantiSeksi(polos.kunci as KunciPolos, baru)}
        />
      );
    }
    return (
      <EditorTeksPolos
        judul="Catatan Footer"
        petunjuk="Baris hak cipta dan keterangan legal di bagian paling bawah situs."
        nilai={String(nilaiSeksi('footerCatatan') ?? '')}
        onGanti={(v) => gantiSeksi('footerCatatan', v)}
      />
    );
  };

  return (
    <div className="space-y-6">
      <DeveloperNotes
        items={[
          'Simpan Draf dan Terbitkan disinkronkan real-time ke server & seluruh user melalui WebSocket + RBAC sesi aktif.',
          'Live Preview memakai draf editor aktif; pengunjung /web langsung menerima pembaruan saat Terbitkan atau saat Product Catalog diperbarui.',
          'Produk dari menu Commercial → Product Catalog otomatis muncul di Katalog Produk CMS Website untuk dipilih (Publish/Draft).'
        ]}
      />
      {/* ================= STATUS KONTEN ================= */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-emerald-700" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Konten Situs Publik (Website CMS)</h2>
                <Badge tone={statusTayang.nada}>{statusTayang.label}</Badge>
                {belumTerbit && <Badge tone="blue">perubahan belum terbit</Badge>}
                {belumTersimpan && <Badge tone="amber">draf belum disimpan</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {OBJEK_WEBSITE.length + BAGIAN_WEBSITE.length + POLOS_WEBSITE.length} kelompok konten · {seksiAktif} dari{' '}
                {BAGIAN_WEBSITE.length} seksi daftar tampil · terakhir disunting{' '}
                {new Date(draf.lastModifiedAt).toLocaleString('id-ID')} oleh {draf.lastModifiedBy ?? pengguna}
                {terbit?.lastPublishedAt ? ` · terbit ${new Date(terbit.lastPublishedAt).toLocaleString('id-ID')}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <button
              type="button"
              onClick={simpan}
              disabled={!belumTersimpan}
              className={`inline-flex items-center gap-1.5 ${tombolPrimer} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Draf
            </button>
            <button
              type="button"
              onClick={sinkron}
              className={`inline-flex items-center gap-1.5 ${tombolSekunder}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sinkron dari Data Aplikasi
            </button>
            {terbit?.isPublished && belumTerbit && (
              <button
                type="button"
                onClick={terbitkan}
                disabled={!bolehTerbit}
                title={bolehTerbit ? undefined : 'Hanya PJT / Admin IT yang dapat menerbitkan'}
                className={`inline-flex items-center gap-1.5 ${tombolPrimer} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Terbitkan
              </button>
            )}
            {terbit?.isPublished ? (
              <button
                type="button"
                onClick={tahan}
                disabled={!bolehTerbit}
                title={bolehTerbit ? undefined : 'Hanya PJT / Admin IT yang dapat menahan tayang'}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Tahan Situs
              </button>
            ) : (
              <button
                type="button"
                onClick={terbitkan}
                disabled={!bolehTerbit}
                title={bolehTerbit ? undefined : 'Hanya PJT / Admin IT yang dapat menerbitkan'}
                className={`inline-flex items-center gap-1.5 ${tombolPrimer} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Terbitkan
              </button>
            )}
            <button
              type="button"
              onClick={unduh}
              className={`inline-flex items-center gap-1.5 ${tombolSekunder}`}
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Snapshot JSON
            </button>
            <a
              href="/web/"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 ${tombolSekunder}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Halaman /web
            </a>
          </div>
        </div>

        {!bolehTerbit && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <p className="text-xs text-slate-600">
              Peran {peran} dapat menyunting dan menyimpan draf; penerbitan konten tayang dikhususkan untuk PJT dan Admin IT
              dan tercatat dengan nama pengguna pada jejak audit.
            </p>
          </div>
        )}

        {drafRemoteTerbaru && (
          <div className="px-5 py-2.5 border-t bg-blue-50 border-blue-100 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-blue-900">
              Draf website di server baru saja diperbarui oleh pengguna lain. Anda memiliki suntingan lokal yang belum disimpan.
            </p>
            <button
              type="button"
              onClick={() => tandaiTersimpan(db.getWebsiteDraft())}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Muat Versi Server Terbaru
            </button>
          </div>
        )}

        {pesan && (
          <div
            className={`px-5 py-2.5 border-t flex items-start gap-2 ${
              pesan.nada === 'ok' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
            }`}
          >
            {pesan.nada === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            )}
            <p className={`text-xs leading-relaxed ${pesan.nada === 'ok' ? 'text-emerald-900' : 'text-amber-900'}`}>{pesan.teks}</p>
          </div>
        )}
      </section>

      {/* ================= CAPAIAN KONTEN ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Kelompok Konten" value={kunciRail.length} hint="Identitas, navigasi, seksi beranda, katalog, dan footer." />
        <Stat
          label="Seksi Daftar Tampil"
          value={`${seksiAktif} / ${BAGIAN_WEBSITE.length}`}
          tone="emerald"
          hint="Seksi yang dilihat pengunjung pada halaman beranda."
        />
        <Stat label="Butir Konten" value={totalButir} tone="blue" hint="Kartu konten hasil sinkronisasi register izin edar, sertifikat, pelanggan, kampanye, dan stok." />
        <Stat
          label="Terbit Terakhir"
          value={terbit?.lastPublishedAt ? formatTanggal(new Date(terbit.lastPublishedAt).toISOString()) : '-'}
          hint={`Status tayang: ${statusTayang.label}.`}
        />
      </div>

      {/* ================= RAIL + PANE ================= */}
      <div className="grid xl:grid-cols-[260px_1fr] gap-4 items-start">
        <nav className="bg-white border border-slate-200 rounded-2xl shadow-xs p-3 xl:sticky xl:top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {GRUP_RAIL.map((grup) => (
            <div key={grup.judul} className="mb-3 last:mb-0">
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">{grup.judul}</p>
              <div className="space-y-0.5">
                {grup.kunci.map((k) => {
                  const Ikon = IKON_RAIL[k];
                  const aktif = kunci === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setKunci(k);
                        setMode('sunting');
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        aktif ? 'bg-slate-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {Ikon && <Ikon className={`w-3.5 h-3.5 shrink-0 ${aktif ? 'text-white' : 'text-slate-500'}`} />}
                      <span className="text-xs font-semibold truncate flex-1">{LABEL_RAIL[k]}</span>
                      <span
                        className={`text-2xs font-mono shrink-0 ${aktif ? 'text-slate-200' : 'text-slate-400'}`}
                      >
                        {jumlahButir(draf, k)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: 'sunting', label: 'Editor', ikon: Pencil },
              { id: 'pratinjau', label: 'Live Preview', ikon: Eye },
              { id: 'jejak', label: 'trails', ikon: History }
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`inline-flex items-center gap-1.5 ${chipFilter(mode === t.id)}`}
              >
                <t.ikon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}

            {mode === 'pratinjau' && (
              <div className="ml-auto flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
                {(Object.keys(PERANGKAT) as (keyof typeof PERANGKAT)[]).map((p) => {
                  const Ikon = PERANGKAT[p].ikon;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPerangkat(p)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        perangkat === p ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Ikon className="w-3.5 h-3.5" />
                      {PERANGKAT[p].label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {mode === 'sunting' && (
            <div className="space-y-3">
              {renderEditor()}
              {belumTersimpan && (
                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  Ada suntingan yang belum disimpan. Simpan draf untuk mencatatnya pada jejak audit, lalu Terbitkan untuk
                  menayangkannya di /web.
                </p>
              )}
            </div>
          )}

          {mode === 'pratinjau' && (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 overflow-x-auto">
              <iframe
                ref={iframeRef}
                title="Pratinjau situs publik"
                src="/web/?pratinjau=1"
                onLoad={() => {
                  iframeSiap.current = true;
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'ams-website-pratinjau', konfigurasi: draf },
                    window.location.origin
                  );
                }}
                className="bg-white border border-slate-200 rounded-xl h-[70vh] mx-auto"
                style={{ width: perangkat === 'desktop' ? '100%' : `${PERANGKAT[perangkat].lebar}px`, minWidth: '320px' }}
              />
              <p className="text-2xs text-slate-500 mt-2">
                Pratinjau memakai draf yang belum disimpan. Konten yang dilihat pengunjung adalah snapshot hasil Terbitkan.
              </p>
            </div>
          )}

          {mode === 'jejak' && (
            <Panel
              judul="Jejak Audit Konten Situs"
              keterangan="Penyimpanan draf, sinkronisasi data, penerbitan, dan penahanan tercatat dengan pengguna, peran, nilai lama, dan nilai baru sesuai CDAKB Permenkes 4/2014 & ISO 13485:2016 klausul 4.2.4."
              aksi={<Badge tone={jejak.length ? 'emerald' : 'slate'}>{jejak.length} entri terakhir</Badge>}
            >
              {jejak.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada aktivitas konten situs pada perangkat ini. Simpan draf untuk membuat entri pertama.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 -mx-2">
                  {jejak.map((log) => (
                    <div key={log.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs font-bold text-slate-900">{log.aktivitas}</span>
                        <span className="text-2xs font-mono text-slate-500">{log.waktu}</span>
                        <span className="ml-auto text-2xs font-mono text-slate-500">{log.nomorReferensi}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.pengguna} · {log.peran} · {log.statusIntegritas}
                      </p>
                      {log.perubahan && log.perubahan.length > 0 && (
                        <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 text-2xs font-bold uppercase tracking-wider text-slate-500">
                            <span className="px-2 py-1.5">Kolom</span>
                            <span className="px-2 py-1.5">Nilai Lama</span>
                            <span className="px-2 py-1.5">Nilai Baru</span>
                          </div>
                          {log.perubahan.slice(0, 8).map((p, i) => (
                            <div key={`${p.kolom}-${i}`} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] text-xs border-t border-slate-100">
                              <span className="px-2 py-1.5 font-mono text-slate-700 break-all">{p.kolom}</span>
                              <span className="px-2 py-1.5 text-rose-700 break-all">{p.nilaiLama}</span>
                              <span className="px-2 py-1.5 text-emerald-800 break-all">{p.nilaiBaru}</span>
                            </div>
                          ))}
                          {log.perubahan.length > 8 && (
                            <p className="px-2 py-1.5 text-2xs text-slate-500 border-t border-slate-100">
                              +{log.perubahan.length - 8} perubahan lain pada entri ini
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
