import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, reload, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut
} from 'firebase/auth';
import {
  ArrowLeft, Bell, Building2, CheckCircle2, CircleUserRound, ClipboardList, KeyRound, LogOut, Mail,
  Minus, PackageSearch, Pencil, Plus, Search, ShieldCheck, ShoppingBag, Trash2, X
} from 'lucide-react';
import { customerApi, CustomerApiError } from '../../services/customerPortal';
import { customerFirebaseMessage, getCustomerFirebase } from '../../services/customerFirebase';
import {
  CUSTOMER_ORDER_NOTE_MAX,
  customerProfileError,
  customerUsernameError,
  type CustomerAccount,
  type CustomerAddress,
  type CustomerCart,
  type CustomerCatalogItem,
  type CustomerNotification,
  type CustomerOrder,
  type CustomerOrderStatus,
  type CustomerPortalStatus
} from '../../types/customerPortal';

type Page =
  | 'masuk' | 'daftar' | 'lupa-sandi' | 'verifikasi' | 'ringkasan' | 'profil'
  | 'katalog' | 'keranjang' | 'pesanan' | 'alamat' | 'notifikasi';
const pages: Page[] = [
  'masuk', 'daftar', 'lupa-sandi', 'verifikasi', 'ringkasan', 'profil',
  'katalog', 'keranjang', 'pesanan', 'alamat', 'notifikasi'
];
const initialPage = (): Page => {
  const part = window.location.pathname.replace(/^\/akun\/?/, '');
  return pages.includes(part as Page) ? part as Page : 'ringkasan';
};
const inputClass = 'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600';
const primaryClass = 'min-h-11 rounded-xl bg-teal-700 px-5 py-2.5 font-semibold text-sm text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryClass = 'min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50';
const orderStatusLabel: Record<CustomerOrderStatus, { label: string; className: string }> = {
  'menunggu-penawaran': { label: 'Menunggu penawaran', className: 'bg-amber-100 text-amber-900' },
  dibatalkan: { label: 'Dibatalkan', className: 'bg-slate-200 text-slate-700' }
};
const formatTanggal = (value: string) => new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

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
  const [username, setUsername] = useState('');
  const [usernameHint, setUsernameHint] = useState<{ ok: boolean; pesan: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [nama, setNama] = useState('');
  const [telepon, setTelepon] = useState('');
  const [perusahaan, setPerusahaan] = useState('');
  const [consent, setConsent] = useState(false);
  const [registrationIdentity, setRegistrationIdentity] = useState<string | null>(null);
  // Set while a Google identity is signed in but still needs a customer profile (username, company, consent).
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CustomerCatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [category, setCategory] = useState('');
  const [detailProduct, setDetailProduct] = useState<CustomerCatalogItem | null>(null);
  const [detailVariantId, setDetailVariantId] = useState('');
  const catalogRequestRef = useRef(0);
  const [cart, setCart] = useState<CustomerCart>({ items: [], revision: 0, updatedAt: '' });
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [checkoutAddressId, setCheckoutAddressId] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  // One requestId per submission attempt; a retry after a network failure reuses it so the server can deduplicate.
  const orderRequestRef = useRef<{ id: string; revision: number } | null>(null);
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
    setUsername('');
    setUsernameHint(null);
    setConsent(false);
    setRegistrationIdentity(null);
    setGoogleEmail(null);
    setCatalog([]);
    setCart({ items: [], revision: 0, updatedAt: '' });
    setAddresses([]);
    setNotifications([]);
    setOrders([]);
    setSelectedOrder(null);
    setCheckoutAddressId('');
    setCheckoutNote('');
    orderRequestRef.current = null;
    setDetailProduct(null);
    setEditingAddressId(undefined);
  };
  useEffect(() => {
    const pop = () => setPage(initialPage());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [page, loading]);

  const loadWorkspace = async (isActive: () => boolean = () => true) => {
    const [catalogData, cartData, addressData, notificationData, orderData] = await Promise.all([
      customerApi.catalog(), customerApi.cart(), customerApi.addresses(), customerApi.notifications(), customerApi.orders()
    ]);
    if (!isActive()) return;
    setCatalog(catalogData.items);
    setCategories(catalogData.categories);
    setCart(cartData.cart);
    setAddresses(addressData.items);
    setNotifications(notificationData.items);
    setOrders(orderData.items);
  };
  useEffect(() => {
    setCheckoutAddressId((current) => current && addresses.some((a) => a.id === current)
      ? current : addresses.find((a) => a.isUtama)?.id ?? addresses[0]?.id ?? '');
  }, [addresses]);

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
            await loadWorkspace(() => active);
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
    setGoogleEmail(null);
    await loadWorkspace();
  };
  const loginWithGoogle = () => void run(async () => {
    const auth = firebase();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const user = (await signInWithPopup(auth, provider)).user;
    try {
      await exchange();
    } catch (e) {
      if (!(e instanceof CustomerApiError && e.code === 'REGISTRATION_REQUIRED')) {
        await signOut(auth).catch(() => undefined);
        throw e;
      }
      if (!status?.registrationAvailable) {
        await signOut(auth).catch(() => undefined);
        throw new Error('Akun Google ini belum terdaftar sebagai customer, dan pendaftaran belum dibuka.');
      }
      const address = user.email?.toLowerCase() ?? '';
      go('daftar');
      setEmail(address);
      setRegistrationIdentity(address);
      setGoogleEmail(address);
      setNama((current) => current || user.displayName?.slice(0, 120) || '');
      setNotice(`Akun Google ${address} terverifikasi. Lengkapi username dan profil untuk menyelesaikan pendaftaran.`);
    }
  });
  const cancelGoogle = () => {
    setGoogleEmail(null);
    setRegistrationIdentity(null);
    setEmail('');
    if (status?.authAvailable) void signOut(firebase()).catch(() => undefined);
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
      if (page === 'daftar') {
        const auth = firebase();
        const profile = { nama, telepon, perusahaan };
        const invalid = customerProfileError(profile);
        if (invalid) throw new Error(invalid);
        if (!status?.registrationAvailable || !consent || !status.privacyVersion) throw new Error('Pendaftaran memerlukan persetujuan kebijakan yang berlaku.');
        const usernameInvalid = customerUsernameError(username);
        if (usernameInvalid) throw new Error(usernameInvalid);
        let user = auth.currentUser;
        if (googleEmail && user?.email?.toLowerCase() !== googleEmail) {
          cancelGoogle();
          throw new Error('Sesi Google berakhir. Pilih "Lanjutkan dengan Google" lagi.');
        }
        if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
          if (password.length < 12) throw new Error('Gunakan kata sandi minimal 12 karakter.');
          if (password !== confirmation) throw new Error('Konfirmasi kata sandi tidak sama.');
          // Check before creating the Firebase identity so a taken username does not leave an orphan account.
          const check = await customerApi.checkUsername(username);
          setUsernameHint({ ok: check.available, pesan: check.pesan });
          if (!check.available) throw new Error(check.pesan);
          try {
            user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
          } catch (e) {
            if (!(e && typeof e === 'object' && 'code' in e && e.code === 'auth/email-already-in-use')) throw e;
            // An earlier attempt may have created the identity without a customer record; the same password resumes it.
            try { user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user; } catch {
              throw new Error('Email sudah terdaftar. Masuk dengan username Anda atau gunakan lupa kata sandi.');
            }
          }
        }
        setRegistrationIdentity(user.email?.toLowerCase() ?? null);
        try {
          await customerApi.register(await user.getIdToken(true), username, profile, status.privacyVersion);
        } catch (e) {
          if (e instanceof CustomerApiError && e.code === 'USERNAME_TAKEN') setUsernameHint({ ok: false, pesan: e.message });
          throw e;
        }
        if (user.emailVerified) { await exchange(); return; }
        go('verifikasi');
        await sendEmailVerification(user, actionSettings());
        setNotice('Pendaftaran tersimpan. Buka email verifikasi, lalu masuk kembali.');
        return;
      }
      try {
        const result = await customerApi.loginWithUsername(username.trim(), password);
        applyAccount(result.account);
        go('ringkasan');
        await loadWorkspace();
      } catch (e) {
        if (e instanceof CustomerApiError && e.code === 'EMAIL_UNVERIFIED') {
          go('verifikasi');
          setNotice(e.message);
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
  const ajukanPesanan = () => void run(async () => {
    if (!checkoutAddressId) throw new Error('Tambahkan atau pilih alamat pengiriman terlebih dahulu.');
    if (orderRequestRef.current?.revision !== cart.revision) {
      orderRequestRef.current = { id: crypto.randomUUID(), revision: cart.revision };
    }
    try {
      const result = await customerApi.submitOrder({
        requestId: orderRequestRef.current.id, cartRevision: cart.revision, alamatId: checkoutAddressId, catatan: checkoutNote
      });
      orderRequestRef.current = null;
      setCart(result.cart);
      setCheckoutNote('');
      const [orderData, notificationData] = await Promise.all([customerApi.orders(), customerApi.notifications()]);
      setOrders(orderData.items);
      setNotifications(notificationData.items);
      setSelectedOrder(result.order);
      go('pesanan');
      setNotice(`Permintaan penawaran ${result.order.nomor} terkirim. Tim sales akan menyiapkan harga dan ketersediaan.`);
    } catch (e) {
      if (e instanceof CustomerApiError && e.code === 'CART_CHANGED') {
        orderRequestRef.current = null;
        setCart((await customerApi.cart()).cart);
      }
      throw e;
    }
  });
  const bukaPesanan = (id: string) => void run(async () => {
    setCancelReason('');
    setSelectedOrder((await customerApi.order(id)).order);
  });
  const batalkanPesanan = (id: string) => void run(async () => {
    if (!window.confirm('Batalkan permintaan penawaran ini?')) return;
    const result = await customerApi.cancelOrder(id, cancelReason);
    setSelectedOrder(result.order);
    setCancelReason('');
    const [orderData, notificationData] = await Promise.all([customerApi.orders(), customerApi.notifications()]);
    setOrders(orderData.items);
    setNotifications(notificationData.items);
    setNotice(`Pesanan ${result.order.nomor} dibatalkan.`);
  });
  const tandaiNotifikasiDibaca = () => void run(async () => {
    setNotifications((await customerApi.markNotificationsRead()).items);
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
  const field = (label: string, value: string, setter: (v: string) => void, options: { type?: string; required?: boolean; maxLength?: number; autoComplete?: string; readOnly?: boolean } = {}) => (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input className={inputClass} value={value} onChange={(e) => setter(e.target.value)} disabled={busy} {...options} />
    </label>
  );
  const actualPage = account ? (['profil', 'katalog', 'keranjang', 'pesanan', 'alamat', 'notifikasi'].includes(page) ? page : 'ringkasan') :
    (['daftar', 'lupa-sandi', 'verifikasi'].includes(page) ? page : 'masuk');
  const unreadCount = notifications.filter((item) => !item.dibaca).length;
  const canOrder = Boolean(account && (account.aksesDeveloper || account.status === 'aktif'));
  const openOrders = orders.filter((order) => order.status === 'menunggu-penawaran').length;
  const title = loading ? 'Memuat akun' : !status?.enabled ? 'Customer Portal' : {
    masuk: 'Masuk ke akun customer', daftar: 'Daftar akun customer', 'lupa-sandi': 'Lupa kata sandi',
    verifikasi: 'Verifikasi email Anda', ringkasan: 'Selamat datang kembali', profil: 'Profil & keamanan akun',
    katalog: 'Katalog produk', keranjang: 'Keranjang permintaan', pesanan: 'Pesanan saya', alamat: 'Alamat pengiriman',
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
            <button className={secondaryClass} onClick={() => { setSelectedOrder(null); go('pesanan'); }} aria-current={actualPage === 'pesanan' ? 'page' : undefined}>Pesanan saya</button>
            <button className={secondaryClass} onClick={() => go('alamat')} aria-current={actualPage === 'alamat' ? 'page' : undefined}>Alamat pengiriman</button>
            <button className={secondaryClass} onClick={() => go('notifikasi')} aria-current={actualPage === 'notifikasi' ? 'page' : undefined}>Notifikasi{unreadCount > 0 && <span className="ml-1 rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}</button>
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
                  {account.aksesDeveloper ? 'Ruang kerja developer: pengajuan pesanan diizinkan untuk evaluasi dan ditandai sebagai pesanan uji di inbox sales.'
                    : account.status === 'aktif' ? 'Akun bisnis aktif. Anda dapat mengajukan permintaan penawaran dari keranjang.'
                    : 'Akun menunggu verifikasi bisnis. Tim kami perlu menautkan akun Anda ke data pelanggan B2B sebelum pemesanan dapat digunakan.'}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Baris keranjang</p><p className="mt-1 text-2xl font-bold">{cart.items.length}</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Menunggu penawaran</p><p className="mt-1 text-2xl font-bold">{openOrders}</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Total pesanan</p><p className="mt-1 text-2xl font-bold">{orders.length}</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Notifikasi belum dibaca</p><p className="mt-1 text-2xl font-bold">{unreadCount}</p></div>
                </div>
                {orders.length > 0 && <div className="space-y-2">
                  <h2 className="font-semibold">Pesanan terbaru</h2>
                  {orders.slice(0, 3).map((order) => (
                    <button key={order.id} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50" onClick={() => { go('pesanan'); bukaPesanan(order.id); }}>
                      <span><span className="font-semibold">{order.nomor}</span><span className="block text-xs text-slate-500">{formatTanggal(order.createdAt)} · {order.baris.length} produk</span></span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusLabel[order.status].className}`}>{orderStatusLabel[order.status].label}</span>
                    </button>
                  ))}
                </div>}
                <p className="text-sm leading-relaxed text-slate-600">Harga, PPN, ongkir dan ketersediaan ditetapkan tim sales melalui penawaran. Penawaran, invoice dan pembayaran online belum tersedia di portal; tim kami akan menindaklanjuti permintaan Anda.</p>
                <div className="flex flex-wrap gap-3">
                  <button className={primaryClass} onClick={() => go('katalog')}>Lihat katalog produk</button>
                  <button className={secondaryClass} onClick={() => go('keranjang')}>Buka keranjang</button>
                  <button className={secondaryClass} onClick={() => { setSelectedOrder(null); go('pesanan'); }}>Pesanan saya</button>
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
                {cart.items.length > 0 && (!canOrder ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Keranjang tersimpan. Pengajuan permintaan penawaran tersedia setelah tim kami menautkan akun Anda ke data pelanggan bisnis.</div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5">
                    <h2 className="font-semibold">Ajukan permintaan penawaran</h2>
                    <p className="text-sm text-slate-600">Harga, PPN, ongkir dan ketersediaan stok dikonfirmasi oleh tim sales. Pengajuan ini belum menjadi pesanan mengikat.</p>
                    {addresses.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">Belum ada alamat pengiriman.<button className={secondaryClass} onClick={() => go('alamat')}>Tambah alamat</button></div>
                    ) : (
                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        <span>Alamat pengiriman</span>
                        <select className={inputClass} value={checkoutAddressId} disabled={busy} onChange={(e) => setCheckoutAddressId(e.target.value)}>
                          {addresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.penerima}, {address.kota}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      <span>Catatan untuk sales (opsional)</span>
                      <textarea className={`${inputClass} min-h-24`} value={checkoutNote} maxLength={CUSTOMER_ORDER_NOTE_MAX} disabled={busy} onChange={(e) => setCheckoutNote(e.target.value)} placeholder="Contoh: kebutuhan tanggal kirim, nomor RFQ/PO internal, atau spesifikasi tambahan" />
                    </label>
                    <button disabled={busy || !checkoutAddressId} className={`${primaryClass} w-full sm:w-auto`} onClick={ajukanPesanan}>{busy ? 'Mengirim...' : 'Ajukan permintaan penawaran'}</button>
                  </div>
                ))}
              </div>
            ) : account && actualPage === 'pesanan' ? (
              <div className="mt-6 space-y-4">
                {selectedOrder ? (
                  <div className="space-y-5">
                    <button className={`${secondaryClass} inline-flex items-center gap-2`} onClick={() => setSelectedOrder(null)}><ArrowLeft className="h-4 w-4" /> Semua pesanan</button>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 className="text-lg font-bold">{selectedOrder.nomor}</h2><p className="text-sm text-slate-500">Diajukan {formatTanggal(selectedOrder.createdAt)}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusLabel[selectedOrder.status].className}`}>{orderStatusLabel[selectedOrder.status].label}</span>
                    </div>
                    {selectedOrder.uji && <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">Pesanan uji dari ruang kerja developer.</p>}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Produk</th><th className="p-3">SKU</th><th className="p-3 text-right">Jumlah</th></tr></thead>
                        <tbody>{selectedOrder.baris.map((line) => (
                          <tr key={line.id} className="border-t border-slate-200"><td className="p-3"><p className="font-semibold">{line.nama}</p><p className="text-xs text-slate-500">{line.tipeModel}{line.nomorIzinEdar ? ` · ${line.nomorIzinEdar}` : ''}</p></td><td className="p-3">{line.kodeSKU || '-'}</td><td className="p-3 text-right">{line.jumlah} {line.satuan}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-4 text-sm"><p className="font-semibold">Alamat pengiriman</p><p className="mt-1 text-slate-600">{selectedOrder.alamat.penerima} · {selectedOrder.alamat.telepon}<br />{selectedOrder.alamat.alamat}, {selectedOrder.alamat.kota}, {selectedOrder.alamat.provinsi} {selectedOrder.alamat.kodePos}</p></div>
                      <div className="rounded-xl border border-slate-200 p-4 text-sm"><p className="font-semibold">Harga & tagihan</p><p className="mt-1 text-slate-600">Belum ada penawaran. Harga, PPN, ongkir dan invoice akan tampil setelah tim sales mengirim penawaran.</p></div>
                    </div>
                    {selectedOrder.catatan && <div className="rounded-xl border border-slate-200 p-4 text-sm"><p className="font-semibold">Catatan Anda</p><p className="mt-1 whitespace-pre-line text-slate-600">{selectedOrder.catatan}</p></div>}
                    <div>
                      <h3 className="font-semibold">Riwayat status</h3>
                      <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
                        {selectedOrder.riwayat.map((event) => (
                          <li key={event.id} className="text-sm"><p className="font-medium">{orderStatusLabel[event.status].label}{event.oleh === 'staf' ? ' oleh tim kami' : ''}</p><p className="text-xs text-slate-500">{formatTanggal(event.at)}</p>{event.catatan && <p className="mt-1 whitespace-pre-line text-slate-600">{event.catatan}</p>}</li>
                        ))}
                      </ol>
                    </div>
                    {selectedOrder.status === 'menunggu-penawaran' && (
                      <div className="space-y-3 border-t border-slate-200 pt-4">
                        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                          <span>Alasan pembatalan (opsional)</span>
                          <input className={inputClass} value={cancelReason} maxLength={500} disabled={busy} onChange={(e) => setCancelReason(e.target.value)} />
                        </label>
                        <button disabled={busy} className={`${secondaryClass} inline-flex items-center gap-2 text-red-700`} onClick={() => batalkanPesanan(selectedOrder.id)}><X className="h-4 w-4" /> Batalkan permintaan</button>
                      </div>
                    )}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 p-8 text-center">
                    <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-600">Belum ada pesanan. Tambahkan produk ke keranjang lalu ajukan permintaan penawaran.</p>
                    <button className={`${primaryClass} mt-4`} onClick={() => go('katalog')}>Lihat katalog</button>
                  </div>
                ) : orders.map((order) => (
                  <button key={order.id} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50" onClick={() => bukaPesanan(order.id)}>
                    <span className="min-w-0"><span className="font-semibold">{order.nomor}</span>{order.uji && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">uji</span>}
                      <span className="block text-xs text-slate-500">{formatTanggal(order.createdAt)} · {order.baris.length} produk · {order.baris.reduce((sum, line) => sum + line.jumlah, 0)} unit</span></span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusLabel[order.status].className}`}>{orderStatusLabel[order.status].label}</span>
                  </button>
                ))}
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
                {unreadCount > 0 && <button disabled={busy} className={secondaryClass} onClick={tandaiNotifikasiDibaca}>Tandai semua sudah dibaca</button>}
                {notifications.length === 0 ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500"><Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />Belum ada notifikasi.</div> :
                  notifications.map((item) => (
                    <article key={item.id} className={`rounded-xl border p-4 ${item.dibaca ? 'border-slate-200' : 'border-teal-300 bg-teal-50/50'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{item.judul}</p><p className="text-xs text-slate-500">{formatTanggal(item.createdAt)}</p></div>
                      <p className="mt-1 text-sm text-slate-600">{item.pesan}</p>
                      {item.pesananId && <button className="mt-2 text-sm font-semibold text-teal-700 hover:underline" onClick={() => { go('pesanan'); bukaPesanan(item.pesananId!); }}>Lihat pesanan</button>}
                    </article>
                  ))}
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
                  {account.username && <p className="break-words text-sm text-slate-600">Username masuk: <span className="font-semibold text-slate-800">{account.username}</span> (tidak dapat diubah)</p>}
                  <p className="break-words text-sm text-slate-600">Email terverifikasi: {account.email}</p>
                  <p className="text-sm text-slate-600">Pengaturan ulang kata sandi dilakukan melalui tautan Firebase ke email Anda. Perubahan email belum tersedia pada tahap ini; alamat pengiriman dikelola di menu Alamat pengiriman.</p>
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
                <p className="text-sm leading-relaxed text-slate-600">Buka tautan verifikasi yang dikirim Firebase. Jika halaman ini sudah dimuat ulang, masuk kembali dengan username dan kata sandi Anda.</p>
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
                {actualPage === 'daftar' && <>
                  {field('Username', username, (value) => { setUsername(value.toLowerCase()); setUsernameHint(null); }, { required: true, maxLength: 30, autoComplete: 'username' })}
                  {usernameHint
                    ? <p role="status" className={`-mt-2 text-xs ${usernameHint.ok ? 'text-teal-700' : 'text-red-700'}`}>{usernameHint.pesan}</p>
                    : <p className="-mt-2 text-xs text-slate-500">Dipakai untuk masuk. 3–30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung. Harus unik.</p>}
                  {!usernameHint && username.length >= 3 && <button type="button" disabled={busy} className="-mt-2 min-h-9 text-xs font-semibold text-teal-700" onClick={() => void run(async () => {
                    const invalid = customerUsernameError(username);
                    if (invalid) { setUsernameHint({ ok: false, pesan: invalid }); return; }
                    const check = await customerApi.checkUsername(username);
                    setUsernameHint({ ok: check.available, pesan: check.pesan });
                  })}>Cek ketersediaan username</button>}
                </>}
                {actualPage === 'masuk' && field('Username', username, setUsername, { required: true, maxLength: 64, autoComplete: 'username' })}
                {actualPage !== 'masuk' && field('Email', email, setEmail, { type: 'email', required: true, maxLength: 254, autoComplete: 'email', readOnly: actualPage === 'daftar' && Boolean(googleEmail) })}
                {actualPage === 'daftar' && <p className="-mt-2 text-xs text-slate-500">{googleEmail ? 'Email dari akun Google Anda. Selanjutnya Anda dapat masuk dengan Google atau username.' : 'Email dipakai untuk verifikasi dan pemulihan kata sandi, bukan untuk masuk.'}</p>}
                {actualPage !== 'lupa-sandi' && !(actualPage === 'daftar' && googleEmail) && field('Kata sandi', password, setPassword, { type: 'password', required: actualPage !== 'daftar' || registrationIdentity !== email.trim().toLowerCase(), maxLength: 128, autoComplete: actualPage === 'daftar' ? 'new-password' : 'current-password' })}
                {actualPage === 'daftar' && <>
                  {!googleEmail && <>
                    {field('Konfirmasi kata sandi', confirmation, setConfirmation, { type: 'password', required: registrationIdentity !== email.trim().toLowerCase(), maxLength: 128, autoComplete: 'new-password' })}
                    <p className="text-xs text-slate-500">Minimal 12 karakter untuk akun baru. Jika melengkapi pendaftaran setelah masuk, kata sandi tidak perlu diisi ulang.</p>
                  </>}
                  <label className="flex items-start gap-3 text-sm text-slate-600">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-teal-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} required disabled={busy} />
                    <span>Saya menyetujui {status.privacyUrl ? <a className="font-semibold text-teal-700 underline" href={status.privacyUrl} target="_blank" rel="noreferrer">Kebijakan Privasi</a> : 'Kebijakan Privasi'} dan {status.termsUrl ? <a className="font-semibold text-teal-700 underline" href={status.termsUrl} target="_blank" rel="noreferrer">Syarat Layanan</a> : 'Syarat Layanan'}.</span>
                  </label>
                </>}
                <button className={`${primaryClass} w-full`} disabled={busy || (actualPage === 'daftar' && !status.registrationAvailable)}>
                  {busy ? 'Memproses...' : actualPage === 'daftar' ? 'Daftar customer' : actualPage === 'lupa-sandi' ? 'Kirim tautan reset' : 'Masuk customer'}
                </button>
                {(actualPage === 'masuk' || (actualPage === 'daftar' && !googleEmail)) && <>
                  <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />atau<span className="h-px flex-1 bg-slate-200" /></div>
                  <button type="button" disabled={busy} onClick={loginWithGoogle} className={`${secondaryClass} inline-flex w-full items-center justify-center gap-2`}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" /></svg>
                    Lanjutkan dengan Google
                  </button>
                </>}
                {actualPage === 'daftar' && googleEmail && <button type="button" disabled={busy} className={`${secondaryClass} w-full`} onClick={cancelGoogle}>Gunakan email & kata sandi</button>}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 border-t border-slate-100 pt-3">
                  {actualPage !== 'masuk' && <button type="button" disabled={busy} className="min-h-11 text-sm font-semibold text-teal-700" onClick={() => { if (googleEmail) cancelGoogle(); go('masuk'); }}>Sudah punya akun? Masuk</button>}
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
