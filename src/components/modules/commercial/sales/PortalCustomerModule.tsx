import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, Link2, RefreshCw, ShieldOff, UserRound, X } from 'lucide-react';
import { db } from '../../../../services/pocketbase';
import { useDbTick } from '../../../../hooks/useDbSync';
import type { CustomerOrder, CustomerStatus } from '../../../../types/customerPortal';

interface StaffCustomer {
  id: string;
  username?: string;
  email: string;
  nama: string;
  telepon: string;
  perusahaan: string;
  status: CustomerStatus;
  pelangganId?: string;
  /** Server-computed suggestion from a unique matching B2B portal email; never applied without staff confirmation. */
  saranB2B?: { id: string; nama: string };
  createdAt: string;
}

interface StaffOrder extends CustomerOrder {
  customer: { id: string; username?: string; nama: string; perusahaan: string; status: CustomerStatus; pelangganId?: string };
}

async function portalRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/erp/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => ({})) as T & { pesan?: string };
  if (!response.ok) throw new Error(result.pesan || `Permintaan gagal (${response.status}).`);
  return result;
}

const statusAkun: Record<CustomerStatus, string> = {
  'menunggu-email': 'Menunggu verifikasi email',
  'menunggu-verifikasi': 'Menunggu tautan B2B',
  aktif: 'Aktif',
  ditangguhkan: 'Ditangguhkan'
};
const tanggal = (value: string) => new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const tombol = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50';

