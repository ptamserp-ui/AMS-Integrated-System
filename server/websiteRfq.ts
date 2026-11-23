import type { ProspekAlkes, TipeFasyankes } from '../src/types';

export const KUNCI_RFQ_WEBSITE = 'sales_website_rfq';

const TIPE_INSTANSI: readonly TipeFasyankes[] = [
  'RS Pemerintah', 'RS Swasta', 'Klinik', 'Laboratorium', 'Dinas Kesehatan', 'Apotek'
];
const JALUR_PENGADAAN = [
  'Permintaan Penawaran Reguler (RFQ)', 'e-Katalog LKPP / E-Purchasing',
  'Tender LPSE', 'Kontrak Payung / KSO'
];

type HasilRfq =
  | { ok: true; prospek: ProspekAlkes }
  | { ok: false; pesan: string };

function teks(nilai: unknown, maksimal: number, wajib = false): string | null {
  if (typeof nilai !== 'string') return null;
  const hasil = nilai.trim();
  return hasil.length <= maksimal && (!wajib || hasil.length > 0) ? hasil : null;
}

export function buatProspekWebsite(input: unknown, sekarang = new Date()): HasilRfq {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, pesan: 'Isi permintaan penawaran tidak valid.' };
  }
  const data = input as Record<string, unknown>;
  const requestId = teks(data.requestId, 36, true);
  const namaInstansi = teks(data.namaInstansi, 160, true);
  const tipeInstansi = teks(data.tipeInstansi, 40, true);
  const namaPemohon = teks(data.namaPemohon, 160);
  const kontakPemohon = teks(data.kontakPemohon, 160, true);
  const jalur = teks(data.jalurPengadaan, 80, true);
  const subjek = teks(data.subjek, 200);
  const pesan = teks(data.pesan, 4000);
  if (
    !requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    !namaInstansi || !tipeInstansi || !TIPE_INSTANSI.includes(tipeInstansi as TipeFasyankes) ||
    namaPemohon === null || !kontakPemohon || !jalur || !JALUR_PENGADAAN.includes(jalur) ||
    subjek === null || pesan === null || !Array.isArray(data.produk) || data.produk.length > 30
  ) {
    return { ok: false, pesan: 'Periksa isian permintaan dan batas panjang setiap kolom.' };
  }
  const produk: string[] = [];
  for (const item of data.produk) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, pesan: 'Daftar produk tidak valid.' };
    }
    const baris = item as Record<string, unknown>;
    const nama = teks(baris.nama, 160, true);
    const model = teks(baris.tipeModel, 160);
    const produsen = teks(baris.produsen, 160);
    const satuan = teks(baris.satuan, 30, true);
    const jumlah = baris.jumlah;
    if (
      !nama || model === null || produsen === null || !satuan ||
      typeof jumlah !== 'number' || !Number.isSafeInteger(jumlah) || jumlah < 1 || jumlah > 1_000_000
    ) {
      return { ok: false, pesan: 'Periksa nama, satuan, dan jumlah produk yang diminta.' };
    }
    produk.push(`${nama}${model ? ` (${model})` : ''} — ${jumlah} ${satuan}${produsen ? ` | Merek: ${produsen}` : ''}`);
  }
  if (produk.length === 0 && !pesan) {
    return { ok: false, pesan: 'Pilih produk atau tuliskan rincian kebutuhan Anda.' };
  }

  const tanggal = sekarang.toISOString().slice(0, 10);
  const tindakLanjut = new Date(sekarang.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const kode = requestId.replace(/-/g, '').slice(0, 12).toUpperCase();
  return {
    ok: true,
    prospek: {
      id: `WEB-RFQ-${requestId.toLowerCase()}`,
      nomorProspek: `WEB-RFQ-${tanggal.slice(0, 7).replace('-', '')}-${kode}`,
      namaProspek: namaInstansi,
      tipeFasyankes: tipeInstansi as TipeFasyankes,
      sumberLead: 'Situs Web',
      tahap: 'Penawaran Resmi',
      produkDiminati: produk.length ? produk.join('; ') : subjek || 'Permintaan penawaran alat kesehatan',
      nilaiEstimasi: 0,
      probabilitasPersen: 50,
      medRep: 'Tim Komersial Pusat',
      rayonDistribusi: 'Nasional (Situs Publik)',
      tanggalDibuat: tanggal,
      tanggalTindakLanjut: tindakLanjut,
      catatan: `Pemohon: ${namaPemohon || '-'} (${kontakPemohon}) | Jalur: ${jalur}${subjek ? ` | Subjek: ${subjek}` : ''}${pesan ? ` | Catatan: ${pesan}` : ''}`
    }
  };
}

export function samaPermintaanWebsite(lama: ProspekAlkes, baru: ProspekAlkes): boolean {
  return lama.id.toLowerCase() === baru.id.toLowerCase() &&
    lama.namaProspek === baru.namaProspek &&
    lama.tipeFasyankes === baru.tipeFasyankes &&
    lama.produkDiminati === baru.produkDiminati &&
    lama.catatan === baru.catatan;
}

function adalahProspekWebsite(value: unknown): value is ProspekAlkes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    /^WEB-RFQ-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) &&
    typeof item.nomorProspek === 'string' &&
    typeof item.namaProspek === 'string' &&
    typeof item.tipeFasyankes === 'string' && TIPE_INSTANSI.includes(item.tipeFasyankes as TipeFasyankes) &&
    item.sumberLead === 'Situs Web' && item.tahap === 'Penawaran Resmi' &&
    typeof item.produkDiminati === 'string' &&
    typeof item.nilaiEstimasi === 'number' && Number.isFinite(item.nilaiEstimasi) &&
    typeof item.probabilitasPersen === 'number' && Number.isFinite(item.probabilitasPersen) &&
    typeof item.medRep === 'string' && typeof item.rayonDistribusi === 'string' &&
    typeof item.tanggalDibuat === 'string' && typeof item.tanggalTindakLanjut === 'string' &&
    typeof item.catatan === 'string';
}

export function gabungkanRfqWebsite(tersimpan: unknown, cloud: unknown): ProspekAlkes[] {
  if ((tersimpan !== undefined && !Array.isArray(tersimpan)) || !Array.isArray(cloud)) {
    throw new Error('Antrean RFQ server atau cloud tidak berbentuk daftar.');
  }
  const hasil: ProspekAlkes[] = [];
  const berdasarkanId = new Map<string, ProspekAlkes>();
  for (const [sumber, daftar] of [['server', tersimpan ?? []], ['cloud', cloud]] as const) {
    for (const item of daftar) {
      if (!adalahProspekWebsite(item)) throw new Error(`Data RFQ ${sumber} tidak valid.`);
      const id = `WEB-RFQ-${item.id.slice('WEB-RFQ-'.length).toLowerCase()}`;
      const sebelumnya = berdasarkanId.get(id);
      if (sebelumnya) {
        if (sumber === 'server' || !samaPermintaanWebsite(sebelumnya, item)) {
          throw new Error('Antrean RFQ mengandung ID duplikat dengan isi yang bertentangan.');
        }
        continue;
      }
      const normal = { ...item, id };
      berdasarkanId.set(id, normal);
      hasil.push(normal);
    }
  }
  return hasil;
}
