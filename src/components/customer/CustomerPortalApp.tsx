import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  ArrowLeft, Bell, Building2, CheckCircle2, CircleUserRound, KeyRound, LogOut, Mail,
  Minus, PackageSearch, Pencil, Plus, Search, ShieldCheck, ShoppingBag, Trash2, X
} from 'lucide-react';
import { customerApi, CustomerApiError } from '../../services/customerPortal';
import { customerFirebaseMessage, getCustomerFirebase } from '../../services/customerFirebase';
import {
  customerProfileError,
  type CustomerAccount,
  type CustomerAddress,
  type CustomerCart,
  type CustomerCatalogItem,
  type CustomerPortalStatus
} from '../../types/customerPortal';

type Page =
  | 'masuk' | 'daftar' | 'lupa-sandi' | 'verifikasi' | 'ringkasan' | 'profil'
  | 'katalog' | 'keranjang' | 'alamat' | 'notifikasi';
const pages: Page[] = [
  'masuk', 'daftar', 'lupa-sandi', 'verifikasi', 'ringkasan', 'profil',
  'katalog', 'keranjang', 'alamat', 'notifikasi'
];
const initialPage = (): Page => {
  const part = window.location.pathname.replace(/^\/akun\/?/, '');
  return pages.includes(part as Page) ? part as Page : 'ringkasan';
};
const inputClass = 'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600';
const primaryClass = 'min-h-11 rounded-xl bg-teal-700 px-5 py-2.5 font-semibold text-sm text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryClass = 'min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50';