export default function PortalCustomerModule() {
  const dbTick = useDbTick(['sales_pelanggan']);
  const pelanggan = useMemo(() => { void dbTick; return db.getPelangganB2B(); }, [dbTick]);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [customers, setCustomers] = useState<StaffCustomer[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pilihanB2B, setPilihanB2B] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'galat'; teks: string } | null>(null);

  const muat = useCallback(async () => {
    const [orderData, customerData] = await Promise.all([
      portalRequest<{ items: StaffOrder[] }>('/pesanan'),
      portalRequest<{ items: StaffCustomer[] }>('/customers')
    ]);
    setOrders(orderData.items);
    setCustomers(customerData.items);
  }, []);

  const jalankan = async (aksi: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    setPesan(null);
    try {
      const teks = await aksi();
      if (teks) setPesan({ tipe: 'sukses', teks });
    } catch (error) {
      setPesan({ tipe: 'galat', teks: error instanceof Error ? error.message : 'Permintaan gagal.' });
    } finally { setBusy(false); }
  };

  // Initial load only; later reloads are explicit after each staff action.
  useEffect(() => { void jalankan(muat); }, []);

  const namaB2B = (id?: string) => id ? pelanggan.find((p) => p.id === id)?.namaInstalasi ?? id : '-';
  const menunggu = orders.filter((order) => order.status === 'menunggu-penawaran');

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Portal Customer</h3>
            <p className="text-xs text-slate-500 max-w-3xl">
              Permintaan penawaran dari Customer Portal dan akun customer. Penyusunan harga/PPN di portal dan konversi ke Sales Order belum aktif
              (menunggu penutupan P0-02); tindak lanjuti melalui Quotation dan Sales Order existing.
            </p>
          </div>
          <button type="button" disabled={busy} className={tombol} onClick={() => void jalankan(muat)}><RefreshCw className="w-3.5 h-3.5" /> Muat ulang</button>
        </div>
        {pesan && <div role={pesan.tipe === 'galat' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-xs ${pesan.tipe === 'galat' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{pesan.teks}</div>}
      </div>

      <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Inbox className="w-4 h-4" /> Inbox permintaan penawaran <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{menunggu.length} menunggu</span></h4>
        {orders.length === 0 ? <p className="text-xs text-slate-500">Belum ada permintaan dari portal.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="p-2">Nomor</th><th className="p-2">Diajukan</th><th className="p-2">Customer</th><th className="p-2">Pelanggan B2B</th><th className="p-2">Produk</th><th className="p-2">Status</th><th className="p-2">Aksi</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <Fragment key={order.id}>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="p-2 font-semibold">{order.nomor}{order.uji && <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800">uji developer</span>}</td>
                      <td className="p-2">{tanggal(order.createdAt)}</td>
                      <td className="p-2">{order.customer.nama}<span className="block text-slate-500">{order.customer.perusahaan}{order.customer.username ? ` · @${order.customer.username}` : ''}</span></td>
                      <td className="p-2">{namaB2B(order.customer.pelangganId)}</td>
                      <td className="p-2">{order.baris.length} baris · {order.baris.reduce((sum, line) => sum + line.jumlah, 0)} unit</td>
                      <td className="p-2">{order.status === 'menunggu-penawaran' ? 'Menunggu penawaran' : 'Dibatalkan'}</td>
                      <td className="p-2 space-x-1 whitespace-nowrap">
                        <button type="button" className={tombol} onClick={() => setExpanded(expanded === order.id ? null : order.id)}>{expanded === order.id ? 'Tutup' : 'Detail'}</button>
                        {order.status === 'menunggu-penawaran' && <button type="button" disabled={busy} className={`${tombol} text-red-700`} onClick={() => {
                          const alasan = window.prompt(`Alasan membatalkan ${order.nomor} (dikirim ke customer):`);
                          if (alasan === null) return;
                          void jalankan(async () => {
                            await portalRequest(`/pesanan/${encodeURIComponent(order.id)}/batalkan`, { alasan });
                            await muat();
                            return `Permintaan ${order.nomor} dibatalkan.`;
                          });
                        }}><X className="w-3.5 h-3.5" /> Batalkan</button>}
                      </td>
                    </tr>
                    {expanded === order.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="p-3 space-y-2">
                          <ul className="list-disc pl-5">{order.baris.map((line) => <li key={line.id}>{line.nama} — {line.kodeSKU || line.varianId} · {line.jumlah} {line.satuan}{line.nomorIzinEdar ? ` · NIE ${line.nomorIzinEdar}` : ''}</li>)}</ul>
                          <p><strong>Kirim ke:</strong> {order.alamat.penerima} ({order.alamat.telepon}), {order.alamat.alamat}, {order.alamat.kota}, {order.alamat.provinsi} {order.alamat.kodePos}</p>
                          {order.catatan && <p className="whitespace-pre-line"><strong>Catatan customer:</strong> {order.catatan}</p>}
                          <p className="text-slate-500">Riwayat: {order.riwayat.map((event) => `${event.status} (${event.oleh}, ${tanggal(event.at)})${event.catatan ? ` — ${event.catatan}` : ''}`).join(' → ')}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800"><UserRound className="w-4 h-4" /> Akun customer</h4>
        {customers.length === 0 ? <p className="text-xs text-slate-500">Belum ada akun customer terdaftar.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="p-2">Customer</th><th className="p-2">Kontak</th><th className="p-2">Status</th><th className="p-2">Pelanggan B2B</th><th className="p-2">Aksi</th></tr></thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-slate-200 align-top">
                    <td className="p-2 font-semibold">{customer.nama}<span className="block font-normal text-slate-500">{customer.perusahaan}{customer.username ? ` · @${customer.username}` : ''}</span></td>
                    <td className="p-2">{customer.email}<span className="block text-slate-500">{customer.telepon || '-'}</span></td>
                    <td className="p-2">{statusAkun[customer.status]}</td>
                    <td className="p-2">
                      {namaB2B(customer.pelangganId)}
                      {!customer.pelangganId && customer.saranB2B && customer.status === 'menunggu-verifikasi' && (
                        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
                          <span className="block text-2xs font-semibold uppercase">Saran: email cocok</span>
                          <span className="block font-semibold">{customer.saranB2B.nama}</span>
                          <button type="button" disabled={busy} className={`${tombol} mt-1.5`} onClick={() => {
                            const saran = customer.saranB2B!;
                            if (!window.confirm(`Tautkan ${customer.nama} (${customer.email}) ke ${saran.nama}? Akun akan diaktifkan.`)) return;
                            void jalankan(async () => {
                              await portalRequest(`/customers/${encodeURIComponent(customer.id)}/tautkan`, { pelangganId: saran.id });
                              await muat();
                              return `${customer.nama} ditautkan ke ${saran.nama} dan diaktifkan.`;
                            });
                          }}><Link2 className="w-3.5 h-3.5" /> Konfirmasi tautan</button>
                        </div>
                      )}
                    </td>
                    <td className="p-2 space-y-1.5">
                      {customer.status !== 'ditangguhkan' && customer.status !== 'menunggu-email' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select className="rounded-lg border border-slate-300 px-2 py-1.5" value={pilihanB2B[customer.id] ?? ''} onChange={(e) => setPilihanB2B((old) => ({ ...old, [customer.id]: e.target.value }))}>
                            <option value="">Pilih pelanggan B2B aktif</option>
                            {pelanggan.filter((p) => p.statusPelanggan === 'Aktif').map((p) => <option key={p.id} value={p.id}>{p.kodePelanggan} — {p.namaInstalasi}</option>)}
                          </select>
                          <button type="button" disabled={busy || !pilihanB2B[customer.id]} className={tombol} onClick={() => void jalankan(async () => {
                            await portalRequest(`/customers/${encodeURIComponent(customer.id)}/tautkan`, { pelangganId: pilihanB2B[customer.id] });
                            await muat();
                            return `${customer.nama} ditautkan dan diaktifkan.`;
                          })}><Link2 className="w-3.5 h-3.5" /> Tautkan</button>
                        </div>
                      )}
                      {customer.status !== 'ditangguhkan' && <button type="button" disabled={busy} className={`${tombol} text-red-700`} onClick={() => {
                        if (!window.confirm(`Tangguhkan akun ${customer.nama}? Semua sesi portal akan dicabut.`)) return;
                        void jalankan(async () => {
                          await portalRequest(`/customers/${encodeURIComponent(customer.id)}/tangguhkan`, {});
                          await muat();
                          return `Akun ${customer.nama} ditangguhkan.`;
                        });
                      }}><ShieldOff className="w-3.5 h-3.5" /> Tangguhkan</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