export default function CustomerPortalApp() {
  const [page, setPage] = useState<Page>(initialPage);
  const [status, setStatus] = useState<CustomerPortalStatus | null>(null);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nama, setNama] = useState('');
  const [telepon, setTelepon] = useState('');
  const [perusahaan, setPerusahaan] = useState('');
  const [consent, setConsent] = useState(false);
  const [registrationIdentity, setRegistrationIdentity] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CustomerCatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [category, setCategory] = useState('');
  const [detailProduct, setDetailProduct] = useState<CustomerCatalogItem | null>(null);
  const [detailVariantId, setDetailVariantId] = useState('');
  const catalogRequestRef = useRef(0);
  const [cart, setCart] = useState<CustomerCart>({ items: [], revision: 0, updatedAt: '' });
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; judul: string; pesan: string; dibaca: boolean; createdAt: string }>>([]);
  const [addressForm, setAddressForm] = useState({ label: '', penerima: '', telepon: '', alamat: '', kota: '', provinsi: '', kodePos: '', isUtama: false });
  const [editingAddressId, setEditingAddressId] = useState<string | undefined>();
  const heading = useRef<HTMLHeadingElement>(null);

  const go = (next: Page) => {
    setPage(next);
    window.history.pushState(null, '', next === 'ringkasan' ? '/akun' : `/akun/${next}`);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmation('');
  };
  const applyAccount = (value: CustomerAccount) => {
    setAccount(value);
    setNama(value.nama);
    setTelepon(value.telepon);
    setPerusahaan(value.perusahaan);
  };
  const clearAccount = () => {
    setAccount(null);
    setNama('');
    setTelepon('');
    setPerusahaan('');
    setEmail('');
    setConsent(false);
    setRegistrationIdentity(null);
    setCatalog([]);
    setCart({ items: [], revision: 0, updatedAt: '' });
    setAddresses([]);
    setNotifications([]);
    setDetailProduct(null);
    setEditingAddressId(undefined);
  };
  useEffect(() => {
    const pop = () => setPage(initialPage());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [page, loading]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const available = await customerApi.status();
        if (!active) return;
        setStatus(available);
        if (!available.enabled) return;
        try {
          const result = await customerApi.me();
          if (active) {
            applyAccount(result.account);
            const [catalogData, cartData, addressData, notificationData] = await Promise.all([
              customerApi.catalog(), customerApi.cart(), customerApi.addresses(), customerApi.notifications()
            ]);
            if (!active) return;
            setCatalog(catalogData.items);
            setCategories(catalogData.categories);
            setCart(cartData.cart);
            setAddresses(addressData.items);
            setNotifications(notificationData.items);
          }
        } catch (e) {
          if (!(e instanceof CustomerApiError && e.status === 401)) throw e;
        }
      } catch (e) { if (active) setError(customerFirebaseMessage(e)); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); return true; } catch (e) {
      if (e instanceof CustomerApiError && e.status === 401 && account) {
        clearAccount();
        go('masuk');
      }
      setError(customerFirebaseMessage(e));
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  };
  const firebase = () => {
    if (!status) throw new Error('Status portal belum tersedia.');
    return getCustomerFirebase(status);
  };
  const actionSettings = () => ({ url: `${window.location.origin}/akun/masuk` });
  const exchange = async () => {
    const auth = firebase();
    const user = auth.currentUser;
    if (!user) throw new Error('Silakan masuk kembali untuk melanjutkan verifikasi.');
    const result = await customerApi.login(await user.getIdToken(true));
    applyAccount(result.account);
    go('ringkasan');
    await signOut(auth);
    setRegistrationIdentity(null);
  };
  const sendReset = async (address: string) => {
    try { await sendPasswordResetEmail(firebase(), address, actionSettings()); } catch (e) {
      // Do not disclose whether an email has a Firebase account.
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'auth/user-not-found')) throw e;
    }
    setNotice('Jika email terdaftar, tautan pengaturan ulang kata sandi akan dikirim. Periksa kotak masuk dan folder spam.');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (page === 'lupa-sandi') { await sendReset(email.trim()); return; }
      const auth = firebase();
      if (page === 'daftar') {
        const profile = { nama, telepon, perusahaan };
        const invalid = customerProfileError(profile);
        if (invalid) throw new Error(invalid);
        if (!status?.registrationAvailable || !consent || !status.privacyVersion) throw new Error('Pendaftaran memerlukan persetujuan kebijakan yang berlaku.');
        let user = auth.currentUser;
        if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
          if (password.length < 12) throw new Error('Gunakan kata sandi minimal 12 karakter.');
          if (password !== confirmation) throw new Error('Konfirmasi kata sandi tidak sama.');
          user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
        }
        setRegistrationIdentity(user.email?.toLowerCase() ?? null);
        await customerApi.register(await user.getIdToken(true), profile, status.privacyVersion);
        if (user.emailVerified) { await exchange(); return; }
        go('verifikasi');
        await sendEmailVerification(user, actionSettings());
        setNotice('Pendaftaran tersimpan. Buka email verifikasi, lalu masuk kembali.');
        return;
      }
      await signInWithEmailAndPassword(auth, email.trim(), password);
      try { await exchange(); } catch (e) {
        if (e instanceof CustomerApiError && e.code === 'REGISTRATION_REQUIRED') {
          setRegistrationIdentity(auth.currentUser?.email?.toLowerCase() ?? null);
          go('daftar');
          setNotice('Identitas Firebase valid. Lengkapi profil dan persetujuan untuk membuat akun customer.');
          return;
        }
        if (e instanceof CustomerApiError && e.code === 'EMAIL_UNVERIFIED') {
          go('verifikasi');
          setNotice('Email belum terverifikasi. Buka tautan verifikasi pada kotak masuk Anda.');
          return;
        }
        throw e;
      }
    });
  };

  const logout = (all = false) => void run(async () => {
    await customerApi.logout(all);
    clearAccount();
    go('masuk');
    if (status?.authAvailable) await signOut(firebase());
    setNotice(all ? 'Anda telah keluar dari semua perangkat.' : 'Anda telah keluar dari Customer Portal.');
  });
  const muatKatalog = async (query: string, selectedCategory: string) => {
    const requestId = ++catalogRequestRef.current;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedCategory) params.set('kategori', selectedCategory);
    const result = await customerApi.catalog(params.size ? `?${params.toString()}` : '');
    if (requestId !== catalogRequestRef.current) return;
    setCatalog(result.items);
    setCategories(result.categories);
  };
  const tambahKeKeranjang = (item: CustomerCatalogItem, variantId = item.varian[0]?.id) => run(async () => {
    const variant = item.varian.find((entry) => entry.id === variantId);
    if (!variant) throw new Error('Produk ini belum memiliki varian SKU yang dapat dipesan.');
    const existing = cart.items.find((row) => row.produkId === item.id && row.varianId === variant.id);
    const next = [
      ...cart.items.filter((row) => !(row.produkId === item.id && row.varianId === variant.id)),
      { produkId: item.id, varianId: variant.id, jumlah: (existing?.jumlah ?? 0) + 1 }
    ];
    const result = await customerApi.updateCart(next);
    setCart(result.cart);
    setNotice(`${item.nama} ditambahkan ke keranjang.`);
  });
  const bukaDetailProduk = (id: string) => void run(async () => {
    const result = await customerApi.catalogDetail(id);
    setDetailProduct(result.item);
    setDetailVariantId(result.item.varian[0]?.id ?? '');
  });
  const ubahJumlahKeranjang = (produkId: string, varianId: string, jumlah: number) => void run(async () => {
    const next = cart.items
      .map((item) => item.produkId === produkId && item.varianId === varianId ? { ...item, jumlah } : item)
      .filter((item) => item.jumlah > 0);
    const result = await customerApi.updateCart(next);
    setCart(result.cart);
  });
  const hapusAlamat = (id: string) => void run(async () => {
    const result = await customerApi.deleteAddress(id);
    setAddresses(result.items);
    setNotice('Alamat berhasil dihapus.');
  });
  const mulaiEditAlamat = (address: CustomerAddress) => {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label, penerima: address.penerima, telepon: address.telepon, alamat: address.alamat,
      kota: address.kota, provinsi: address.provinsi, kodePos: address.kodePos, isUtama: address.isUtama
    });
  };
  const resetFormAlamat = () => {
    setEditingAddressId(undefined);
    setAddressForm({ label: '', penerima: '', telepon: '', alamat: '', kota: '', provinsi: '', kodePos: '', isUtama: false });
  };
  const field = (label: string, value: string, setter: (v: string) => void, options: { type?: string; required?: boolean; maxLength?: number; autoComplete?: string } = {}) => (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input className={inputClass} value={value} onChange={(e) => setter(e.target.value)} disabled={busy} {...options} />
    </label>
  );
  const actualPage = account ? (['profil', 'katalog', 'keranjang', 'alamat', 'notifikasi'].includes(page) ? page : 'ringkasan') :
    (['daftar', 'lupa-sandi', 'verifikasi'].includes(page) ? page : 'masuk');
  const title = loading ? 'Memuat akun' : !status?.enabled ? 'Customer Portal' : {
    masuk: 'Masuk ke akun customer', daftar: 'Daftar akun customer', 'lupa-sandi': 'Lupa kata sandi',
    verifikasi: 'Verifikasi email Anda', ringkasan: 'Selamat datang kembali', profil: 'Profil & keamanan akun',
    katalog: 'Katalog produk', keranjang: 'Keranjang permintaan', alamat: 'Alamat pengiriman',
    notifikasi: 'Notifikasi'
  }[actualPage];
  useEffect(() => { document.title = `${title} | Remedi-AMS`; }, [title]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center gap-3 font-bold text-teal-800">
            <ShoppingBag aria-hidden="true" className="h-6 w-6" /><span>Remedi-AMS <span className="block text-xs font-medium text-slate-500">Customer Portal</span></span>
          </a>
          <a href="/?masuk=1" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600"><ShieldCheck className="h-4 w-4" /> Akses Karyawan</a>
        </div>
      </header>
      <div className={`mx-auto max-w-6xl gap-8 px-4 py-8 sm:px-6 ${account ? 'md:grid md:grid-cols-[210px_1fr]' : ''}`}>
        {account && <aside className="mb-6 md:mb-0">
          <nav aria-label="Navigasi customer" className="flex flex-wrap gap-2 md:flex-col">
            <button className={secondaryClass} onClick={() => go('ringkasan')} aria-current={actualPage === 'ringkasan' ? 'page' : undefined}>Ringkasan akun</button>
            <button className={secondaryClass} onClick={() => go('profil')} aria-current={actualPage === 'profil' ? 'page' : undefined}>Profil & keamanan</button>
            <button className={secondaryClass} onClick={() => go('katalog')} aria-current={actualPage === 'katalog' ? 'page' : undefined}>Katalog produk</button>
            <button className={secondaryClass} onClick={() => go('keranjang')} aria-current={actualPage === 'keranjang' ? 'page' : undefined}>Keranjang <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs">{cart.items.length}</span></button>
            <button className={secondaryClass} onClick={() => go('alamat')} aria-current={actualPage === 'alamat' ? 'page' : undefined}>Alamat pengiriman</button>
            <button className={secondaryClass} onClick={() => go('notifikasi')} aria-current={actualPage === 'notifikasi' ? 'page' : undefined}>Notifikasi</button>
            {account.aksesDeveloper
              ? <a href="/" className={`${secondaryClass} inline-flex items-center justify-center gap-2`}><ArrowLeft className="h-4 w-4" /> Kembali ke ERP</a>
              : <button disabled={busy} className={`${secondaryClass} inline-flex items-center justify-center gap-2`} onClick={() => logout()}><LogOut className="h-4 w-4" /> Keluar</button>}
          </nav>
        </aside>}
        <main className={`min-w-0 ${!account ? 'mx-auto max-w-lg' : ''}`}>
          {!account && <a href="/" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" /> Kembali ke website</a>}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-teal-700">{account ? 'Akun bisnis Anda' : 'Akses pelanggan'}</p>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">{title}</h1>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {notice && <div role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{notice}</div>}
            {account?.aksesDeveloper && <div role="note" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
              <strong>Mode developer.</strong> Anda masuk dengan sesi ERP role developer. Data keranjang, alamat dan profil di sini adalah ruang kerja developer yang terpisah dari akun customer dan tidak dapat ditautkan ke pelanggan B2B.
            </div>}
            {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Memeriksa sesi customer...</p> : !status ? (
              <button className={`${secondaryClass} mt-5`} onClick={() => window.location.reload()}>Coba lagi</button>
            ) : !status.enabled ? (
              <p className="mt-4 text-sm text-slate-600">Customer Portal belum diaktifkan. Website dan akses karyawan tetap dapat digunakan.</p>
            ) : account && actualPage === 'ringkasan' ? (
              <div className="mt-6 space-y-5">
                <p className="text-lg font-semibold">{account.nama}</p>
                {!account.aksesDeveloper && <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                  <div><p className="text-sm font-semibold">Email terverifikasi</p><p className="mt-1 break-words text-sm text-slate-600">{account.email}</p></div>
                </div>}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {account.status === 'aktif' ? 'Akun bisnis aktif.' : 'Akun menunggu verifikasi bisnis. Tim kami perlu menautkan akun Anda ke data pelanggan B2B sebelum pemesanan dapat digunakan.'}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Baris keranjang</p><p className="mt-1 text-2xl font-bold">{cart.items.length}</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Alamat tersimpan</p><p className="mt-1 text-2xl font-bold">{addresses.length}</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Notifikasi belum dibaca</p><p className="mt-1 text-2xl font-bold">{notifications.filter((item) => !item.dibaca).length}</p></div>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">Katalog, keranjang dan alamat tersimpan melalui backend. Pengajuan penawaran, pesanan, invoice dan pembayaran belum diaktifkan sampai integrasi ERP Tahap 5 selesai.</p>
                <div className="flex flex-wrap gap-3">
                  <button className={primaryClass} onClick={() => go('katalog')}>Lihat katalog produk</button>
                  <button className={secondaryClass} onClick={() => go('keranjang')}>Buka keranjang</button>
                </div>
              </div>
            ) : account && actualPage === 'katalog' ? (
              <div className="mt-6 space-y-5">
                <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]" onSubmit={(event) => {
                  event.preventDefault();
                  void run(() => muatKatalog(catalogQuery, category));
                }}>
                  <label className="block">
                    <span className="sr-only">Cari produk</span>
                    <input className={inputClass} value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Cari nama, merek, SKU atau izin edar" />
                  </label>
                  <select className={inputClass} value={category} onChange={(e) => {
                    setCategory(e.target.value);
                    void run(() => muatKatalog(catalogQuery, e.target.value));
                  }}>
                    <option value="">Semua kategori</option>
                    {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <button disabled={busy} className={secondaryClass}><Search className="mr-2 inline h-4 w-4" />Cari</button>
                </form>
                {catalog.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                    <PackageSearch className="mx-auto mb-3 h-8 w-8 text-slate-300" /> Tidak ada produk yang cocok.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {catalog.map((item) => (
                      <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="aspect-[16/9] bg-slate-100">
                          {item.imageUrls[0] ? <img src={item.imageUrls[0]} alt={item.nama} loading="lazy" className="h-full w-full object-contain" /> :
                            <div className="flex h-full items-center justify-center"><PackageSearch className="h-10 w-10 text-slate-300" /></div>}
                        </div>
                        <div className="space-y-2 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{item.kategori}</p>
                          <h2 className="font-bold leading-snug">{item.nama}</h2>
                          <p className="line-clamp-2 text-sm text-slate-600">{item.spesifikasi || item.tipeModel}</p>
                          <p className="text-xs text-slate-500">{item.nomorIzinEdar || 'Izin edar tidak tersedia'} · Ketersediaan dikonfirmasi saat penawaran</p>
                          <p className="text-sm font-semibold text-slate-800">{item.hargaTayang || 'Harga melalui penawaran sales'}</p>
                          <button disabled={busy} className={`${primaryClass} w-full`} onClick={() => bukaDetailProduk(item.id)}>
                            <Plus className="mr-2 inline h-4 w-4" /> Lihat detail & pilih varian
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : account && actualPage === 'keranjang' ? (
              <div className="mt-6 space-y-4">
                {cart.items.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-8 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-600">Keranjang masih kosong.</p>
                    <button className={`${primaryClass} mt-4`} onClick={() => go('katalog')}>Cari produk</button>
                  </div>
                ) : cart.items.map((row) => {
                  const product = catalog.find((item) => item.id === row.produkId);
                  return (
                    <div key={`${row.produkId}:${row.varianId}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{product?.nama || 'Produk'}</p>
                        <p className="text-xs text-slate-500">{product?.varian.find((variant) => variant.id === row.varianId)?.kodeSKU || row.varianId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button aria-label="Kurangi jumlah" className={secondaryClass} onClick={() => ubahJumlahKeranjang(row.produkId, row.varianId, row.jumlah - 1)}><Minus className="h-4 w-4" /></button>
                        <span className="min-w-12 text-center font-semibold">{row.jumlah}</span>
                        <button aria-label="Tambah jumlah" className={secondaryClass} onClick={() => ubahJumlahKeranjang(row.produkId, row.varianId, row.jumlah + 1)}><Plus className="h-4 w-4" /></button>
                        <button aria-label="Hapus produk" className={secondaryClass} onClick={() => ubahJumlahKeranjang(row.produkId, row.varianId, 0)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
                {cart.items.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Checkout dan pengajuan penawaran belum aktif. Keranjang ini tersimpan di server dan dapat dilanjutkan setelah integrasi ERP Tahap 5.</div>}
              </div>
            ) : account && actualPage === 'alamat' ? (
              <div className="mt-6 space-y-5">
                {addresses.map((address) => (
                  <div key={address.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div><p className="font-semibold">{address.label}{address.isUtama ? ' · Utama' : ''}</p><p className="mt-1 text-sm text-slate-600">{address.penerima} · {address.telepon}<br />{address.alamat}, {address.kota}, {address.provinsi} {address.kodePos}</p></div>
                    <div className="flex gap-2">
                      <button className={secondaryClass} onClick={() => mulaiEditAlamat(address)}><Pencil className="mr-2 inline h-4 w-4" />Ubah</button>
                      <button className={secondaryClass} onClick={() => hapusAlamat(address.id)}>Hapus</button>
                    </div>
                  </div>
                ))}
                <form className="space-y-3 border-t border-slate-200 pt-5" onSubmit={(event) => { event.preventDefault(); void run(async () => {
                  const result = await customerApi.saveAddress({ ...addressForm, id: editingAddressId });
                  setAddresses(result.items);
                  resetFormAlamat();
                  setNotice(editingAddressId ? 'Alamat berhasil diperbarui.' : 'Alamat berhasil disimpan.');
                }); }}>
                  <h2 className="font-semibold">{editingAddressId ? 'Ubah alamat' : 'Tambah alamat'}</h2>
                  {field('Nama alamat', addressForm.label, (value) => setAddressForm((old) => ({ ...old, label: value })), { required: true, maxLength: 60 })}
                  {field('Nama penerima', addressForm.penerima, (value) => setAddressForm((old) => ({ ...old, penerima: value })), { required: true, maxLength: 120 })}
                  {field('Nomor telepon penerima', addressForm.telepon, (value) => setAddressForm((old) => ({ ...old, telepon: value })), { required: true, maxLength: 40 })}
                  {field('Alamat lengkap', addressForm.alamat, (value) => setAddressForm((old) => ({ ...old, alamat: value })), { required: true, maxLength: 300 })}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field('Kota', addressForm.kota, (value) => setAddressForm((old) => ({ ...old, kota: value })), { required: true, maxLength: 100 })}
                    {field('Provinsi', addressForm.provinsi, (value) => setAddressForm((old) => ({ ...old, provinsi: value })), { required: true, maxLength: 100 })}
                  </div>
                  {field('Kode pos', addressForm.kodePos, (value) => setAddressForm((old) => ({ ...old, kodePos: value })), { required: true, maxLength: 10 })}
                  <label className="flex items-center gap-3 text-sm text-slate-600"><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={addressForm.isUtama} onChange={(e) => setAddressForm((old) => ({ ...old, isUtama: e.target.checked }))} /> Jadikan alamat utama</label>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} className={primaryClass}>{busy ? 'Menyimpan...' : editingAddressId ? 'Perbarui alamat' : 'Simpan alamat'}</button>
                    {editingAddressId && <button type="button" disabled={busy} className={secondaryClass} onClick={resetFormAlamat}>Batal</button>}
                  </div>
                </form>
              </div>
            ) : account && actualPage === 'notifikasi' ? (
              <div className="mt-6 space-y-3">
                {notifications.length === 0 ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500"><Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />Belum ada notifikasi.</div> :
                  notifications.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{item.judul}</p><p className="mt-1 text-sm text-slate-600">{item.pesan}</p></article>)}
              </div>
            ) : account ? (
              <div className="mt-6 space-y-6">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
                  const result = await customerApi.updateProfile({ nama, telepon, perusahaan });
                  applyAccount(result.account);
                  setNotice('Profil berhasil disimpan.');
                }); }}>
                  {field('Nama lengkap', nama, setNama, { required: true, maxLength: 120, autoComplete: 'name' })}
                  {field('Perusahaan / instansi', perusahaan, setPerusahaan, { required: true, maxLength: 160, autoComplete: 'organization' })}
                  {field('Nomor telepon', telepon, setTelepon, { type: 'tel', maxLength: 40, autoComplete: 'tel' })}
                  <p className="text-xs text-slate-500">Nomor telepon belum diverifikasi. Perubahan profil tidak mengubah status verifikasi bisnis.</p>
                  <button disabled={busy} className={primaryClass}>{busy ? 'Menyimpan...' : 'Simpan profil'}</button>
                </form>
                {!account.aksesDeveloper && <div className="space-y-3 border-t border-slate-200 pt-5">
                  <h2 className="inline-flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" /> Keamanan akun</h2>
                  <p className="break-words text-sm text-slate-600">Email terverifikasi: {account.email}</p>
                  <p className="text-sm text-slate-600">Pengaturan ulang kata sandi dilakukan melalui tautan Firebase ke email Anda. Perubahan email dan alamat pengiriman belum tersedia pada tahap ini.</p>
                  <div className="flex flex-wrap gap-3">
                    <button disabled={busy || !status.authAvailable} className={secondaryClass} onClick={() => void run(() => sendReset(account.email))}>Kirim tautan atur ulang sandi</button>
                    <button disabled={busy} className={secondaryClass} onClick={() => logout(true)}>Keluar dari semua perangkat</button>
                  </div>
                </div>}
              </div>
            ) : !status.authAvailable ? (
              <p className="mt-4 text-sm text-amber-800">Konfigurasi Firebase customer belum siap. Akses karyawan tidak terpengaruh. Hubungi tim kami atau coba lagi nanti.</p>
            ) : actualPage === 'verifikasi' ? (
              <div className="mt-5 space-y-4">
                <Mail className="h-8 w-8 text-teal-700" />
                <p className="text-sm leading-relaxed text-slate-600">Buka tautan verifikasi yang dikirim Firebase. Jika halaman ini sudah dimuat ulang, masuk kembali dengan email dan kata sandi Anda.</p>
                <div className="flex flex-col gap-3">
                  <button disabled={busy} className={primaryClass} onClick={() => void run(async () => {
                    const user = firebase().currentUser;
                    if (!user) { go('masuk'); setNotice('Masuk kembali untuk memeriksa verifikasi email.'); return; }
                    await reload(user);
                    await exchange();
                  })}>Saya sudah verifikasi</button>
                  <button disabled={busy} className={secondaryClass} onClick={() => void run(async () => {
                    const user = firebase().currentUser;
                    if (!user) { go('masuk'); setNotice('Masuk kembali sebelum mengirim ulang verifikasi.'); return; }
                    await sendEmailVerification(user, actionSettings());
                    setNotice('Email verifikasi telah dikirim ulang.');
                  })}>Kirim ulang email verifikasi</button>
                  <button disabled={busy} className={secondaryClass} onClick={() => go('masuk')}>Kembali ke masuk</button>
                </div>
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={submit}>
                {actualPage === 'daftar' && <>
                  <p className="text-sm text-slate-600">Untuk pelanggan bisnis. Pemesanan memerlukan verifikasi tim kami; pendaftaran tidak memberi akses ERP.</p>
                  {!status.registrationAvailable && <p role="alert" className="text-sm text-amber-800">Pendaftaran belum tersedia. Kebijakan privasi dan syarat layanan perlu dikonfigurasi.</p>}
                  {field('Nama lengkap', nama, setNama, { required: true, maxLength: 120, autoComplete: 'name' })}
                  {field('Perusahaan / instansi', perusahaan, setPerusahaan, { required: true, maxLength: 160, autoComplete: 'organization' })}
                  {field('Nomor telepon (opsional)', telepon, setTelepon, { type: 'tel', maxLength: 40, autoComplete: 'tel' })}
                </>}
                {field('Email', email, setEmail, { type: 'email', required: true, maxLength: 254, autoComplete: 'email' })}
                {actualPage !== 'lupa-sandi' && field('Kata sandi', password, setPassword, { type: 'password', required: actualPage !== 'daftar' || registrationIdentity !== email.trim().toLowerCase(), maxLength: 128, autoComplete: actualPage === 'daftar' ? 'new-password' : 'current-password' })}
                {actualPage === 'daftar' && <>
                  {field('Konfirmasi kata sandi', confirmation, setConfirmation, { type: 'password', required: registrationIdentity !== email.trim().toLowerCase(), maxLength: 128, autoComplete: 'new-password' })}
                  <p className="text-xs text-slate-500">Minimal 12 karakter untuk akun baru. Jika melengkapi pendaftaran setelah masuk, kata sandi tidak perlu diisi ulang.</p>
                  <label className="flex items-start gap-3 text-sm text-slate-600">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-teal-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} required disabled={busy} />
                    <span>Saya menyetujui {status.privacyUrl ? <a className="font-semibold text-teal-700 underline" href={status.privacyUrl} target="_blank" rel="noreferrer">Kebijakan Privasi</a> : 'Kebijakan Privasi'} dan {status.termsUrl ? <a className="font-semibold text-teal-700 underline" href={status.termsUrl} target="_blank" rel="noreferrer">Syarat Layanan</a> : 'Syarat Layanan'}.</span>
                  </label>
                </>}
                <button className={`${primaryClass} w-full`} disabled={busy || (actualPage === 'daftar' && !status.registrationAvailable)}>
                  {busy ? 'Memproses...' : actualPage === 'daftar' ? 'Daftar customer' : actualPage === 'lupa-sandi' ? 'Kirim tautan reset' : 'Masuk customer'}
                </button>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 border-t border-slate-100 pt-3">
                  {actualPage !== 'masuk' && <button type="button" disabled={busy} className="min-h-11 text-sm font-semibold text-teal-700" onClick={() => go('masuk')}>Sudah punya akun? Masuk</button>}
                  {actualPage === 'masuk' && <>
                    <button type="button" disabled={busy} className="min-h-11 text-sm font-semibold text-teal-700" onClick={() => go('daftar')}>Daftar customer</button>
                    <button type="button" disabled={busy} className="min-h-11 text-sm text-slate-600" onClick={() => go('lupa-sandi')}>Lupa kata sandi?</button>
                  </>}
                </div>
              </form>
            )}
          </section>
          {!account && <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><CircleUserRound className="h-4 w-4" /> Akun customer terpisah dari akun karyawan.</p>}
          {account && <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4" /> Remedi-AMS Customer Portal</p>}
        </main>
      </div>
      {account && detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailProduct(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{detailProduct.kategori}</p>
                <h2 id="product-detail-title" className="mt-1 text-xl font-bold">{detailProduct.nama}</h2>
              </div>
              <button type="button" className={secondaryClass} aria-label="Tutup detail produk" onClick={() => setDetailProduct(null)}><X className="h-5 w-5" /></button>
            </div>
            {detailProduct.imageUrls[0] && <img src={detailProduct.imageUrls[0]} alt={detailProduct.nama} className="mt-5 max-h-64 w-full rounded-xl bg-slate-50 object-contain" />}
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Model</dt><dd className="font-medium">{detailProduct.tipeModel || '-'}</dd></div>
              <div><dt className="text-slate-500">Produsen</dt><dd className="font-medium">{detailProduct.produsen || '-'}</dd></div>
              <div><dt className="text-slate-500">Izin edar</dt><dd className="font-medium">{detailProduct.nomorIzinEdar || 'Informasi tidak tersedia'}</dd></div>
              <div><dt className="text-slate-500">Status izin edar</dt><dd className="font-medium">{detailProduct.statusIzinEdar || 'Informasi tidak tersedia'}</dd></div>
            </dl>
            {detailProduct.spesifikasi && <div className="mt-4"><h3 className="text-sm font-semibold">Spesifikasi</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{detailProduct.spesifikasi}</p></div>}
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Harga akhir dan ketersediaan dikonfirmasi oleh tim sales melalui penawaran.
            </div>
            {detailProduct.varian.length > 0 && (
              <div className="mt-5 space-y-3">
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  <span>Pilih SKU / varian</span>
                  <select className={inputClass} value={detailVariantId} onChange={(event) => setDetailVariantId(event.target.value)}>
                    {detailProduct.varian.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {[variant.kodeSKU, variant.tipeModel, variant.nomorIzinEdar].filter(Boolean).join(' · ') || variant.id}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy || !detailVariantId} className={`${primaryClass} w-full`} onClick={() => {
                  void tambahKeKeranjang(detailProduct, detailVariantId).then((saved) => {
                    if (saved) setDetailProduct(null);
                  });
                }}>
                  <Plus className="mr-2 inline h-4 w-4" /> Tambahkan varian ke keranjang
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
